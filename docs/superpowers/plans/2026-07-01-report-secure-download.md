# Descarga segura de reportes — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el envío de reportes por correo con adjunto ZIP por un flujo: link único con TTL 2 min de un solo uso → verificación 2FA en la descarga → archivo `.xlsx` cifrado con OOXML AES-256 (password = `documentNumber` del usuario).

**Architecture:** El backend genera y guarda el `.xlsx` cifrado en una colección MongoDB nueva (`report_downloads`) con TTL index, envía por correo un link con token UUID. Al hacer clic, el frontend abre `ReportDownloadPage`, valida sesión + 2FA vía TOTP, consume el token en el backend y descarga el archivo. Todos los eventos quedan en la bitácora `admin_actions`.

**Tech Stack:** NestJS 11, TypeORM 0.3 (Postgres para users/audit), Mongoose 9 (Mongo para report_downloads), React 19, `secure-spreadsheet` (OOXML AES-256), `otplib` (TOTP existente), Microsoft Graph (correo existente).

## Global Constraints

- TTL del link: **exactamente 2 minutos** desde `create` hasta `expiresAt`.
- Cada token es de **un solo uso**: se marca `consumed = true` tras la primera descarga exitosa, o tras 3 intentos TOTP fallidos.
- Cifrado del archivo: **OOXML AES-256** (estándar Microsoft ECMA-376), usando `secure-spreadsheet`.
- Password del `.xlsx`: exactamente `user.documentNumber` sin transformaciones. Si el usuario no tiene, se rechaza la solicitud con `ForbiddenException`.
- Nombre del archivo: `Reporte_<formSanitized>_<YYYY-MM-DD_HH-MM>.xlsx` (mismos criterios que hoy).
- Colección Mongo: **`report_downloads`** con TTL index en `expiresAt` (`{ expires: 0 }`).
- 3 valores nuevos exactos en `AdminActionType`: `REPORT_REQUESTED`, `REPORT_DOWNLOADED`, `REPORT_DOWNLOAD_FAILED`. Sincronizar en frontend en `AdminAuditAction`.
- Rate limits:
  - `POST /forms/:formId/submissions/export-email`: 5 requests / 10 min por usuario.
  - `POST /reports/download/:token`: 10 requests / min por IP + máximo 3 intentos TOTP incorrectos por token.
  - `GET /reports/download/:token/meta`: 20 requests / min por IP.
- Variable de entorno usada para armar el link: `APP_BASE_URL` (ya existe, la usa reset password).
- Excepciones del service se mapean a HTTP así: no existe / user distinto / expirado / consumido → `NotFoundException` (404) desde `getMeta`; consumido/expirado en `consume` → `GoneException` (410); user distinto en `consume` → `ForbiddenException` (403); TOTP inválido → `UnauthorizedException` (401).
- **Sin migraciones SQL**. `admin_actions.action` es `varchar(64)` y acepta los strings nuevos sin cambio de schema.
- **Sin cambios al modelo User**. `documentNumber` ya existe de una sesión anterior.
- **Compatibilidad**: los correos ZIP ya enviados siguen abriéndose con el mismo documento. Este cambio afecta solo a solicitudes NUEVAS.

## File structure

**Backend — Nuevos**

- `backend/src/reports/report-download.schema.ts` — schema Mongoose de la colección `report_downloads`.
- `backend/src/reports/report-downloads.service.ts` — service `create` / `getMeta` / `consume` con atomicidad.
- `backend/src/reports/report-downloads.controller.ts` — endpoints `GET /reports/download/:token/meta` y `POST /reports/download/:token`.
- `backend/src/reports/xlsx-crypto.ts` — helper `encryptXlsxOoxml(buffer, password)` que envuelve `secure-spreadsheet`.

**Backend — Modificados**

- `backend/src/reports/reports.service.ts` — reemplaza `buildEncryptedZip()` por `encryptXlsxOoxml()`, ya no adjunta archivo al correo, guarda blob y llama a `sendReportLink()`.
- `backend/src/reports/reports.module.ts` — agrega `MongooseModule.forFeature([ReportDownload])`, registra `ReportDownloadsService` + `ReportDownloadsController`.
- `backend/src/email/email.types.ts` — tipo `SendReportLinkPayload`.
- `backend/src/email/email.service.ts` — método `sendReportLink()` + plantilla HTML nueva.
- `backend/src/admin-audit/admin-action.entity.ts` — 3 valores nuevos en `AdminActionType`.
- `backend/package.json` — dependencia `secure-spreadsheet`.

**Frontend — Nuevos**

- `src/pages/ReportDownloadPage.tsx` — pantalla `/reports/download/:token` con máquina de estados y timer visible.

**Frontend — Modificados**

- `src/router/AppRouter.tsx` — ruta pública `/reports/download/:token`.
- `src/services/api.ts` — funciones `getReportDownloadMetaApi()` y `downloadReportApi()`, sincronizar enum `AdminAuditAction` con las 3 acciones nuevas.
- `src/pages/ReportsPage.tsx` — mensaje de feedback tras solicitar.
- `src/pages/AdminAuditPage.tsx` — labels y colores de las 3 acciones nuevas.

**Docs — Modificados**

- El spec ya vive en `docs/superpowers/specs/2026-07-01-report-secure-download-design.md`.

---

### Task 1: Instalar `secure-spreadsheet` + helper `xlsx-crypto.ts`

**Files:**
- Modify: `backend/package.json` (dep)
- Create: `backend/src/reports/xlsx-crypto.ts`
- Create: `backend/src/reports/xlsx-crypto.spec.ts`

**Interfaces:**
- Produces: `encryptXlsxOoxml(xlsxBuffer: Buffer, password: string): Promise<Buffer>` — recibe un `.xlsx` en claro, devuelve el mismo `.xlsx` cifrado con OOXML AES-256 nativo. Excel/LibreOffice lo abrirán pidiendo `password`.

- [ ] **Step 1: Instalar dependencia**

Run:
```powershell
cd c:\proyectos\Soulmedical\backend
npm install secure-spreadsheet
```

Expected: `secure-spreadsheet` aparece en `dependencies` de `package.json`. Sin errores fatales.

- [ ] **Step 2: Escribir test que falla**

Create `backend/src/reports/xlsx-crypto.spec.ts`:
```ts
import * as ExcelJS from 'exceljs';
import { encryptXlsxOoxml } from './xlsx-crypto';

describe('encryptXlsxOoxml', () => {
  it('devuelve un buffer distinto al original y no vacio', async () => {
    // Genera un xlsx en claro de referencia
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('S');
    ws.addRow(['a', 'b']);
    ws.addRow([1, 2]);
    const plain = Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);

    const encrypted = await encryptXlsxOoxml(plain, 'test-password');

    expect(encrypted).toBeInstanceOf(Buffer);
    expect(encrypted.length).toBeGreaterThan(0);
    expect(encrypted.equals(plain)).toBe(false);
    // Los xlsx cifrados con OOXML empiezan con la firma OLE Compound
    // File "D0 CF 11 E0 A1 B1 1A E1" (docfile). Los xlsx en claro empiezan
    // con la firma ZIP "PK\x03\x04".
    expect(encrypted.slice(0, 4).toString('hex')).toBe('d0cf11e0');
  });
});
```

- [ ] **Step 3: Correr el test para confirmar que falla**

Run:
```powershell
cd c:\proyectos\Soulmedical\backend
npx jest src/reports/xlsx-crypto.spec.ts
```

Expected: FAIL con "Cannot find module './xlsx-crypto'".

