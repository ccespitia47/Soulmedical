# Excel OneDrive Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer funcional el source `excel_web` del widget search para leer Excel privados de SharePoint del tenant corporativo, con auto-detección de columnas y cache 60s.

**Architecture:** Backend proxy nuevo (`backend/src/excel/`) que reutiliza `GraphTokenService` para autenticarse con Microsoft Graph, descarga el `.xlsx` binario vía `GET /shares/{shareId}/driveItem/content`, parsea con `xlsx` (SheetJS) y devuelve headers/rows al frontend. Cache in-memory 60s por URL. Frontend cambia el source `excelWeb.ts` para consumir el proxy y extiende `Search.properties.tsx` con la misma UX de auto-detect que ya tiene Google Sheets.

**Tech Stack:** NestJS 11 + Mongoose 9 + Microsoft Graph API (`client_credentials` flow, ya configurado) + `xlsx` (SheetJS, nueva dep del backend); React 19 + TypeScript + Vite (sin cambios en libs).

## Global Constraints

- Los endpoints backend requieren JWT + `Permission.FORMS_EDIT` (solo admins que arman formularios, nunca usuarios finales).
- Rate limits: `POST /excel/headers` 20/min, `POST /excel/search` 60/min por IP (throttler global de la app).
- Cache in-memory 60s, límite duro 100 entries (LRU al llenarse), sin persistencia a disco ni Mongo.
- Buffer máximo del `.xlsx` 20 MB — rechazar más grande.
- Reutilizar `GraphTokenService` existente (`backend/src/email/graph-token.service.ts`) — sin nuevas credenciales en `.env`.
- Reutilizar el patrón de retry con backoff (Retry-After + 2s/4s/8s, máx. 3 intentos) que ya está en `EmailService.postToGraphWithRetry`.
- Solo lectura: la app nunca escribe al Excel.

---

## Estructura de archivos

**Nuevos backend:**
- `backend/src/excel/excel.module.ts`
- `backend/src/excel/excel.controller.ts`
- `backend/src/excel/excel.service.ts`
- `backend/src/excel/excel.service.spec.ts`
- `backend/src/excel/excel-cache.service.ts`
- `backend/src/excel/excel-cache.service.spec.ts`

**Modificados backend:**
- `backend/src/app.module.ts` (registrar `ExcelModule`)
- `backend/package.json` + `backend/package-lock.json` (agregar `xlsx`)

**Modificados frontend:**
- `src/components/widgets/search/sources/excelWeb.ts` (reescribir: usa backend proxy)
- `src/components/widgets/search/Search.properties.tsx` (auto-detect Excel + dropdowns)
- `src/services/api.ts` (nuevo helper `postJson` si no existe; usar `request` actual)

**No cambian:**
- `src/components/widgets/search/Search.render.tsx` (el widget sigue igual)
- `search.types.ts` (los campos `excelUrl`/`excelSearchCol` ya existen)

**Manual (fuera del código):**
- Setup Azure: agregar permiso `Files.Read.All` (Application) a la app registrada + admin consent. Documentado en Task 6.

---

## FASE 1 · Backend

### Task 1: ExcelCacheService — cache in-memory con TTL 60s

**Files:**
- Create: `backend/src/excel/excel-cache.service.ts`
- Create: `backend/src/excel/excel-cache.service.spec.ts`

**Interfaces:**
- Produces:
  - `class ExcelCacheService`
  - `async getOrFetch(url: string, fetchFn: () => Promise<Buffer>): Promise<Buffer>`
  - Constantes: TTL 60_000 ms, MAX_ENTRIES 100
- Consumes: nada (utilidad pura, DI-injected en Task 2)

- [ ] **Step 1: Escribir el spec de tests**

Crear `backend/src/excel/excel-cache.service.spec.ts`:

