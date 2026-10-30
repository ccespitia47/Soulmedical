import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions';

/**
 * Proxy backend para leer headers de fuentes externas (Google Sheets).
 *
 * Motivación: cuando el Sheet está "Publicado en la Web" (URL /d/e/...),
 * el endpoint /pub?output=csv responde con 307 → googleusercontent.com,
 * y el navegador bloquea el redirect por CORS (googleusercontent no
 * envía Access-Control-Allow-Origin). Resultado: fetch frontend devuelve
 * [] silenciosamente y el admin se queda sin saber por qué no detectó
 * columnas.
 *
 * El backend hace el fetch sin restricción CORS y devuelve los headers.
 */
@Controller('forms/search-source')
export class SearchSourceController {
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(Permission.FORMS_EDIT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('sheets-headers')
  async sheetsHeaders(
    @Body() body: { url?: string },
  ): Promise<{ headers: string[]; gid: string | null }> {
    const url = body?.url?.trim();
    if (!url) throw new BadRequestException('Falta url.');
    const parsed = parseSheetsUrl(url);
    if (!parsed) {
      throw new BadRequestException('URL de Google Sheets no reconocida.');
    }
    const params = new URLSearchParams(
      parsed.published ? { output: 'csv' } : { tqx: 'out:csv' },
    );
    if (parsed.gid) params.set('gid', parsed.gid);
    if (!parsed.published) params.set('range', 'A1:Z1');
    const csvUrl = parsed.published
      ? `https://docs.google.com/spreadsheets/d/e/${parsed.id}/pub?${params.toString()}`
      : `https://docs.google.com/spreadsheets/d/${parsed.id}/gviz/tq?${params.toString()}`;
    try {
      const res = await fetch(csvUrl);
      if (!res.ok) {
        throw new BadRequestException(
          `Google Sheets devolvió ${res.status}. Verifica que el Sheet sea público ('Cualquiera con el enlace') o esté 'Publicado en la Web'.`,
        );
      }
      const text = await res.text();
      const rows = parseCsv(text);
      const headers = (rows[0] ?? []).map((c) => c.trim()).filter(Boolean);
      return { headers, gid: parsed.gid };
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(
        `Error al leer el Sheet: ${(e as Error).message}`,
      );
    }
  }
}

function parseSheetsUrl(
  url: string,
): { id: string; gid: string | null; published: boolean } | null {
  const publishedMatch = url.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
  if (publishedMatch) {
    const gidMatch = url.match(/[?#&]gid=(\d+)/);
    return {
      id: publishedMatch[1],
      gid: gidMatch?.[1] ?? null,
      published: true,
    };
  }
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const gidMatch = url.match(/[?#&]gid=(\d+)/);
  return { id: idMatch[1], gid: gidMatch?.[1] ?? null, published: false };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (c === '\r') {
        /* skip */
      } else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