- [ ] **Step 4: Implementar el helper**

Create `backend/src/reports/xlsx-crypto.ts`:
```ts
// eslint-disable-next-line @typescript-eslint/no-require-imports
const secure = require('secure-spreadsheet');

/**
 * Cifra un buffer XLSX en claro aplicando el estándar OOXML AES-256
 * (ECMA-376 4th ed. / ISO/IEC 29500). El resultado es un archivo Excel
 * cifrado nativo: al abrirlo, Excel/LibreOffice piden password.
 *
 * `password` es el que el usuario final tendrá que ingresar (en nuestro
 * flujo, el número de documento).
 */
export async function encryptXlsxOoxml(
  xlsxBuffer: Buffer,
  password: string,
): Promise<Buffer> {
  // secure-spreadsheet.encrypt devuelve un Buffer del xlsx cifrado.
  const result: Buffer = secure.encrypt({
    data: xlsxBuffer,
    password,
    type: 'xlsx',
  });
  return result;
}
```

- [ ] **Step 5: Correr test para verificar que pasa**

Run: `npx jest src/reports/xlsx-crypto.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add backend/package.json backend/package-lock.json backend/src/reports/xlsx-crypto.ts backend/src/reports/xlsx-crypto.spec.ts
git commit -m "reports: helper encryptXlsxOoxml con secure-spreadsheet (AES-256)"
```

---

### Task 2: Schema Mongoose `ReportDownload` con TTL index

**Files:**
- Create: `backend/src/reports/report-download.schema.ts`

**Interfaces:**
- Produces: clase `ReportDownload` + `ReportDownloadDocument` + `ReportDownloadSchema` con TTL index en `expiresAt`. Consumida por `report-downloads.service.ts` y por el `MongooseModule.forFeature` en `reports.module.ts`.

- [ ] **Step 1: Crear el schema**

Create `backend/src/reports/report-download.schema.ts`:
```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReportDownloadDocument = ReportDownload & Document;

/**
 * Blob temporal de un reporte solicitado. Vive máximo `expiresAt - createdAt`
 * (por diseño: 2 minutos). Mongo borra el documento automáticamente por el
 * TTL index. Un solo uso: se marca `consumed = true` tras entrega o tras
 * agotamiento de intentos TOTP.
 */
@Schema({
  collection: 'report_downloads',
  timestamps: { createdAt: true, updatedAt: false },
})
export class ReportDownload {
  @Prop({ type: String, default: () => crypto.randomUUID() })
  _id: string;

  @Prop({ required: true, index: true })
  userId: number;

  @Prop({ required: true })
  formId: string;

  @Prop({ required: true })
  formName: string;

  @Prop({ required: true, type: Buffer })
  encryptedBuffer: Buffer;

  @Prop({ required: true })
  filename: string;

  // TTL index: Mongo borra el documento (y el Buffer) cuando expiresAt < now.
  @Prop({ required: true, index: { expires: 0 } })
  expiresAt: Date;

  @Prop({ default: false })
  consumed: boolean;

  @Prop({ default: null })
  consumedAt: Date | null;

  // Contador de intentos TOTP fallidos. Al llegar a 3 se marca consumed=true.
  @Prop({ default: 0 })
  totpAttempts: number;

  @Prop({ default: null })
  createdIp: string | null;
}

export const ReportDownloadSchema = SchemaFactory.createForClass(ReportDownload);
```

- [ ] **Step 2: Verificar compilación**

Run: `cd c:\proyectos\Soulmedical\backend ; npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```powershell
git add backend/src/reports/report-download.schema.ts
git commit -m "reports: schema ReportDownload con TTL index"
```

---

### Task 3: `ReportDownloadsService` — create / getMeta / consume

**Files:**
- Create: `backend/src/reports/report-downloads.service.ts`
- Create: `backend/src/reports/report-downloads.service.spec.ts`

**Interfaces:**
- Consumes: `ReportDownload`, `ReportDownloadDocument` (Task 2).
- Produces:
  - `create(input: { userId, formId, formName, encryptedBuffer, filename, ttlMinutes, createdIp? }): Promise<{ token: string; expiresAt: Date }>`.
  - `getMeta(token: string, userId: number): Promise<{ formName: string; expiresAt: Date; totpAttempts: number }>` — `NotFoundException` si no existe / expirado / consumido / user distinto.
  - `consume(token: string, userId: number): Promise<{ buffer: Buffer; filename: string }>` — atómica: solo consume si `consumed=false` y `expiresAt>now`. `GoneException` si expirado/consumido; `ForbiddenException` si user distinto.
  - `incrementTotpAttempts(token: string): Promise<number>` — incrementa `totpAttempts`; si llega a 3 marca `consumed=true`. Devuelve el valor tras el increment.

- [ ] **Step 1: Escribir tests que fallan**

Create `backend/src/reports/report-downloads.service.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { GoneException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReportDownloadsService } from './report-downloads.service';
import { ReportDownload } from './report-download.schema';