```ts
import { ExcelCacheService } from './excel-cache.service';

describe('ExcelCacheService', () => {
  let svc: ExcelCacheService;
  beforeEach(() => { svc = new ExcelCacheService(); });

  it('primer fetch invoca fetchFn y devuelve el buffer', async () => {
    const fetchFn = jest.fn().mockResolvedValue(Buffer.from('data'));
    const out = await svc.getOrFetch('url1', fetchFn);
    expect(out).toEqual(Buffer.from('data'));
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('segundo fetch dentro del TTL reusa el cache sin llamar fetchFn', async () => {
    const fetchFn = jest.fn().mockResolvedValue(Buffer.from('data'));
    await svc.getOrFetch('url1', fetchFn);
    await svc.getOrFetch('url1', fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('fetch después del TTL refetchea', async () => {
    jest.useFakeTimers();
    const fetchFn = jest.fn().mockResolvedValue(Buffer.from('data'));
    await svc.getOrFetch('url1', fetchFn);
    jest.advanceTimersByTime(60_001);
    await svc.getOrFetch('url1', fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('URLs distintas tienen entries independientes', async () => {
    const fetchA = jest.fn().mockResolvedValue(Buffer.from('a'));
    const fetchB = jest.fn().mockResolvedValue(Buffer.from('b'));
    const [a, b] = await Promise.all([
      svc.getOrFetch('url-a', fetchA),
      svc.getOrFetch('url-b', fetchB),
    ]);
    expect(a).toEqual(Buffer.from('a'));
    expect(b).toEqual(Buffer.from('b'));
  });

  it('al alcanzar MAX_ENTRIES=100, evict de la entry más antigua (LRU)', async () => {
    for (let i = 0; i < 100; i++) {
      await svc.getOrFetch(`url-${i}`, () => Promise.resolve(Buffer.from(`${i}`)));
    }
    // Insert la 101 → debería sacar la 0
    await svc.getOrFetch('url-101', () => Promise.resolve(Buffer.from('101')));
    // Refetch url-0 debería llamar fetchFn de nuevo (fue evicted)
    const refetch = jest.fn().mockResolvedValue(Buffer.from('re-0'));
    await svc.getOrFetch('url-0', refetch);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Correr los tests (deben fallar por módulo inexistente)**

```powershell
cd backend
npx jest src/excel/excel-cache.service.spec.ts
cd ..
```
Expected: FAIL "Cannot find module './excel-cache.service'".

- [ ] **Step 3: Implementar `ExcelCacheService`**

Crear `backend/src/excel/excel-cache.service.ts`:

```ts
import { Injectable } from '@nestjs/common';

type CacheEntry = { buffer: Buffer; expiresAt: number };

@Injectable()
export class ExcelCacheService {
  private readonly cache = new Map<string, CacheEntry>();
  private static readonly TTL_MS = 60_000;
  private static readonly MAX_ENTRIES = 100;

  async getOrFetch(url: string, fetchFn: () => Promise<Buffer>): Promise<Buffer> {
    const hit = this.cache.get(url);
    if (hit && Date.now() < hit.expiresAt) {
      // LRU: al hit reciente, moverlo al final del Map (Map preserva insertion order)
      this.cache.delete(url);
      this.cache.set(url, hit);
      return hit.buffer;
    }

    const buffer = await fetchFn();

    if (this.cache.size >= ExcelCacheService.MAX_ENTRIES) {
      // Evict la entry más antigua (primera del Map)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) this.cache.delete(oldestKey);
    }

    this.cache.set(url, {
      buffer,
      expiresAt: Date.now() + ExcelCacheService.TTL_MS,
    });
    return buffer;
  }
}
```

- [ ] **Step 4: Correr los tests (deben pasar)**

```powershell
cd backend
npx jest src/excel/excel-cache.service.spec.ts
cd ..
```
Expected: 5 tests passed.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/excel/excel-cache.service.ts backend/src/excel/excel-cache.service.spec.ts
git commit -m "feat(excel): ExcelCacheService con TTL 60s + LRU 100 entries

Cache in-memory por URL del binario xlsx descargado de OneDrive/SharePoint.
Reutiliza el buffer si el proximo fetch entra dentro de la ventana TTL.
LRU simple: al llenarse a 100 entries, evict la mas antigua.

Sin persistencia a disco ni Mongo. Reinicio del backend vacia el cache.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: ExcelService — Graph API + parse xlsx

**Files:**
- Create: `backend/src/excel/excel.service.ts`
- Create: `backend/src/excel/excel.service.spec.ts`
- Modify: `backend/package.json` + `backend/package-lock.json` (agregar `xlsx`)

**Interfaces:**
- Consumes:
  - `ExcelCacheService.getOrFetch(url, fetchFn)` (Task 1)
  - `GraphTokenService.getAccessToken(): Promise<string>` (existente en `backend/src/email/graph-token.service.ts`)
- Produces:
  - `class ExcelService`
  - `resolveShareId(url: string): string` — pública para poder testear
  - `async getHeaders(url: string): Promise<string[]>`
  - `async searchRows(url: string, q: string, searchCol: string): Promise<Record<string, unknown>[]>`
  - Constante `MAX_BYTES = 20 * 1024 * 1024` (20 MB)

- [ ] **Step 1: Instalar xlsx en el backend**

```powershell
cd backend
npm install xlsx --save
cd ..
```

Verificar que `backend/package.json` ahora tiene `"xlsx": "^0.18.5"` (o versión disponible).

- [ ] **Step 2: Escribir los tests unitarios**

Crear `backend/src/excel/excel.service.spec.ts`:

```ts
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { ExcelService } from './excel.service';
import { ExcelCacheService } from './excel-cache.service';
import { utils, write } from 'xlsx';

