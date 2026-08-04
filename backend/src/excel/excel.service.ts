import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { read, utils } from 'xlsx';
import { GraphTokenService } from '../email/graph-token.service';
import { ExcelCacheService } from './excel-cache.service';

const MAX_BYTES = 20 * 1024 * 1024;
const SHAREPOINT_HOST_RE = /^https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.sharepoint\.com\//i;

@Injectable()
export class ExcelService {
  private readonly logger = new Logger(ExcelService.name);

  constructor(
    private readonly tokens: GraphTokenService,
    private readonly cache: ExcelCacheService,
  ) {}

  /**
   * Convierte una URL de SharePoint del tenant a un share-id encodeado
   * consumible por Graph API. Ver:
   * https://learn.microsoft.com/en-us/graph/api/shares-get#encoding-sharing-urls
   */
  resolveShareId(url: string): string {
    if (!SHAREPOINT_HOST_RE.test(url)) {
      throw new BadRequestException(
        'URL de SharePoint no reconocida. Solo se soportan enlaces de SharePoint del tenant corporativo.',
      );
    }
    const b64 = Buffer.from(url, 'utf8').toString('base64');
    const enc = b64.replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/, '');
    return `u!${enc}`;
  }

  async getHeaders(url: string): Promise<string[]> {
    const buffer = await this.fetchXlsx(url);
    const wb = read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return [];
    const ws = wb.Sheets[sheetName];
    const rows = utils.sheet_to_json<string[]>(ws, { header: 1 });
    const first = (rows[0] ?? []).map((v) => String(v ?? '').trim()).filter(Boolean);
    return first;
  }

  async searchRows(
    url: string,
    q: string,
    searchCol: string,
  ): Promise<Record<string, unknown>[]> {
    const buffer = await this.fetchXlsx(url);
    const wb = read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return [];
    const ws = wb.Sheets[sheetName];
    const rows = utils.sheet_to_json<Record<string, unknown>>(ws);
    const needle = q.toLowerCase();
    return rows
      .filter((r) =>
        String(r[searchCol] ?? '').toLowerCase().includes(needle),
      )
      .slice(0, 20);
  }

  private async fetchXlsx(url: string): Promise<Buffer> {
    const shareId = this.resolveShareId(url);
    return this.cache.getOrFetch(url, async () => {
      const token = await this.tokens.getAccessToken();
      const graphUrl = `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem/content`;
      const res = await this.getWithRetry(graphUrl, token);
      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_BYTES) {
        throw new PayloadTooLargeException('El Excel excede el límite de 20 MB.');
      }
      return Buffer.from(ab);
    });
  }

  /**
   * GET con retry ante 429/503 (mismo patrón que EmailService.postToGraphWithRetry).
   * Otros errores (403 sin permisos, 404 archivo movido) no reintentan.
   */
  private async getWithRetry(url: string, token: string): Promise<Response> {
    const MAX_ATTEMPTS = 3;
    const BACKOFF_MS = [2_000, 4_000, 8_000];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 200) {
        if (attempt > 1) {
          this.logger.log(`[excel] recuperado tras ${attempt} intento(s)`);
        }
        return res;
      }
      if (res.status === 403) {
        throw new ServiceUnavailableException(
          'El backend no tiene el permiso Files.Read.All en Azure. Contacta al admin del tenant.',
        );
      }
      if (res.status === 404) {
        throw new NotFoundException('El archivo no existe o fue movido.');
      }
      if (res.status !== 429 && res.status !== 503) {
        const body = await res.text().catch(() => '');
        this.logger.error(`[excel] Graph ${res.status}: ${body}`);
        throw new ServiceUnavailableException(`Error de Graph: ${res.status}`);
      }
      if (attempt === MAX_ATTEMPTS) {
        throw new ServiceUnavailableException(`Graph throttled tras ${MAX_ATTEMPTS} intentos`);
      }
      const retryAfter = res.headers.get('Retry-After');
      const waitMs = this.parseRetryAfter(retryAfter) ?? BACKOFF_MS[attempt - 1];
      this.logger.warn(
        `[excel] ${res.status} intento ${attempt}/${MAX_ATTEMPTS}, reintentando en ${Math.round(waitMs / 1000)}s`,
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
    // Inalcanzable, pero TypeScript necesita return
    throw new ServiceUnavailableException('Graph no respondió');
  }

  private parseRetryAfter(header: string | null): number | null {
    if (!header) return null;
    const asSeconds = Number(header);
    if (Number.isFinite(asSeconds) && asSeconds >= 0) return asSeconds * 1000;
    const asDate = Date.parse(header);
    if (Number.isFinite(asDate)) return Math.max(0, asDate - Date.now());
    return null;
  }
}