describe('ReportDownloadsService', () => {
  // Fake modelo mínimo con las operaciones que usa el service.
  const store = new Map<string, any>();
  const model: any = {
    create: jest.fn(async (doc: any) => {
      const withId = { ...doc, _id: doc._id ?? 'tok-' + Math.random() };
      store.set(withId._id, withId);
      return withId;
    }),
    findOne: jest.fn(async (q: any) => {
      const d = store.get(q._id);
      if (!d) return null;
      if (q.userId !== undefined && d.userId !== q.userId) return null;
      if (q.consumed === false && d.consumed) return null;
      if (q.expiresAt && d.expiresAt <= q.expiresAt.$gt) return null;
      return d;
    }),
    findOneAndUpdate: jest.fn(async (q: any, update: any) => {
      const d = store.get(q._id);
      if (!d) return null;
      if (q.consumed === false && d.consumed) return null;
      if (q.expiresAt && d.expiresAt <= q.expiresAt.$gt) return null;
      Object.assign(d, update.$set ?? {});
      return d;
    }),
    updateOne: jest.fn(async (q: any, update: any) => {
      const d = store.get(q._id);
      if (!d) return { matchedCount: 0 };
      if (update.$inc) for (const k of Object.keys(update.$inc)) d[k] = (d[k] ?? 0) + update.$inc[k];
      if (update.$set) Object.assign(d, update.$set);
      return { matchedCount: 1 };
    }),
  };

  let svc: ReportDownloadsService;

  beforeEach(async () => {
    store.clear();
    const mod = await Test.createTestingModule({
      providers: [
        ReportDownloadsService,
        { provide: getModelToken(ReportDownload.name), useValue: model },
      ],
    }).compile();
    svc = mod.get(ReportDownloadsService);
    jest.clearAllMocks();
  });

  it('create devuelve token y expiresAt en el futuro', async () => {
    const before = Date.now();
    const { token, expiresAt } = await svc.create({
      userId: 1, formId: 'f', formName: 'F',
      encryptedBuffer: Buffer.from('x'), filename: 'x.xlsx',
      ttlMinutes: 2,
    });
    expect(token).toEqual(expect.any(String));
    expect(expiresAt.getTime()).toBeGreaterThan(before + 60_000);
  });

  it('getMeta 404 si token no existe', async () => {
    await expect(svc.getMeta('nope', 1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getMeta 404 si user distinto', async () => {
    const { token } = await svc.create({
      userId: 1, formId: 'f', formName: 'F',
      encryptedBuffer: Buffer.from('x'), filename: 'x.xlsx', ttlMinutes: 2,
    });
    await expect(svc.getMeta(token, 999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('consume entrega el buffer y marca consumed', async () => {
    const buf = Buffer.from('report');
    const { token } = await svc.create({
      userId: 1, formId: 'f', formName: 'F',
      encryptedBuffer: buf, filename: 'r.xlsx', ttlMinutes: 2,
    });
    const out = await svc.consume(token, 1);
    expect(out.buffer.equals(buf)).toBe(true);
    // Un segundo consume debe fallar con Gone.
    await expect(svc.consume(token, 1)).rejects.toBeInstanceOf(GoneException);
  });

  it('consume 403 si user distinto', async () => {
    const { token } = await svc.create({
      userId: 1, formId: 'f', formName: 'F',
      encryptedBuffer: Buffer.from('x'), filename: 'x.xlsx', ttlMinutes: 2,
    });
    await expect(svc.consume(token, 999)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('incrementTotpAttempts marca consumed al 3er intento', async () => {
    const { token } = await svc.create({
      userId: 1, formId: 'f', formName: 'F',
      encryptedBuffer: Buffer.from('x'), filename: 'x.xlsx', ttlMinutes: 2,
    });
    expect(await svc.incrementTotpAttempts(token)).toBe(1);
    expect(await svc.incrementTotpAttempts(token)).toBe(2);
    expect(await svc.incrementTotpAttempts(token)).toBe(3);
    // Después del 3er intento, consume() debe fallar con Gone.
    await expect(svc.consume(token, 1)).rejects.toBeInstanceOf(GoneException);
  });
});
```

- [ ] **Step 2: Correr tests para confirmar que fallan**

Run: `npx jest src/reports/report-downloads.service.spec.ts`
Expected: FAIL con "Cannot find module './report-downloads.service'".

- [ ] **Step 3: Implementar el service**

Create `backend/src/reports/report-downloads.service.ts`:
```ts
import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReportDownload, ReportDownloadDocument } from './report-download.schema';

export type CreateReportDownloadInput = {
  userId: number;
  formId: string;
  formName: string;
  encryptedBuffer: Buffer;
  filename: string;
  ttlMinutes: number;
  createdIp?: string | null;
};

const MAX_TOTP_ATTEMPTS = 3;

@Injectable()
export class ReportDownloadsService {
  constructor(
    @InjectModel(ReportDownload.name)
    private readonly model: Model<ReportDownloadDocument>,
  ) {}

  async create(
    input: CreateReportDownloadInput,
  ): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + input.ttlMinutes * 60_000);
    const doc = await this.model.create({
      userId: input.userId,
      formId: input.formId,
      formName: input.formName,
      encryptedBuffer: input.encryptedBuffer,
      filename: input.filename,
      expiresAt,
      consumed: false,
      totpAttempts: 0,
      createdIp: input.createdIp ?? null,
    });
    return { token: doc._id as string, expiresAt };
  }

  /**
   * Metadata sin exponer el buffer. Usada por la pantalla de verificación
   * 2FA para armar la UI. Fallamos con 404 en TODOS los casos negativos
   * para no revelar si el token existe (defensa contra enumeración).
   */
  async getMeta(
    token: string,
    userId: number,
  ): Promise<{ formName: string; expiresAt: Date; totpAttempts: number }> {
    const doc = await this.model.findOne({
      _id: token,
      userId,
      consumed: false,
      expiresAt: { $gt: new Date() },
    });
    if (!doc) throw new NotFoundException('Enlace no válido');
    return {
      formName: doc.formName,
      expiresAt: doc.expiresAt,
      totpAttempts: doc.totpAttempts,
    };
  }

  /**
   * Consumo atómico: findOneAndUpdate garantiza que solo un request gana
   * la carrera si llegan dos simultáneamente. Si otro usuario intenta
   * consumir el token de alguien más → 403 (revela que existe, pero requerir
   * autenticación previa lo mitiga; el `consumed` NO se toca por eso).
   */
  async consume(
    token: string,
    userId: number,
  ): Promise<{ buffer: Buffer; filename: string }> {
    // Verifica ownership primero para dar 403 explícito.
    const preview = await this.model.findOne({ _id: token });
    if (preview && preview.userId !== userId) {
      throw new ForbiddenException('Enlace no válido');
    }
    const doc = await this.model.findOneAndUpdate(
      {
        _id: token,
        userId,
        consumed: false,
        expiresAt: { $gt: new Date() },
      },
      { $set: { consumed: true, consumedAt: new Date() } },
      { new: false },
    );
    if (!doc) throw new GoneException('Enlace expirado o ya usado');
    return { buffer: doc.encryptedBuffer, filename: doc.filename };
  }

  /**
   * Incrementa el contador de intentos TOTP. Al llegar a 3, marca el token
   * como consumido para prevenir fuerza bruta del código TOTP.
   * Devuelve el nuevo valor tras el increment.
   */
  async incrementTotpAttempts(token: string): Promise<number> {
    await this.model.updateOne(
      { _id: token, consumed: false },
      { $inc: { totpAttempts: 1 } },
    );
    const doc = await this.model.findOne({ _id: token });
    const attempts = doc?.totpAttempts ?? 0;
    if (attempts >= MAX_TOTP_ATTEMPTS && doc && !doc.consumed) {
      await this.model.updateOne(
        { _id: token },
        { $set: { consumed: true, consumedAt: new Date() } },
      );
    }
    return attempts;
  }
}
```

- [ ] **Step 4: Correr tests para verificar que pasan**

Run: `npx jest src/reports/report-downloads.service.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```powershell
git add backend/src/reports/report-downloads.service.ts backend/src/reports/report-downloads.service.spec.ts
git commit -m "reports: ReportDownloadsService con create/getMeta/consume atomicos"
```

---

### Task 4: Nuevos valores en `AdminActionType`

**Files:**
- Modify: `backend/src/admin-audit/admin-action.entity.ts:11-19`

**Interfaces:**
- Produces: 3 valores nuevos en `AdminActionType` (`REPORT_REQUESTED`, `REPORT_DOWNLOADED`, `REPORT_DOWNLOAD_FAILED`). El enum ya se usa desde `admin-audit.service.log()`.

- [ ] **Step 1: Añadir valores al enum**

Edit `backend/src/admin-audit/admin-action.entity.ts`:

Reemplazar el bloque del enum:
```ts
export enum AdminActionType {
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  USER_TOGGLE_ACTIVE = 'USER_TOGGLE_ACTIVE',
  USER_PERMISSIONS_CHANGE = 'USER_PERMISSIONS_CHANGE',
  USER_RESET_2FA = 'USER_RESET_2FA',
  FORM_DELETE = 'FORM_DELETE',
  FORM_TOGGLE_PUBLIC = 'FORM_TOGGLE_PUBLIC',
}
```

por:
```ts
export enum AdminActionType {
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  USER_TOGGLE_ACTIVE = 'USER_TOGGLE_ACTIVE',
  USER_PERMISSIONS_CHANGE = 'USER_PERMISSIONS_CHANGE',
  USER_RESET_2FA = 'USER_RESET_2FA',
  FORM_DELETE = 'FORM_DELETE',
  FORM_TOGGLE_PUBLIC = 'FORM_TOGGLE_PUBLIC',
  REPORT_REQUESTED = 'REPORT_REQUESTED',
  REPORT_DOWNLOADED = 'REPORT_DOWNLOADED',
  REPORT_DOWNLOAD_FAILED = 'REPORT_DOWNLOAD_FAILED',
}
```

- [ ] **Step 2: Verificar compilación**

Run: `cd c:\proyectos\Soulmedical\backend ; npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```powershell
git add backend/src/admin-audit/admin-action.entity.ts
git commit -m "audit: enum AdminActionType agregar REPORT_REQUESTED/DOWNLOADED/FAILED"
```

---

### Task 5: `sendReportLink` en `EmailService` + tipo

**Files:**
- Modify: `backend/src/email/email.types.ts` (append tipo)
- Modify: `backend/src/email/email.service.ts` (nuevo método + plantilla HTML)

**Interfaces:**
- Consumes: —
- Produces:
  - `SendReportLinkPayload = { to: string; userName: string; formName: string; url: string; expiresInMinutes: number }` (nuevo).
  - `emailService.sendReportLink(payload: SendReportLinkPayload): Promise<SendEmailResult>` — envía correo con botón "Descargar reporte", advertencia de TTL y de 2FA. Consumido por `ReportsService`.

- [ ] **Step 1: Añadir el tipo**

Edit `backend/src/email/email.types.ts` — añadir al final del archivo (después del último tipo existente):
```ts

export type SendReportLinkPayload = {
  to: string;
  userName: string;
  formName: string;
  url: string;
  expiresInMinutes: number;
};
```

- [ ] **Step 2: Importar el tipo en email.service**

En `backend/src/email/email.service.ts`, añadir `SendReportLinkPayload` a la lista de imports (arriba del archivo, en el bloque `import type { ... } from './email.types'`).

- [ ] **Step 3: Añadir el método al service**

En `backend/src/email/email.service.ts`, insertar antes del último `private buildXxxHtml` o al final de los métodos públicos:
```ts
  /**
   * Envía el correo con el link único de descarga del reporte. NO adjunta
   * el archivo — el .xlsx cifrado vive en `report_downloads` y se entrega
   * cuando el usuario clic el link, autentica con 2FA y consume el token.
   */
  async sendReportLink(
    payload: SendReportLinkPayload,
  ): Promise<SendEmailResult> {
    if (!payload.to?.trim() || !EMAIL_REGEX.test(payload.to.trim())) {
      throw new BadRequestException('El destinatario no es un email válido');
    }
    const html = this.buildReportLinkHtml(
      payload.userName,
      payload.formName,
      payload.url,
      payload.expiresInMinutes,
    );

    await this.sendViaGraph({
      subject: `Descarga de reporte: ${payload.formName}`,
      htmlBody: html,
      toList: [{ emailAddress: { address: payload.to.trim().toLowerCase() } }],
      ccList: [],
      bccList: [],
      attachments: [],
    });

    this.logger.log(
      `Link de reporte enviado a ${payload.to} formulario="${payload.formName}"`,
    );
    return { success: true, message: 'Link de reporte enviado', recipients: 1 };
  }

  private buildReportLinkHtml(
    userName: string,
    formName: string,
    url: string,
    expiresInMinutes: number,
  ): string {
    const safeUser = (userName ?? '').trim() || 'usuario';
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background:#f0f4f8; padding:20px;">
  <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#00c2a8,#0891b2); padding:22px; text-align:center; color:#fff;">
      <h1 style="margin:0; font-size:20px;">📊 Tu reporte está listo</h1>
    </div>
    <div style="padding:28px; color:#374151; line-height:1.6; font-size:14px;">
      <p>Hola ${safeUser},</p>
      <p>Ya está disponible tu reporte del formulario <strong>${formName}</strong>. Para descargarlo haz click en el botón:</p>
      <p style="text-align:center; margin:24px 0;">
        <a href="${url}" style="display:inline-block; padding:14px 32px; background:#00c2a8; color:#fff; text-decoration:none; border-radius:10px; font-weight:700; font-size:15px;">Descargar reporte</a>
      </p>
      <div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:12px 14px; margin:18px 0; border-radius:0 6px 6px 0;">
        <strong>⏱ Tienes ${expiresInMinutes} minuto${expiresInMinutes === 1 ? '' : 's'}</strong><br>
        El link expira automáticamente y solo funciona una vez. Si el tiempo pasa, solicita el reporte de nuevo desde la app.
      </div>
      <div style="background:#eff6ff; border-left:4px solid #0891b2; padding:12px 14px; margin:18px 0; border-radius:0 6px 6px 0;">
        <strong>🔐 Verificación al descargar</strong><br>
        Al clic en el link, la app te pedirá el código de 6 dígitos de tu app authenticator (2FA). Luego se descargará un archivo Excel cifrado. Para abrirlo, Excel te pedirá tu <strong>número de documento</strong> como contraseña.
      </div>
      <p style="font-size:12px; color:#9ca3af; margin-top:24px;">Este es un envío automático. No respondas a este correo.</p>
    </div>
  </div>
</body>
</html>`;
  }
```

- [ ] **Step 4: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/email/email.types.ts backend/src/email/email.service.ts
git commit -m "email: sendReportLink con plantilla HTML (TTL + 2FA + password)"
```

---

### Task 6: Modificar `ReportsService.exportSubmissionsAndEmail` al nuevo flujo

**Files:**
- Modify: `backend/src/reports/reports.service.ts` (reemplazar `buildEncryptedZip` por `encryptXlsxOoxml`, guardar blob + enviar link, auditar `REPORT_REQUESTED`)

**Interfaces:**
- Consumes:
  - `encryptXlsxOoxml` (Task 1)
  - `ReportDownloadsService.create` (Task 3)
  - `AdminActionType.REPORT_REQUESTED` (Task 4)
  - `emailService.sendReportLink` (Task 5)
  - `AdminAuditService.log` (ya existe)
- Produces: comportamiento actualizado del endpoint existente `POST /forms/:formId/submissions/export-email`. La respuesta al frontend cambia el `message` a "Enviamos el enlace a tu correo. Tienes N minutos para descargarlo."

- [ ] **Step 1: Actualizar imports en el service**

Edit `backend/src/reports/reports.service.ts`. En el bloque de imports (arriba) reemplazar:
```ts
import * as archiver from 'archiver';
import * as archiverZipEncrypted from 'archiver-zip-encrypted';
```

por:
```ts
import { encryptXlsxOoxml } from './xlsx-crypto';
import { ReportDownloadsService } from './report-downloads.service';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import {
  AdminActionTargetType,
  AdminActionType,
} from '../admin-audit/admin-action.entity';
```

Y eliminar el bloque `ensureZipEncryptedRegistered` y `buildEncryptedZip` (todo desde `let formatRegistered = false;` hasta el cierre de `buildEncryptedZip`).

- [ ] **Step 2: Actualizar constructor para inyectar los nuevos services**

En el `constructor(...)` del `ReportsService`, añadir:
```ts
    private readonly reportDownloads: ReportDownloadsService,
    private readonly auditService: AdminAuditService,
```

- [ ] **Step 3: Reemplazar la lógica del método principal**

En `reports.service.ts`, reemplazar el método `exportSubmissionsAndEmail` completo por:
```ts
  async exportSubmissionsAndEmail(
    userId: number,
    formId: string,
    fieldIds: string[],
  ): Promise<{ success: boolean; message: string; recipients: number }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.documentNumber?.trim()) {
      throw new ForbiddenException(
        'Debes tener un número de documento registrado para solicitar reportes. Pide a un administrador que te lo agregue.',
      );
    }
    if (!user.email?.trim()) {
      throw new BadRequestException(
        'Tu cuenta no tiene un correo válido para enviar el reporte.',
      );
    }

    const form = await this.formsService.findOne(formId);
    const schema = (form.schema as { widgets?: Widget[] } | undefined) ?? {};
    const widgets: Widget[] = Array.isArray(schema.widgets) ? schema.widgets : [];

    const requestedSet = new Set(fieldIds);
    const orderedFields = widgets.filter(
      (w) => w?.id && w.label && requestedSet.has(w.id),
    );
    if (orderedFields.length === 0) {
      throw new BadRequestException(
        'Debes seleccionar al menos un campo para exportar.',
      );
    }

    // 1) Excel en claro con exceljs
    const xlsxBuffer = await this.buildXlsxBuffer(form.name, formId, orderedFields);

    // 2) Cifrado OOXML AES-256 con la contraseña del usuario (documento)
    const encryptedBuffer = await encryptXlsxOoxml(
      xlsxBuffer,
      user.documentNumber.trim(),
    );

    const filename = `${this.sanitizeFilename(form.name)}_${this.timestamp()}.xlsx`;
    const ttlMinutes = 2;

    // 3) Guardar el blob en Mongo con TTL
    const { token, expiresAt } = await this.reportDownloads.create({
      userId,
      formId,
      formName: form.name,
      encryptedBuffer,
      filename,
      ttlMinutes,
    });

    // 4) Auditar la solicitud
    await this.auditService.log({
      actor: { id: userId, name: user.email, role: user.role },
      action: AdminActionType.REPORT_REQUESTED,
      targetType: AdminActionTargetType.FORM,
      targetId: formId,
      targetName: form.name,
      metadata: {
        fieldCount: orderedFields.length,
        tokenId: token,
        expiresAt,
      },
    });

    // 5) Enviar correo con link único
    const appBaseUrl =
      process.env.APP_BASE_URL || 'http://localhost:5173';
    const url = `${appBaseUrl.replace(/\/$/, '')}/reports/download/${token}`;

    await this.emailService.sendReportLink({
      to: user.email,
      userName: user.name,
      formName: form.name,
      url,
      expiresInMinutes: ttlMinutes,
    });

    return {
      success: true,
      message: `Enviamos el enlace a tu correo. Tienes ${ttlMinutes} minutos para descargarlo antes de que expire.`,
      recipients: 1,
    };
  }
```

- [ ] **Step 4: Verificar compilación**

Run: `cd c:\proyectos\Soulmedical\backend ; npx tsc --noEmit`
Expected: puede mostrar errores por falta de providers en el module — se resuelven en el Task 7. Cero errores en `reports.service.ts` mismo.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/reports/reports.service.ts
git commit -m "reports: nuevo flujo con OOXML AES-256 y link unico (sin adjunto)"
```

---

### Task 7: `ReportDownloadsController` + registrar módulo + rate limiting

**Files:**
- Create: `backend/src/reports/report-downloads.controller.ts`
- Modify: `backend/src/reports/reports.module.ts`

**Interfaces:**
- Consumes:
  - `ReportDownloadsService` (Task 3), `AdminAuditService`, `UsersService`, `TotpService`.
- Produces:
  - Endpoint `GET /api/reports/download/:token/meta` → `{ formName, expiresAt }`.
  - Endpoint `POST /api/reports/download/:token` (body `{ code: string }`) → streamea el `.xlsx` cifrado con `Content-Disposition: attachment; filename="..."`.

- [ ] **Step 1: Crear el controller**

Create `backend/src/reports/report-downloads.controller.ts`:
```ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TotpService } from '../auth/totp.service';
import { UsersService } from '../users/users.service';
import { ReportDownloadsService } from './report-downloads.service';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import {
  AdminActionTargetType,
  AdminActionType,
} from '../admin-audit/admin-action.entity';

@UseGuards(JwtAuthGuard)
@Controller('reports/download')
export class ReportDownloadsController {
  constructor(
    private readonly reportDownloads: ReportDownloadsService,
    private readonly totpService: TotpService,
    private readonly usersService: UsersService,
    private readonly auditService: AdminAuditService,
  ) {}

  // Devuelve solo metadata; sirve para que el frontend arme la pantalla
  // de verificación 2FA (mostrar nombre del form + timer).
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':token/meta')
  async meta(
    @Param('token') token: string,
    @Req() req: { user: { id: number } },
  ) {
    return this.reportDownloads.getMeta(token, Number(req.user.id));
  }

  /**
   * Verifica el código TOTP del usuario y, si es correcto, consume el token
   * y envía el buffer cifrado como archivo adjunto. En cualquier error
   * registramos REPORT_DOWNLOAD_FAILED con la causa; en éxito, DOWNLOADED.
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':token')
  async download(
    @Param('token') token: string,
    @Body() body: { code: string },
    @Req() req: { user: { id: number } },
    @Res() res: Response,
  ) {
    const userId = Number(req.user.id);
    const user = await this.usersService.findById(userId);

    const failLog = (reason: string) =>
      this.auditService.log({
        actor: {
          id: userId,
          name: user?.email ?? `user#${userId}`,
          role: user?.role ?? 'user',
        },
        action: AdminActionType.REPORT_DOWNLOAD_FAILED,
        targetType: AdminActionTargetType.FORM,
        targetId: token,
        targetName: null,
        metadata: { reason },
      });

    if (!user || !user.totpEnabled || !user.totpSecret) {
      await failLog('2fa_not_active');
      throw new UnauthorizedException(
        'Debes tener 2FA activo para descargar reportes.',
      );
    }
    const cleaned = (body?.code ?? '').replace(/\s+/g, '');
    if (cleaned.length !== 6) {
      await failLog('invalid_totp');
      throw new UnauthorizedException('Código incorrecto.');
    }
    const valid = await this.totpService.verifyToken(cleaned, user.totpSecret);
    if (!valid) {
      const attempts = await this.reportDownloads.incrementTotpAttempts(token);
      await failLog(attempts >= 3 ? 'exhausted' : 'invalid_totp');
      throw new UnauthorizedException('Código incorrecto.');
    }

    let out;
    try {
      out = await this.reportDownloads.consume(token, userId);
    } catch (err) {
      // 410 Gone o 403; en ambos casos registramos.
      const reason =
        (err as { status?: number })?.status === 403
          ? 'wrong_user'
          : 'expired';
      await failLog(reason);
      throw err;
    }

    await this.auditService.log({
      actor: { id: userId, name: user.email, role: user.role },
      action: AdminActionType.REPORT_DOWNLOADED,
      targetType: AdminActionTargetType.FORM,
      targetId: token,
      targetName: out.filename,
      metadata: { bytesServed: out.buffer.length },
    });

    res
      .status(200)
      .setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(out.filename)}"`,
      )
      .setHeader('Content-Length', out.buffer.length.toString())
      .end(out.buffer);
  }
}
```

- [ ] **Step 2: Actualizar `reports.module.ts` con los nuevos providers**

Reemplazar `backend/src/reports/reports.module.ts` completo por:
```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportDownloadsService } from './report-downloads.service';
import { ReportDownloadsController } from './report-downloads.controller';
import { ReportDownload, ReportDownloadSchema } from './report-download.schema';
import { UsersModule } from '../users/users.module';
import { FormsModule } from '../forms/forms.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { EmailModule } from '../email/email.module';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReportDownload.name, schema: ReportDownloadSchema },
    ]),
    UsersModule,
    FormsModule,
    SubmissionsModule,
    EmailModule,
    AdminAuditModule,
    AuthModule, // para TotpService y JwtAuthGuard
  ],
  providers: [ReportsService, ReportDownloadsService, PermissionsGuard],
  controllers: [ReportsController, ReportDownloadsController],
})
export class ReportsModule {}
```

- [ ] **Step 3: Verificar que `AuthModule` exporta `TotpService`**

Read `backend/src/auth/auth.module.ts`. Confirmar que en el array `exports:` está `TotpService`. Si NO está, editar el módulo para añadirlo:

En el `exports: [...]` de `AuthModule`, añadir `TotpService`. Si `exports` no existe, crearlo así:
```ts
  exports: [TotpService],