describe('ExcelService', () => {
  let svc: ExcelService;
  let cache: ExcelCacheService;
  const tokens = { getAccessToken: jest.fn().mockResolvedValue('fake-token') } as any;

  beforeEach(() => {
    cache = new ExcelCacheService();
    svc = new ExcelService(tokens, cache);
  });

  describe('resolveShareId', () => {
    it('convierte URL de SharePoint a share-id encodeado', () => {
      const url = 'https://empresa.sharepoint.com/:x:/g/personal/user/EXXX';
      const id = svc.resolveShareId(url);
      expect(id).toMatch(/^u!/);
      expect(id).not.toContain('/'); // reemplazado por _
      expect(id).not.toContain('+'); // reemplazado por -
      expect(id).not.toMatch(/=+$/); // sin padding
    });

    it('rechaza URLs de OneDrive personal', () => {
      expect(() => svc.resolveShareId('https://onedrive.live.com/edit?id=x')).toThrow(BadRequestException);
    });

    it('rechaza URLs sin dominio sharepoint.com', () => {
      expect(() => svc.resolveShareId('https://example.com/file.xlsx')).toThrow(BadRequestException);
    });
  });

  describe('parse de headers', () => {
    it('devuelve la primera fila como array de strings', async () => {
      // Crear un xlsx en memoria
      const wb = utils.book_new();
      const ws = utils.aoa_to_sheet([
        ['Nombre', 'Documento', 'Teléfono'],
        ['Ana', '123', '3001'],
      ]);
      utils.book_append_sheet(wb, ws, 'Sheet1');
      const buffer = Buffer.from(write(wb, { type: 'buffer', bookType: 'xlsx' }));

      // Mock cache para que devuelva el buffer sin llamar Graph
      jest.spyOn(cache, 'getOrFetch').mockResolvedValue(buffer);

      const headers = await svc.getHeaders('https://empresa.sharepoint.com/:x:/g/x');
      expect(headers).toEqual(['Nombre', 'Documento', 'Teléfono']);
    });
  });

  describe('search', () => {
    const wb = utils.book_new();
    const ws = utils.aoa_to_sheet([
      ['Nombre', 'Documento'],
      ['Ana Torres', 'CC 111'],
      ['Yeimer Alejandro', 'CC 222'],
      ['Yeisi Rodriguez', 'CC 333'],
    ]);
    utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = Buffer.from(write(wb, { type: 'buffer', bookType: 'xlsx' }));

    beforeEach(() => {
      jest.spyOn(cache, 'getOrFetch').mockResolvedValue(buffer);
    });

    it('filtra case-insensitive por la columna indicada', async () => {
      const rows = await svc.searchRows('https://empresa.sharepoint.com/:x:/g/x', 'yei', 'Nombre');
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r['Nombre'])).toEqual(['Yeimer Alejandro', 'Yeisi Rodriguez']);
    });

    it('devuelve array vacío si searchCol no existe en headers', async () => {
      const rows = await svc.searchRows('https://empresa.sharepoint.com/:x:/g/x', 'yei', 'ColumnaInexistente');
      expect(rows).toEqual([]);
    });

    it('cap de 20 filas máximo', async () => {
      const wb2 = utils.book_new();
      const rows: string[][] = [['Nombre']];
      for (let i = 0; i < 100; i++) rows.push([`nombre-${i}`]);
      const ws2 = utils.aoa_to_sheet(rows);
      utils.book_append_sheet(wb2, ws2, 'Sheet1');
      const bigBuffer = Buffer.from(write(wb2, { type: 'buffer', bookType: 'xlsx' }));
      jest.spyOn(cache, 'getOrFetch').mockResolvedValue(bigBuffer);

      const out = await svc.searchRows('https://empresa.sharepoint.com/:x:/g/x', 'nombre', 'Nombre');
      expect(out).toHaveLength(20);
    });
  });
});
```

- [ ] **Step 3: Correr los tests (deben fallar)**

```powershell
cd backend
npx jest src/excel/excel.service.spec.ts
cd ..
```
Expected: FAIL "Cannot find module './excel.service'".

- [ ] **Step 4: Implementar `ExcelService`**

Crear `backend/src/excel/excel.service.ts`:

```ts
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
```

- [ ] **Step 5: Correr los tests (deben pasar)**

```powershell
cd backend
npx jest src/excel/excel.service.spec.ts
cd ..
```
Expected: 6 tests passed.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/excel/excel.service.ts backend/src/excel/excel.service.spec.ts backend/package.json backend/package-lock.json
git commit -m "feat(excel): ExcelService con Graph API + parse xlsx

Descarga el binario xlsx via Graph API (shares/{id}/driveItem/content),
lo cachea 60s via ExcelCacheService, parsea con SheetJS y expone:
- getHeaders(url) -> string[]  (primera fila del sheet)
- searchRows(url, q, col) -> Row[]  (filtra case-insensitive, max 20)
- resolveShareId(url) -> string  (base64url + prefijo 'u!' para Graph)

Rechaza URLs que no sean de sharepoint.com, archivos > 20 MB, y retry con
backoff ante 429/503 (mismo helper que EmailService).

Agrega dep xlsx al backend.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: ExcelController + ExcelModule + wiring en AppModule

**Files:**
- Create: `backend/src/excel/excel.controller.ts`
- Create: `backend/src/excel/excel.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `ExcelService` (Task 2), `JwtAuthGuard`, `PermissionsGuard`, `RequirePermission`, `Permission.FORMS_EDIT`
- Produces: rutas `POST /api/excel/headers` y `POST /api/excel/search`