```

- [ ] **Step 4: Compilar el backend**

Run: `cd c:\proyectos\Soulmedical\backend ; npm run build`
Expected: `nest build` termina sin errores.

- [ ] **Step 5: Reiniciar backend y verificar que arranca**

Run:
```powershell
pm2 restart soulforms-backend
Start-Sleep -Seconds 3
netstat -ano | findstr :3001
```
Expected: el puerto 3001 aparece en estado `LISTENING`.

Si NO aparece: revisar `Get-Content "$env:USERPROFILE\.pm2\logs\soulforms-backend-error.log" -Tail 40` para detectar `UndefinedModuleException` u otros errores de bootstrap.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/reports/report-downloads.controller.ts backend/src/reports/reports.module.ts backend/src/auth/auth.module.ts
git commit -m "reports: controller de descarga con TOTP + registro en auditoria"
```

---

### Task 8: Frontend — API client `getReportDownloadMetaApi` + `downloadReportApi` + enum audit

**Files:**
- Modify: `src/services/api.ts`

**Interfaces:**
- Consumes: endpoints de Task 7.
- Produces:
  - Type: `AdminAuditAction` incluye 3 valores nuevos.
  - Function: `getReportDownloadMetaApi(token: string): Promise<ApiResponse<{ formName: string; expiresAt: string }>>`.
  - Function: `downloadReportApi(token: string, code: string): Promise<ApiResponse<{ blob: Blob; filename: string }>>` — devuelve el Blob del archivo cifrado y el filename parseado de `Content-Disposition`.

- [ ] **Step 1: Actualizar el tipo `AdminAuditAction`**

En `src/services/api.ts`, localizar la definición de `AdminAuditAction` y reemplazar por:
```ts
export type AdminAuditAction =
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'USER_TOGGLE_ACTIVE'
  | 'USER_PERMISSIONS_CHANGE'
  | 'USER_RESET_2FA'
  | 'FORM_DELETE'
  | 'FORM_TOGGLE_PUBLIC'
  | 'REPORT_REQUESTED'
  | 'REPORT_DOWNLOADED'
  | 'REPORT_DOWNLOAD_FAILED';
```

- [ ] **Step 2: Añadir `getReportDownloadMetaApi`**

En `src/services/api.ts`, añadir después de `requestReportByEmailApi`:
```ts
export type ReportDownloadMeta = {
  formName: string;
  expiresAt: string; // ISO date
};

export async function getReportDownloadMetaApi(token: string) {
  return request<ReportDownloadMeta>(`/reports/download/${token}/meta`);
}
```

- [ ] **Step 3: Añadir `downloadReportApi`**

En el mismo archivo, después de la anterior:
```ts
/**
 * POST al endpoint de descarga. El backend responde con el `.xlsx` cifrado
 * como blob binario. NO usamos la función `request<T>` común porque no
 * devuelve JSON. Aquí manejamos fetch manual para poder capturar el blob.
 */
export async function downloadReportApi(
  token: string,
  code: string,
): Promise<{ data: { blob: Blob; filename: string } | null; error: string | null }> {
  const jwt = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

  try {
    const res = await fetch(`${API_URL}/reports/download/${token}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { data: null, error: body.message || `Error ${res.status}` };
    }

    const blob = await res.blob();
    // Extraer filename del Content-Disposition (RFC 5987 con encodeURIComponent).
    const disp = res.headers.get('Content-Disposition') ?? '';
    const match = disp.match(/filename="([^"]+)"/);
    const filename = match ? decodeURIComponent(match[1]) : 'reporte.xlsx';
    return { data: { blob, filename }, error: null };
  } catch {
    return { data: null, error: 'No se pudo conectar con el servidor' };
  }
}
```

- [ ] **Step 4: Verificar TypeScript**

Run: `cd c:\proyectos\Soulmedical ; npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```powershell
git add src/services/api.ts
git commit -m "api: getReportDownloadMetaApi + downloadReportApi + enum audit REPORT_*"
```