- [ ] **Step 1: Verificar que `Permission.FORMS_EDIT` existe**

```powershell
Select-String "FORMS_EDIT" backend/src/auth/permissions.ts
```
Expected: aparece el enum value. Si no existe con ese nombre exacto, usar el nombre real (`FORMS_MANAGE`, etc.) y ajustar Step 3.

- [ ] **Step 2: Crear el controller**

Crear `backend/src/excel/excel.controller.ts`:

```ts
import {
  Body,
  Controller,
  HttpException,
  InternalServerErrorException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions';
import { ExcelService } from './excel.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('excel')
export class ExcelController {
  constructor(private readonly excelService: ExcelService) {}

  /**
   * Devuelve la primera fila (headers) del Excel apuntado por `url`.
   * Usa cache 60s del ExcelService — al pegar la URL en el builder solo
   * la primera vez cuesta ~500ms; siguientes usos son instantáneos.
   */
  @Post('headers')
  @RequirePermission(Permission.FORMS_EDIT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async headers(@Body() body: { url?: string }): Promise<{ headers: string[] }> {
    if (!body?.url?.trim()) {
      throw new InternalServerErrorException('Falta el campo url');
    }
    try {
      const headers = await this.excelService.getHeaders(body.url.trim());
      return { headers };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Error leyendo Excel: ${msg}`);
    }
  }

  /**
   * Búsqueda case-insensitive en el Excel. Devuelve máx. 20 filas que
   * contengan `q` en la columna `searchCol`.
   */
  @Post('search')
  @RequirePermission(Permission.FORMS_EDIT)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async search(
    @Body() body: { url?: string; q?: string; searchCol?: string },
  ): Promise<{ rows: Record<string, unknown>[] }> {
    if (!body?.url?.trim() || !body?.q?.trim() || !body?.searchCol?.trim()) {
      throw new InternalServerErrorException('Faltan campos: url, q, searchCol');
    }
    try {
      const rows = await this.excelService.searchRows(
        body.url.trim(),
        body.q.trim(),
        body.searchCol.trim(),
      );
      return { rows };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Error buscando en Excel: ${msg}`);
    }
  }
}
```

- [ ] **Step 3: Crear el módulo**

Crear `backend/src/excel/excel.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ExcelController } from './excel.controller';
import { ExcelService } from './excel.service';
import { ExcelCacheService } from './excel-cache.service';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [
    EmailModule, // exporta GraphTokenService
    UsersModule, // necesario para PermissionsGuard (verifica permisos vs DB)
  ],
  controllers: [ExcelController],
  providers: [ExcelService, ExcelCacheService, PermissionsGuard],
})
export class ExcelModule {}
```

Nota: si `EmailModule` no exporta `GraphTokenService`, agregar `exports: [GraphTokenService]` al `EmailModule` (verificar antes; en la codebase actual probablemente ya lo exporta porque ReportsModule también lo consume).

- [ ] **Step 4: Registrar `ExcelModule` en `AppModule`**

Editar `backend/src/app.module.ts`:

Agregar el import:
```ts
import { ExcelModule } from './excel/excel.module';
```

Y agregar `ExcelModule` al array `imports:` del `@Module` decorator (al final de la lista, orden alfabético o al final da igual).

- [ ] **Step 5: Verificar que `EmailModule` exporta `GraphTokenService`**

```powershell
Select-String "exports" backend/src/email/email.module.ts -Context 0,3
```

Si `GraphTokenService` NO está en el array `exports`, agregarlo. Debería quedar así:

```ts
@Module({
  imports: [...],
  controllers: [EmailController],
  providers: [EmailService, GraphTokenService],
  exports: [EmailService, GraphTokenService],  // <-- agregar GraphTokenService aquí
})
```

- [ ] **Step 6: Build backend**

```powershell
cd backend
npm run build
cd ..
```
Expected: 0 errores.

- [ ] **Step 7: Prueba manual con curl (después de reiniciar el backend)**

Reiniciar backend con PowerShell como Admin:
```powershell
cd C:\proyectos\Soulmedical\backend
.\scripts\kill-zombies.ps1
.\scripts\start-backend.ps1
```

Con un JWT de un admin con `FORMS_EDIT`:
```powershell
$token = "<JWT>"
$body = @{ url = "https://empresa.sharepoint.com/:x:/g/personal/..." } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/excel/headers" `
  -Headers @{Authorization="Bearer $token"} `
  -ContentType "application/json" -Body $body
```

Expected: `{ headers: [...] }`. Si sale 403 con "Files.Read.All" → falta el admin consent (Task 6).

- [ ] **Step 8: Commit**

```powershell
git add backend/src/excel/excel.controller.ts backend/src/excel/excel.module.ts backend/src/app.module.ts backend/src/email/email.module.ts
git commit -m "feat(excel): ExcelController + wiring en AppModule

Endpoints POST /excel/headers y POST /excel/search con guards
(JwtAuthGuard + PermissionsGuard + FORMS_EDIT). Throttle 20/60 por minuto.

EmailModule ahora exporta GraphTokenService para que ExcelModule pueda
consumirlo reusando la misma auth con Microsoft Graph que se usa para
el envio de correos.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## FASE 2 · Frontend

### Task 4: Reescribir `excelWeb.ts` para consumir el backend

**Files:**
- Modify: `src/components/widgets/search/sources/excelWeb.ts`

**Interfaces:**
- Consumes:
  - Backend endpoints `POST /api/excel/headers` y `POST /api/excel/search` (Task 3)
  - Helper `request<T>(endpoint, options)` de `src/services/api.ts` (existente)
- Produces:
  - `async function searchExcelWeb(config: SearchWidgetConfig, q: string): Promise<Row[]>` (firma preservada — mismo consumidor en Search.render.tsx)
  - `async function fetchExcelHeaders(url: string): Promise<string[]>` (nuevo export)

- [ ] **Step 1: Reescribir el archivo**

Reemplazar `src/components/widgets/search/sources/excelWeb.ts` completo con:

```ts
import type { SearchWidgetConfig } from "../search.types";

type Row = Record<string, unknown>;

const API_URL = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api`;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Devuelve los headers (primera fila) del Excel. Delegado al backend
 * proxy — el navegador no puede leer OneDrive/SharePoint directo por CORS.
 */
export async function fetchExcelHeaders(url: string): Promise<string[]> {
  const res = await fetch(`${API_URL}/excel/headers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.headers) ? data.headers : [];
}