---

### Task 9: Componente `ReportDownloadPage.tsx`

**Files:**
- Create: `src/pages/ReportDownloadPage.tsx`

**Interfaces:**
- Consumes: `getReportDownloadMetaApi`, `downloadReportApi` (Task 8), `useAuthStore`, `useParams`, `useNavigate` (React Router).
- Produces: componente exportado por defecto. Se enruta en Task 10.

- [ ] **Step 1: Crear el componente**

Create `src/pages/ReportDownloadPage.tsx`:
```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import {
  downloadReportApi,
  getReportDownloadMetaApi,
} from "../services/api";

type State =
  | { kind: "loading" }
  | { kind: "not_logged_in" }
  | { kind: "ready"; formName: string; expiresAt: number }
  | { kind: "verify_2fa"; formName: string; expiresAt: number }
  | { kind: "downloading"; formName: string }
  | { kind: "done"; filename: string }
  | { kind: "expired" }
  | { kind: "error"; message: string };

const ACCENT_GRADIENT = "linear-gradient(135deg,#00c2a8,#0891b2)";
const ACCENT = "#00c2a8";
const SHADOW = "rgba(0,194,168,0.35)";

export default function ReportDownloadPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.currentUser);

  const [state, setState] = useState<State>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  // Timer visible: se actualiza cada segundo. Al llegar a 0, la UI cambia a expired.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!token) {
      setState({ kind: "error", message: "Enlace inválido." });
      return;
    }
    if (!user) {
      setState({ kind: "not_logged_in" });
      return;
    }
    (async () => {
      const res = await getReportDownloadMetaApi(token);
      if (res.error || !res.data) {
        setState({ kind: "expired" });
        return;
      }
      setState({
        kind: "ready",
        formName: res.data.formName,
        expiresAt: new Date(res.data.expiresAt).getTime(),
      });
    })();
  }, [token, user]);

  // Reset "verify_2fa" → "expired" cuando el reloj pasa expiresAt.
  useEffect(() => {
    if (state.kind !== "ready" && state.kind !== "verify_2fa") return;
    if (now >= state.expiresAt) {
      setState({ kind: "expired" });
    }
  }, [now, state]);

  const remainingLabel = useMemo(() => {
    if (state.kind !== "ready" && state.kind !== "verify_2fa") return "";
    const remaining = Math.max(0, state.expiresAt - now);
    const s = Math.floor(remaining / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [state, now]);

  const handleGoToVerify = () => {
    if (state.kind !== "ready") return;
    setState({ kind: "verify_2fa", formName: state.formName, expiresAt: state.expiresAt });
    setTimeout(() => codeInputRef.current?.focus(), 30);
  };

  const handleVerifyAndDownload = async () => {
    if (state.kind !== "verify_2fa" || !token) return;
    if (busy) return;
    const cleaned = code.replace(/\s+/g, "");
    if (cleaned.length !== 6) {
      setCodeError("El código debe tener 6 dígitos.");
      return;
    }
    setBusy(true);
    setCodeError("");
    const res = await downloadReportApi(token, cleaned);
    setBusy(false);
    if (res.error || !res.data) {
      setCodeError(res.error ?? "No se pudo descargar el reporte.");
      setCode("");
      return;
    }
    // Descarga: crea objectURL invisible y dispara click.
    setState({ kind: "downloading", formName: state.formName });
    const url = URL.createObjectURL(res.data.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.data.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setState({ kind: "done", filename: res.data.filename });
  };

  const goLogin = () => {
    const returnTo = window.location.pathname;
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4 font-sans">
      <div className="w-full max-w-[440px] rounded-2xl bg-white px-8 py-9 shadow-[0_12px_40px_rgba(0,0,0,0.1)]">
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-[26px] text-white"
            style={{ background: ACCENT_GRADIENT, boxShadow: `0 4px 14px ${SHADOW}` }}
          >
            📊
          </div>
          <h1 className="m-0 text-lg font-bold text-slate-900">Descarga de reporte</h1>
        </div>

        {state.kind === "loading" && (
          <p className="text-center text-sm text-slate-400">Cargando…</p>
        )}

        {state.kind === "not_logged_in" && (
          <>
            <p className="mb-4 text-center text-[13px] text-slate-600">
              Debes iniciar sesión para descargar el reporte.
            </p>
            <button
              onClick={goLogin}
              className="w-full rounded-[10px] py-[13px] text-[15px] font-bold text-white"
              style={{ background: ACCENT_GRADIENT, boxShadow: `0 4px 16px ${SHADOW}` }}
            >
              Iniciar sesión →
            </button>
          </>
        )}

        {state.kind === "ready" && (
          <>
            <p className="mb-1 text-center text-[13px] text-slate-600">
              Formulario:
            </p>
            <p className="mb-4 text-center text-base font-semibold text-slate-900">
              {state.formName}
            </p>
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-center text-[12px] text-amber-800">
              ⏱ Expira en <strong>{remainingLabel}</strong>
            </div>
            <p className="mb-5 text-center text-[12px] leading-relaxed text-slate-500">
              Al confirmar, se te pedirá el código de tu app authenticator.
              Luego recibirás un archivo Excel cifrado. Para abrirlo, Excel
              te pedirá tu <strong>número de documento</strong> como contraseña.
            </p>
            <button
              onClick={handleGoToVerify}
              className="w-full rounded-[10px] py-[13px] text-[15px] font-bold text-white"
              style={{ background: ACCENT_GRADIENT, boxShadow: `0 4px 16px ${SHADOW}` }}
            >
              Verificar 2FA y descargar →
            </button>
          </>
        )}

        {state.kind === "verify_2fa" && (
          <>
            <p className="mb-1 text-center text-[13px] text-slate-600">
              Formulario:
            </p>
            <p className="mb-3 text-center text-base font-semibold text-slate-900">
              {state.formName}
            </p>
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-center text-[11px] text-amber-800">
              ⏱ Expira en <strong>{remainingLabel}</strong>
            </div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] text-gray-700">
              Código de 6 dígitos
            </label>
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyAndDownload()}
              placeholder="000000"
              className="mb-4 w-full rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 px-[14px] py-3 text-center font-mono text-[20px] tracking-[0.5em] text-slate-900 outline-none focus:border-current focus:bg-white"
              style={{ color: ACCENT }}
            />
            {codeError && (
              <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-[14px] py-2.5 text-sm text-red-600">
                ⚠️ {codeError}
              </div>
            )}
            <button
              onClick={handleVerifyAndDownload}
              disabled={busy || code.length !== 6}
              className="w-full rounded-[10px] py-[13px] text-[15px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: busy ? "#94a3b8" : ACCENT_GRADIENT,
                boxShadow: busy ? "none" : `0 4px 16px ${SHADOW}`,
              }}
            >
              {busy ? "Descargando…" : "Descargar reporte →"}
            </button>
          </>
        )}

        {state.kind === "downloading" && (
          <p className="text-center text-[13px] text-slate-500">
            Descargando reporte de <strong>{state.formName}</strong>…
          </p>
        )}

        {state.kind === "done" && (
          <>
            <p className="mb-2 text-center text-base font-semibold text-emerald-700">
              ✅ Reporte descargado
            </p>
            <p className="mb-4 text-center text-[12.5px] text-slate-600">
              Revisa tu carpeta de descargas: <br />
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-800">
                {state.filename}
              </code>
            </p>
            <p className="mb-5 text-center text-[12px] text-slate-500">
              Para abrirlo en Excel, la contraseña es tu <strong>número de documento</strong>.
            </p>
            <button
              onClick={() => navigate("/")}
              className="w-full rounded-[10px] border-[1.5px] border-slate-200 bg-white py-2.5 text-[13px] font-semibold text-gray-600"
            >
              Volver a la app
            </button>
          </>
        )}

        {state.kind === "expired" && (
          <>
            <p className="mb-4 text-center text-base font-semibold text-red-600">
              Enlace no válido o expirado
            </p>
            <p className="mb-5 text-center text-[12.5px] text-slate-500">
              El link es de un solo uso y expira en 2 minutos. Solicita el reporte de nuevo desde la app.
            </p>
            <button
              onClick={() => navigate("/")}
              className="w-full rounded-[10px] py-[13px] text-[15px] font-bold text-white"
              style={{ background: ACCENT_GRADIENT, boxShadow: `0 4px 16px ${SHADOW}` }}
            >
              Volver a la app →
            </button>
          </>
        )}

        {state.kind === "error" && (
          <p className="text-center text-[13px] text-red-600">
            ⚠️ {state.message}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `cd c:\proyectos\Soulmedical ; npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```powershell
git add src/pages/ReportDownloadPage.tsx
git commit -m "reports: ReportDownloadPage con maquina de estados + timer + 2FA"
```

---

### Task 10: Registrar ruta `/reports/download/:token` en `AppRouter`

**Files:**
- Modify: `src/router/AppRouter.tsx`

**Interfaces:**
- Consumes: `ReportDownloadPage` (Task 9).
- Produces: ruta pública `/reports/download/:token` que renderiza `ReportDownloadPage`. La página maneja internamente el estado "no logueado" mostrando un botón que navega a `/login?returnTo=/reports/download/<token>`.

- [ ] **Step 1: Importar el componente**

En `src/router/AppRouter.tsx`, añadir junto a los otros imports de páginas:
```ts
import ReportDownloadPage from "../pages/ReportDownloadPage";
```

- [ ] **Step 2: Registrar la ruta**

Localizar el bloque `<Routes>` en el componente. Añadir esta ruta junto a las otras rutas públicas (`/task/:token`, `/f/:formId`):
```tsx
      <Route path="/reports/download/:token" element={<ReportDownloadPage />} />
```

- [ ] **Step 3: Verificar TypeScript**

Run: `cd c:\proyectos\Soulmedical ; npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```powershell
git add src/router/AppRouter.tsx
git commit -m "router: nueva ruta publica /reports/download/:token"
```

---

### Task 11: Actualizar `ReportsPage.tsx` con nuevo mensaje

**Files:**
- Modify: `src/pages/ReportsPage.tsx`

**Interfaces:**
- Consumes: `requestReportByEmailApi` (ya existe).
- Produces: mensaje al usuario que refleja el flujo nuevo (link con TTL, requiere 2FA, luego documento). El endpoint del backend responde `message` con la copia oficial; el frontend simplemente muestra ese mensaje y añade un tip visual.

- [ ] **Step 1: Ajustar el aviso de seguridad y el feedback**

En `src/pages/ReportsPage.tsx`, buscar el bloque JSX del "Aviso de seguridad" (empieza con `{/* Aviso de seguridad */}`) y reemplazar por:
```tsx
          {/* Aviso de seguridad */}
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3.5">
            <span className="text-lg">🔐</span>
            <div className="text-[12px] leading-relaxed text-blue-900">
              <div className="font-semibold">
                Descarga por enlace de un solo uso
              </div>
              <div className="mt-0.5 text-blue-800">
                Te enviamos un enlace a tu correo que dura <strong>2 minutos</strong>.
                Al clicearlo pediremos tu <strong>código 2FA</strong> y descargarás un archivo Excel cifrado. Para abrirlo, Excel te pedirá tu <strong>número de documento</strong>.
              </div>
            </div>
          </div>