/**
 * Busca en el Excel apuntado por config.excelUrl.
 * Todo el trabajo (auth Graph, download, parse) se hace en el backend.
 */
export async function searchExcelWeb(
  config: SearchWidgetConfig,
  q: string,
): Promise<Row[]> {
  if (!config.excelUrl || !q.trim() || !config.excelSearchCol) return [];
  const res = await fetch(`${API_URL}/excel/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      url: config.excelUrl,
      q,
      searchCol: config.excelSearchCol,
    }),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.rows) ? data.rows : [];
}
```

- [ ] **Step 2: Build frontend**

```powershell
npm run build
```
Expected: 0 errores.

- [ ] **Step 3: Commit**

```powershell
git add src/components/widgets/search/sources/excelWeb.ts
git commit -m "refactor(search-widget): excelWeb usa backend proxy en vez de fetch directo

El fetch directo desde el navegador a OneDrive/SharePoint fallaba por CORS
en el 100% de los casos. Ahora delega en POST /api/excel/search del backend
(que hace el fetch con Graph API sin restricciones de CORS).

Nuevo export fetchExcelHeaders para auto-detectar columnas al pegar URL
(consumido en Search.properties.tsx en la siguiente task).

Se elimina la dependencia del paquete xlsx en el frontend (se movio al
backend). El paquete sigue en package.json porque generateExcelHtml lo usa.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: Auto-detect en `Search.properties.tsx` para Excel

**Files:**
- Modify: `src/components/widgets/search/Search.properties.tsx`

**Interfaces:**
- Consumes: `fetchExcelHeaders(url)` (Task 4)
- Produces: UI de auto-detect + dropdown de "Columna donde buscar" + integración con `sourceFieldOptions` para poblar los dropdowns de "Columnas a mostrar" y "Rellenar campos al seleccionar"

- [ ] **Step 1: Agregar el import**

En `src/components/widgets/search/Search.properties.tsx`, agregar al bloque de imports:

```ts
import { fetchExcelHeaders } from "./sources/excelWeb";
```

- [ ] **Step 2: Agregar estado del Excel (paralelo al de Google Sheets)**

Justo después del state `[sheetsError, setSheetsError]`:

```ts
// Headers auto-detectados del Excel de SharePoint al pegar la URL.
const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
const [excelDetecting, setExcelDetecting] = useState(false);
const [excelError, setExcelError] = useState<string | null>(null);
```

- [ ] **Step 3: Agregar el useEffect de auto-detect**

Después del `useEffect` existente que detecta headers de Google Sheets:

```ts
// Auto-detección de headers al pegar URL de Excel/SharePoint. Debounce 600ms.
useEffect(() => {
  if (config.sourceType !== "excel_web") return;
  const url = config.excelUrl?.trim() ?? "";
  if (!url) { setExcelHeaders([]); setExcelError(null); return; }
  setExcelDetecting(true);
  setExcelError(null);
  const t = setTimeout(async () => {
    try {
      const headers = await fetchExcelHeaders(url);
      if (headers.length === 0) {
        setExcelError(
          "No se pudieron leer las columnas. Verifica que la URL sea de SharePoint del tenant corporativo y que Files.Read.All esté aprobado en Azure.",
        );
        setExcelHeaders([]);
      } else {
        setExcelHeaders(headers);
      }
    } catch (err) {
      console.error("[SearchWidget] Error detectando Excel:", err);
      setExcelError("Error al conectar con el backend");
      setExcelHeaders([]);
    } finally {
      setExcelDetecting(false);
    }
  }, 600);
  return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [config.excelUrl, config.sourceType]);
```

- [ ] **Step 4: Extender `sourceFieldOptions` para incluir Excel**

Buscar el bloque `let sourceFieldOptions: FieldOpt[] | null = null;` y agregar la rama de `excel_web` al final:

```ts
} else if (config.sourceType === "google_sheets" && sheetsHeaders.length > 0) {
  sourceFieldOptions = sheetsHeaders.map((h) => ({ value: h, label: h }));
} else if (config.sourceType === "excel_web" && excelHeaders.length > 0) {
  sourceFieldOptions = excelHeaders.map((h) => ({ value: h, label: h }));
}
```

- [ ] **Step 5: Reemplazar el bloque UI actual de `excel_web`**

Buscar el bloque `{config.sourceType === "excel_web" && (` y reemplazarlo por:

```tsx
{config.sourceType === "excel_web" && (
  <div className={SECTION}>
    <div className="mb-2 text-xs font-bold uppercase text-gray-500">📗 Excel en OneDrive/SharePoint</div>
    <label className={LABEL}>URL del Excel en SharePoint</label>
    <input className={INPUT} value={config.excelUrl ?? ""}
      placeholder="https://empresa.sharepoint.com/:x:/g/personal/..."
      onChange={(e) => setConfig({ excelUrl: e.target.value })} />
    <p className="mt-1 text-[11px] text-gray-400">
      Pega la URL del Excel — se detectarán las columnas automáticamente.
      Debe estar en SharePoint del tenant corporativo (no OneDrive personal).
    </p>

    {excelDetecting && (
      <div className="mt-2 rounded-md bg-blue-50 px-2.5 py-1.5 text-[11.5px] text-blue-700">
        ⏳ Detectando columnas…
      </div>
    )}
    {excelError && (
      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11.5px] text-amber-800">
        ⚠️ {excelError}
      </div>
    )}

    {excelHeaders.length > 0 && (
      <>
        <div className="mt-3 rounded-md bg-emerald-50 px-2.5 py-1.5 text-[11.5px] text-emerald-700">
          ✓ {excelHeaders.length} columna(s) detectada(s)
        </div>
        <label className={`${LABEL} mt-3`}>Columna donde buscar</label>
        <select className={INPUT} value={config.excelSearchCol ?? ""}
          onChange={(e) => setConfig({ excelSearchCol: e.target.value })}>
          <option value="">-- Selecciona una columna --</option>
          {excelHeaders.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
      </>
    )}
  </div>
)}
```

- [ ] **Step 6: Build frontend**

```powershell
npm run build
```
Expected: 0 errores.

- [ ] **Step 7: Commit**

```powershell
git add src/components/widgets/search/Search.properties.tsx
git commit -m "feat(search-widget): auto-detect columnas de Excel al pegar URL

Misma UX que Google Sheets: al pegar la URL de SharePoint del tenant,
el backend responde con los headers y se muestran como dropdown.
'Columna donde buscar' pasa de input libre a select con opciones reales.
Los dropdowns de 'Columnas a mostrar en resultados' y 'Rellenar campos
al seleccionar' tambien usan los headers detectados (misma mecanica que
sheetsHeaders / sourceWidgets / group).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## FASE 3 · Setup Azure + verificación E2E

### Task 6: Admin consent en Azure Portal

**Este task no requiere código — es un checklist para el admin del tenant.**

- [ ] **Step 1: Abrir Portal Azure**

Ir a https://portal.azure.com → login con cuenta admin del tenant.

- [ ] **Step 2: Navegar a la app registrada de SoulForms**

Menú → Azure Active Directory (o Entra ID) → App registrations → buscar "SoulForms" (o el `CLIENT_ID` de `backend/.env`).

- [ ] **Step 3: Agregar el permiso Files.Read.All**

En la app registrada:
1. Menú lateral izquierdo → **API permissions**
2. Botón **+ Add a permission** → **Microsoft Graph** → **Application permissions** (no Delegated)
3. Buscar `Files.Read.All` → tildarlo → **Add permissions**

Ahora aparece en la lista con status "Not granted for [tenant]".

- [ ] **Step 4: Grant admin consent**

En la misma pantalla, botón **Grant admin consent for [tenant name]** (arriba de la tabla) → confirmar.

La columna Status debe cambiar a **"Granted for [tenant]"** con checkmark verde.

- [ ] **Step 5: Verificar (opcional pero recomendado)**

En PowerShell con un JWT admin:
```powershell
$token = "<JWT>"
$body = @{ url = "https://empresa.sharepoint.com/:x:/g/personal/..." } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/excel/headers" `
  -Headers @{Authorization="Bearer $token"} `
  -ContentType "application/json" -Body $body
```

Expected: `{ headers: [...] }` con los headers reales del Excel.

Si sigue saliendo error 502 con "Files.Read.All" → el admin consent no se aplicó correctamente; volver a Step 4 y verificar el status "Granted".

---

### Task 7: Verificación end-to-end en la app

- [ ] **Step 1: Reiniciar el backend con el código nuevo**

PowerShell como Admin:
```powershell
cd C:\proyectos\Soulmedical\backend
.\scripts\kill-zombies.ps1
.\scripts\start-backend.ps1
```

Verificar en el log que arrancó sin errores y que las rutas `POST /api/excel/headers` y `POST /api/excel/search` aparecen mapeadas:

```powershell
Get-Content 'C:\proyectos\Soulmedical\backend\logs\backend-*.log' | Select-String "excel"
```
Expected: 2 líneas mostrando las rutas mapeadas.

- [ ] **Step 2: Ctrl+F5 en la app y probar el widget**

1. Ir al builder de un formulario.
2. Agregar un widget search.
3. En "Fuente de datos" → seleccionar "📗 Excel en OneDrive/SharePoint".
4. Pegar la URL de un Excel real en SharePoint del tenant.
5. Debería aparecer "⏳ Detectando columnas…" y luego "✓ N columnas detectadas".
6. El dropdown "Columna donde buscar" debe mostrar los headers reales.
7. Configurar "Columnas a mostrar en resultados" — el dropdown debe tener los headers.
8. Guardar el formulario.

- [ ] **Step 3: Probar el flujo de búsqueda**

1. Abrir el formulario para llenarlo (no en builder, sino en `/form/...`).
2. Clic en el widget search → se abre el modal.
3. Escribir un término que exista en la columna configurada.
4. Verificar que aparecen resultados reales del Excel.
5. Seleccionar un registro → los campos configurados en "Rellenar campos al seleccionar" deben poblarse.

- [ ] **Step 4: Verificar el cache 60s**

1. Editar el Excel en SharePoint (cambiar un valor).
2. Inmediatamente buscar en el widget → verificar que aún aparece el valor viejo (cache).
3. Esperar 65 segundos.
4. Volver a buscar → debe aparecer el valor nuevo.

- [ ] **Step 5: Verificar rate limit**

Con el navegador abierto en la app + DevTools:
1. Refrescar el widget rápido varias veces (pegar URL, borrarla, pegar de nuevo, ...) más de 20 veces en un minuto.
2. Debería aparecer error 429 en la Network tab después del 20mo request a `/excel/headers`.

- [ ] **Step 6: Verificar el guard de permisos**

Con curl usando un JWT de un usuario SIN `FORMS_EDIT`:
```powershell
$tokenUsuarioNormal = "<JWT sin FORMS_EDIT>"
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/excel/headers" `
  -Headers @{Authorization="Bearer $tokenUsuarioNormal"} `
  -ContentType "application/json" -Body '{"url":"https://empresa.sharepoint.com/x"}'
```

Expected: 403 Forbidden.

---

## Cierre

- [ ] Todos los criterios de aceptación del spec ejecutados manualmente.
- [ ] `git log --oneline` muestra los 5 commits del plan (Task 1, 2, 3, 4, 5) + eventuales fixes.
- [ ] `cd backend; npm test` — tests del módulo excel pasan.
- [ ] Documentar en el README (si existe) o en memoria de la sesión: la app SoulForms requiere permiso `Files.Read.All` (Application) en Azure para el widget search con Excel.