```

- [ ] **Step 2: Cambiar el label del botón (opcional pero coherente)**

En el mismo archivo, buscar el botón `Enviar a mi correo` y cambiar el label a `Solicitar reporte →` (opcional; puede quedar igual).

- [ ] **Step 3: Verificar TypeScript**

Run: `cd c:\proyectos\Soulmedical ; npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```powershell
git add src/pages/ReportsPage.tsx
git commit -m "reports: mensaje UI refleja nuevo flujo link+2FA+documento"
```

---

### Task 12: Labels de las 3 acciones nuevas en `AdminAuditPage`

**Files:**
- Modify: `src/pages/AdminAuditPage.tsx`

**Interfaces:**
- Consumes: enum `AdminAuditAction` de `api.ts` (Task 8).
- Produces: labels y colores para las 3 acciones nuevas en la tabla de auditoría.

- [ ] **Step 1: Añadir entradas en `ACTION_LABELS`**

En `src/pages/AdminAuditPage.tsx`, localizar el `const ACTION_LABELS: Record<AdminAuditAction, string> = { ... }` y añadir al objeto:
```ts
  REPORT_REQUESTED: "Reporte solicitado",
  REPORT_DOWNLOADED: "Reporte descargado",
  REPORT_DOWNLOAD_FAILED: "Descarga de reporte fallida",
```

- [ ] **Step 2: Añadir entradas en `ACTION_COLORS`**

En el `const ACTION_COLORS: Record<AdminAuditAction, string> = { ... }` añadir:
```ts
  REPORT_REQUESTED: "#0891b2",
  REPORT_DOWNLOADED: "#059669",
  REPORT_DOWNLOAD_FAILED: "#dc2626",
```

- [ ] **Step 3: Verificar TypeScript**

Run: `cd c:\proyectos\Soulmedical ; npx tsc --noEmit`
Expected: sin errores. Si el `Record<AdminAuditAction, string>` faltaba una key, TypeScript hubiera detectado el faltante — verifica que las 3 nuevas queden agregadas en AMBOS objetos.

- [ ] **Step 4: Commit**

```powershell
git add src/pages/AdminAuditPage.tsx
git commit -m "audit: labels y colores para REPORT_REQUESTED/DOWNLOADED/FAILED"
```

---

### Task 13: Build final + reinicio + prueba end-to-end manual

**Files:**
- ninguno (solo ejecución y validación).

**Interfaces:**
- Producto final: todo el flujo funciona end-to-end.

- [ ] **Step 1: Build frontend**

Run:
```powershell
cd c:\proyectos\Soulmedical
npm run build
```
Expected: `✓ built in ...s`. Ignorar warning de chunk > 500 KB (preexistente).

- [ ] **Step 2: Build backend**

Run:
```powershell
cd c:\proyectos\Soulmedical\backend
npm run build
```
Expected: `nest build` sin errores.

- [ ] **Step 3: Reiniciar procesos**

Run:
```powershell
pm2 restart soulforms-backend soulforms-frontend
Start-Sleep -Seconds 3
netstat -ano | findstr :3001
```
Expected: `LISTENING` en 3001. Si no: `Get-Content "$env:USERPROFILE\.pm2\logs\soulforms-backend-error.log" -Tail 40`.

- [ ] **Step 4: Prueba manual — camino feliz**

En el navegador:
1. `Ctrl+F5` para invalidar cache.
2. Ir a `Reporte` → seleccionar proyecto/carpeta/formulario → marcar campos → **Solicitar reporte**.
3. Verificar que la UI muestra el mensaje "Enviamos el enlace a tu correo. Tienes 2 minutos…".
4. Abrir el correo (menos de 1 min desde el envío). Debe contener el botón "Descargar reporte" y las cajas amarilla (TTL) + azul (2FA + documento).
5. Click en el botón → llega a `/reports/download/<token>`.
6. Ver pantalla `ready` con nombre del formulario y contador descendente.
7. Click "Verificar 2FA y descargar" → pantalla `verify_2fa`.
8. Ingresar código TOTP de la app authenticator → botón "Descargar reporte".
9. El navegador descarga `Reporte_<form>_<timestamp>.xlsx`.
10. Doble click en el archivo → Excel/LibreOffice pide contraseña.
11. Ingresar número de documento del usuario → Excel abre el reporte con las columnas seleccionadas.

- [ ] **Step 5: Prueba manual — casos negativos**

Repetir el flujo 4 veces con estas variantes, cada una debe fallar en el punto esperado:

a) **Sin login**: cerrar sesión → clic en el link → debe redirigir a `/login` con `returnTo`.
b) **Otro usuario**: entrar como user distinto → clic en el link → pantalla "Enlace no válido".
c) **Timeout**: solicitar reporte → esperar 2 min completos → clic en el link → pantalla `expired`.
d) **TOTP incorrecto**: ingresar código mal 3 veces → 3ª vez el token queda invalidado permanentemente. Reintentar con código correcto → sale "Enlace no válido".

- [ ] **Step 6: Verificar entradas en Auditoría**

Ir a `Reporte de acciones` → filtrar por Acción = `Reporte solicitado`. Debe aparecer una entrada por cada solicitud del Step 4/5 con actor y timestamp correctos. Click en "Ver" para expandir metadata.

Filtrar también por `Reporte descargado` y `Descarga de reporte fallida`.

- [ ] **Step 7: Verificar limpieza TTL en Mongo**

Después de 3 minutos desde la última solicitud, verificar que la colección `report_downloads` está vacía o solo contiene documentos de solicitudes menores a 2 minutos:
```powershell
# Desde MongoDB Shell o Compass, ejecutar:
# use soulformsdb
# db.report_downloads.count()
```
Expected: 0 después de que expiren todos los tokens.

- [ ] **Step 8: Commit final del changelog opcional**

Si quieres, actualiza `BITACORA-CONVERSACION.md` con una entrada de este release. No es obligatorio.

```powershell
git commit --allow-empty -m "release: descarga segura de reportes (link + 2FA + OOXML AES-256)"
```

---

## Self-review checklist (para el ejecutor)

Antes de merge o entrega, correr por última vez:

- [ ] `cd c:\proyectos\Soulmedical\backend ; npx tsc --noEmit` → sin errores.
- [ ] `cd c:\proyectos\Soulmedical ; npx tsc --noEmit` → sin errores.
- [ ] `cd c:\proyectos\Soulmedical\backend ; npx jest src/reports` → todos verdes.
- [ ] Camino feliz manual completado (Task 13 Step 4).
- [ ] Auditoría muestra REPORT_REQUESTED + REPORT_DOWNLOADED (Task 13 Step 6).
- [ ] Colección `report_downloads` se vacía tras el TTL (Task 13 Step 7).
