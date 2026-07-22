# Historial de PDFs por envío — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una tabla dentro de `/reports` que liste todos los envíos de un formulario, con preview modal + descarga del PDF individual, y descarga masiva por link+2FA+documento. Cada PDF se regenera con el formato original del envío (versionado transparente).

**Architecture:** El submission guarda `templateSnapshot` (HTML del pdfTemplate con placeholders `${label}`) al momento del envío. Al pedir el PDF, backend interpola snapshot + data + resuelve imágenes GridFS → Puppeteer → PDF. La descarga masiva empaqueta N PDFs en un ZIP AES-256 y reutiliza el flujo link+2FA existente (schema `SecureDownload` con `kind`).

**Tech Stack:** NestJS 11 + Mongoose 9 + Puppeteer + archiver-zip-encrypted, React 19 + TypeScript + Vite + Tailwind, TypeORM 0.3 para auditoría (PostgreSQL).

## Global Constraints

- Endpoints de descarga requieren JWT + `Permission.REPORTS_VIEW`. La descarga individual además auditoría; la masiva además 2FA + documento + link único 2 min TTL.
- Rate limits: individual 30/min por usuario, masivo 1/min por usuario, meta 10/min, POST download 5/min.
- Toda interpolación HTML en correos usa `escapeHtml()` (helper existente).
- Toda mutación de `admin_actions` usa `AdminAuditService.record()` (no insertar directo).
- Cero placeholders V1/V2 en la UI — el versionado es transparente.
- Límite duro de 500 PDFs por bulk, concurrencia 3 renders simultáneos.
- Contraseña del ZIP masivo = `user.documentNumber` (403 si el usuario no tiene documento).

---

## Estructura de archivos

**Nuevos:**
- `backend/src/submissions/records.controller.ts`
- `backend/src/submissions/records.service.ts`
- `backend/src/submissions/records.service.spec.ts`
- `backend/src/submissions/pdf-interpolator.ts`
- `backend/src/submissions/pdf-interpolator.spec.ts`
- `backend/src/submissions/bulk-pdf.service.ts`
- `backend/src/submissions/bulk-pdf.service.spec.ts`
- `backend/src/submissions/zip-crypto.ts`
- `backend/src/submissions/zip-crypto.spec.ts`
- `src/hooks/useFormRecords.ts`
- `src/hooks/usePdfPreview.ts`
- `src/components/reports/RecordsTable.tsx`
- `src/components/reports/PdfPreviewModal.tsx`
- `src/components/reports/BulkPdfButton.tsx`
- `src/components/reports/ReportsTabs.tsx`
- `src/pages/RecordsDownloadPage.tsx`

**Modificados:**
- `backend/src/submissions/form-submission.schema.ts` (rename campo)
- `backend/src/submissions/dto/create-submission.dto.ts` (rename campo)
- `backend/src/submissions/submissions.service.ts` (rename + quitar métodos huérfanos)
- `backend/src/submissions/submissions.controller.ts` (quitar `findMine`)
- `backend/src/submissions/submissions.module.ts` (agregar RecordsController + providers)
- `backend/src/submissions/pdf-renderer.service.ts` (sin cambios funcionales; interpolador nuevo lo usa)
- `backend/src/admin-audit/admin-action.entity.ts` (5 enums nuevos)
- `backend/src/reports/report-download.schema.ts` → renombrar clase a `SecureDownload`
- `backend/src/reports/report-downloads.service.ts` → renombrar clase a `SecureDownloadsService`
- `backend/src/reports/report-downloads.controller.ts` → renombrar clase; ruta base `/secure-downloads/:token`
- `backend/src/reports/reports.module.ts` (rename)
- `backend/src/reports/reports.service.ts` (ajustar import del renombrado)
- `src/store/useSubmissionsStore.ts` (rename `htmlSnapshot` → `templateSnapshot`)
- `src/pages/FormPage.tsx` (rename)
- `src/pages/ReportsPage.tsx` (envolver con pestañas)
- `src/router/AppRouter.tsx` (nueva ruta pública `/records/download/:token`)
- `src/router/routes/LoginRoute.tsx` (safe-list extendida)
- `src/services/api.ts` (5 nuevas funciones + rename de `AdminAuditAction` union)
- `src/pages/AdminAuditPage.tsx` (labels + colores para 5 nuevas acciones)

**Eliminados:**
- `src/pages/useSubmissionsStore.ts` (duplicado exacto de `src/store/`)

---

## FASE 0 · Limpieza y fix de la sesión previa

### Task 0.1: Rename `htmlSnapshot` → `templateSnapshot` y borrar duplicado

**Files:**
- Delete: `src/pages/useSubmissionsStore.ts`
- Modify: `backend/src/submissions/form-submission.schema.ts`
- Modify: `backend/src/submissions/dto/create-submission.dto.ts`
- Modify: `src/store/useSubmissionsStore.ts`
- Modify: `src/services/api.ts` (firma `submitFormApi`)
- Modify: `src/pages/FormPage.tsx`

**Interfaces:**
- Produces: `FormSubmission.templateSnapshot: string | null` (Mongoose), `templateSnapshot?: string` en `CreateSubmissionDto` y en `submitFormApi(formId, data, apiKey?, templateSnapshot?, pdfFilename?)`.

- [ ] **Step 1: Verificar que el duplicado no se importa desde ningún lado**

Run:
```powershell
Get-ChildItem -Recurse -Include *.ts,*.tsx -Path src | Select-String "from ['""].*pages/useSubmissionsStore"
```
Expected: sin resultados.

- [ ] **Step 2: Borrar el duplicado**

```powershell
Remove-Item src/pages/useSubmissionsStore.ts
```

- [ ] **Step 3: Rename en schema**

Editar `backend/src/submissions/form-submission.schema.ts`, reemplazar el bloque `htmlSnapshot`:

```ts
// ── Snapshot del template HTML del momento del envío ─────────────────────
// Se guarda el pdfTemplate con placeholders ${label} SIN interpolar,
// para poder regenerar el PDF con el formato original aunque el template
// del formulario cambie más adelante. Peso típico 2-20 KB (no incluye
// binarios: firmas/fotos siguen en GridFS con referencia gridfs:<id>).
// null si el formulario no tiene pdfTemplate configurado.
@Prop({ type: String, default: null })
templateSnapshot: string | null;

@Prop({ type: String, default: null })
pdfFilename: string | null;
```

- [ ] **Step 4: Rename en DTO**

Editar `backend/src/submissions/dto/create-submission.dto.ts`:

```ts
import { IsObject, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSubmissionDto {
  @IsObject()
  @IsNotEmpty()
  data: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  // HTML del pdfTemplate con placeholders ${label} SIN interpolar, capturado
  // por el frontend en el momento del envío. Peso típico 2-20 KB.
  @IsString()
  @IsOptional()
  templateSnapshot?: string;

  // Nombre sugerido para el PDF al descargar (con placeholders ya resueltos).
  @IsString()
  @IsOptional()
  pdfFilename?: string;
}
```

- [ ] **Step 5: Rename en submissions.service `submit()`**

En `backend/src/submissions/submissions.service.ts`, dentro de `submit()`:

```ts
const submission = new this.submissionModel({
  formId,
  formVersion: form.version,
  data,
  metadata: dto.metadata ?? null,
  submittedById: userId ?? null,
  templateSnapshot: dto.templateSnapshot ?? null,
  pdfFilename: dto.pdfFilename ?? null,
});
```

- [ ] **Step 6: Rename en frontend store**

En `src/store/useSubmissionsStore.ts`, cambiar la firma de `addSubmission` y la llamada a `submitFormApi`:

```ts
addSubmission: (
  submission: Omit<FormSubmission, "id" | "submittedAt">,
  templateSnapshot?: string,
  pdfFilename?: string,
) => Promise<void>;

// ...

addSubmission: async (submission, templateSnapshot, pdfFilename) => {
  set({ submitting: true });
  const { data, error } = await submitFormApi(
    submission.formId,
    submission.data as Record<string, unknown>,
    undefined,
    templateSnapshot,
    pdfFilename,
  );
  // ... resto igual
}
```

- [ ] **Step 7: Rename en api.ts `submitFormApi`**

En `src/services/api.ts`, buscar `submitFormApi` y actualizar la firma + el body:

```ts
export async function submitFormApi(
  formId: string,
  data: Record<string, unknown>,
  apiKey?: string,
  templateSnapshot?: string,
  pdfFilename?: string,
): Promise<ApiResponse<SubmissionData>> {
  const body: Record<string, unknown> = { data };
  if (templateSnapshot) body.templateSnapshot = templateSnapshot;
  if (pdfFilename) body.pdfFilename = pdfFilename;
  return request<SubmissionData>(`/forms/${formId}/submissions`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: apiKey ? { "X-API-Key": apiKey } : undefined,
  });
}
```

- [ ] **Step 8: Rename en FormPage.tsx**

En `src/pages/FormPage.tsx`, cambiar las 2 variables locales y el call:

```ts
let templateSnapshot: string | undefined;
let pdfFilename: string | undefined;

if (template?.attachPDF && template?.pdfTemplate?.trim()) {
  try {
    // Se guarda el TEMPLATE sin interpolar; la interpolación se hace en el
    // backend al momento de generar el PDF, combinando template + data +
    // resolución de imágenes desde GridFS.
    templateSnapshot = template.pdfTemplate;
    const labeledDataForSnapshot = expandFormData(widgets, data, hiddenWidgetIds);
    pdfFilename = renderFilename(template.pdfFilename, labeledDataForSnapshot);
  } catch (e) {
    console.warn("No se pudo capturar el snapshot del PDF:", e);
  }
}

addSubmission(
  { formId, folderId, data: data as Record<string, string> },
  templateSnapshot,
  pdfFilename,
);
```

Nota importante: **ya no interpolamos** el template en el frontend antes de guardarlo. Guardamos el pdfTemplate en crudo con sus `${...}` placeholders.

- [ ] **Step 9: Build y typecheck**

```powershell
cd backend; npm run build; cd ..
npm run build
```
Expected: 0 errores.

- [ ] **Step 10: Commit**

```powershell
git add -A
git commit -m "refactor(submissions): rename htmlSnapshot to templateSnapshot y borrar duplicado

- El campo guarda el pdfTemplate SIN interpolar (no el HTML final).
  La interpolacion + resolucion de imagenes se hara en el backend al
  generar el PDF, evitando duplicar binarios en el snapshot.
- Elimina src/pages/useSubmissionsStore.ts (duplicado exacto del store).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 0.2: Quitar métodos huérfanos del submissions.service

**Files:**
- Modify: `backend/src/submissions/submissions.service.ts` (borrar 4 métodos)
- Modify: `backend/src/submissions/submissions.controller.ts` (borrar `findMine`)
- Modify: `backend/src/submissions/submissions.module.ts` (remover imports no usados)

**Interfaces:**
- Consumes: schema con `templateSnapshot` (Task 0.1)
- Produces: `SubmissionsService` con métodos `submit`, `findByForm`, `findOne`, `findAll`, `countByForm`, `exportByForm` (y helper `offloadBinaries`). Sin `generatePdf`, `bulkPdfEmail`, `getHtmlSnapshot`, `findByUser`.

- [ ] **Step 1: Borrar los 4 métodos huérfanos**

En `backend/src/submissions/submissions.service.ts`, eliminar completamente:
- El bloque `// ── PDF individual ────` y el método `getHtmlSnapshot`
- El método `generatePdf`
- El bloque `// ── Descarga masiva por correo ─` y los métodos `bulkPdfEmail` + `buildZip`
- El método `findByUser`
- Los helpers `sanitize` y `timestamp` (solo se usaban ahí)

- [ ] **Step 2: Quitar dependencias del constructor que ya no se usan**

El constructor queda:

```ts
constructor(
  @InjectModel(FormSubmission.name)
  private readonly submissionModel: Model<FormSubmissionDocument>,
  private readonly formsService: FormsService,
  private readonly filesService: FilesService,
) {}
```

(Se van `PdfRendererService`, `EmailService`, `UsersService`, `Logger`; también borrar los imports arriba de esos).

- [ ] **Step 3: Borrar `findMine` del controller**

En `backend/src/submissions/submissions.controller.ts`, eliminar el bloque:

```ts
// Envíos hechos por el usuario logueado (vista "Enviados")
@UseGuards(JwtAuthGuard)
@Get('submissions/mine/list')
findMine(...) { ... }
```

Y el import de `UnauthorizedException` si ya no se usa.

- [ ] **Step 4: Ajustar el módulo**

En `backend/src/submissions/submissions.module.ts`, quitar imports/providers que ya no aplican:

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FormSubmission, FormSubmissionSchema } from './form-submission.schema';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { FormsModule } from '../forms/forms.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FormSubmission.name, schema: FormSubmissionSchema },
    ]),
    FormsModule,
    ApiKeysModule,
    FilesModule,
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, ApiKeyGuard],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
```

(EmailModule, UsersModule y PdfRendererService se restablecen en Fase 1/3 cuando se necesiten).

- [ ] **Step 5: Build**

```powershell
cd backend; npm run build; cd ..
```
Expected: 0 errores.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "chore(submissions): quitar metodos huerfanos y adjunto-por-correo

- bulkPdfEmail viejo enviaba ZIP como attachment (contradice el patron
  link+2FA que ya usamos para el reporte Excel). Se reemplaza en Fase 3.
- generatePdf/getHtmlSnapshot/findByUser no tenian endpoints y quedaban
  como codigo muerto. Se reintroducen bien en Fase 1.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## FASE 1 · Backend endpoints individuales

### Task 1.1: Nuevas acciones de auditoría

**Files:**
- Modify: `backend/src/admin-audit/admin-action.entity.ts`
- Modify: `src/services/api.ts` (union `AdminAuditAction`)
- Modify: `src/pages/AdminAuditPage.tsx` (labels + colores)

**Interfaces:**
- Produces: 5 constantes de `AdminActionType`: `SUBMISSION_PDF_VIEWED`, `SUBMISSION_PDF_DOWNLOADED`, `SUBMISSIONS_BULK_PDF_REQUESTED`, `SUBMISSIONS_BULK_PDF_DOWNLOADED`, `SUBMISSIONS_BULK_PDF_FAILED`.

- [ ] **Step 1: Agregar los 5 enums**

En `backend/src/admin-audit/admin-action.entity.ts`, dentro del enum `AdminActionType`:

```ts
export enum AdminActionType {
  // ... existentes
  REPORT_REQUESTED = 'REPORT_REQUESTED',
  REPORT_DOWNLOADED = 'REPORT_DOWNLOADED',
  REPORT_DOWNLOAD_FAILED = 'REPORT_DOWNLOAD_FAILED',
  SUBMISSION_PDF_VIEWED = 'SUBMISSION_PDF_VIEWED',
  SUBMISSION_PDF_DOWNLOADED = 'SUBMISSION_PDF_DOWNLOADED',
  SUBMISSIONS_BULK_PDF_REQUESTED = 'SUBMISSIONS_BULK_PDF_REQUESTED',
  SUBMISSIONS_BULK_PDF_DOWNLOADED = 'SUBMISSIONS_BULK_PDF_DOWNLOADED',
  SUBMISSIONS_BULK_PDF_FAILED = 'SUBMISSIONS_BULK_PDF_FAILED',
}
```

Agregar también un nuevo valor al `AdminActionTargetType`:

```ts
export enum AdminActionTargetType {
  USER = 'USER',
  FORM = 'FORM',
  PROJECT = 'PROJECT',
  FOLDER = 'FOLDER',
  SUBMISSION = 'SUBMISSION',
}
```

- [ ] **Step 2: Sincronizar el union del frontend**

En `src/services/api.ts`, buscar el tipo `AdminAuditAction` y añadir los 5:

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
  | 'REPORT_DOWNLOAD_FAILED'
  | 'SUBMISSION_PDF_VIEWED'
  | 'SUBMISSION_PDF_DOWNLOADED'
  | 'SUBMISSIONS_BULK_PDF_REQUESTED'
  | 'SUBMISSIONS_BULK_PDF_DOWNLOADED'
  | 'SUBMISSIONS_BULK_PDF_FAILED';
```

- [ ] **Step 3: Labels y colores en la UI**

En `src/pages/AdminAuditPage.tsx`, buscar los mapas `LABELS` y `COLORS` y añadir:

```ts
const LABELS: Record<AdminAuditAction, string> = {
  // ... existentes
  SUBMISSION_PDF_VIEWED: 'Vio PDF de registro',
  SUBMISSION_PDF_DOWNLOADED: 'Descargó PDF de registro',
  SUBMISSIONS_BULK_PDF_REQUESTED: 'Solicitó descarga masiva de PDFs',
  SUBMISSIONS_BULK_PDF_DOWNLOADED: 'Descargó ZIP masivo de PDFs',
  SUBMISSIONS_BULK_PDF_FAILED: 'Falló descarga de PDFs (2FA o TTL)',
};

const COLORS: Record<AdminAuditAction, string> = {
  // ... existentes
  SUBMISSION_PDF_VIEWED: 'bg-blue-50 text-blue-700',
  SUBMISSION_PDF_DOWNLOADED: 'bg-teal-50 text-teal-700',
  SUBMISSIONS_BULK_PDF_REQUESTED: 'bg-purple-50 text-purple-700',
  SUBMISSIONS_BULK_PDF_DOWNLOADED: 'bg-emerald-50 text-emerald-700',
  SUBMISSIONS_BULK_PDF_FAILED: 'bg-red-50 text-red-700',
};
```

- [ ] **Step 4: Build**

```powershell
cd backend; npm run build; cd ..
npm run build
```
Expected: 0 errores.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "audit: agregar 5 acciones para descarga de PDFs individuales y masivos

Nueva TargetType SUBMISSION. Labels y colores en la UI de admin-audit.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 1.2: Interpolador de template + resolución de GridFS

**Files:**
- Create: `backend/src/submissions/pdf-interpolator.ts`
- Create: `backend/src/submissions/pdf-interpolator.spec.ts`

**Interfaces:**
- Consumes: `FilesService.download(fileId: string): Promise<{buffer: Buffer, contentType: string}>` (verificar firma exacta en `backend/src/files/files.service.ts` antes de usar)
- Produces: `interpolatePdfTemplate({template, data, widgets, filesService}): Promise<string>` (devuelve HTML listo para Puppeteer).

- [ ] **Step 1: Verificar firma real de `FilesService.download`**

Run:
```powershell
Select-String "async download" backend/src/files/files.service.ts
```
Expected: método con firma `download(fileId: string)` (ajustar el paso 3 si el nombre difiere).

- [ ] **Step 2: Escribir tests**

Crear `backend/src/submissions/pdf-interpolator.spec.ts`:

```ts
import { interpolatePdfTemplate } from './pdf-interpolator';

describe('interpolatePdfTemplate', () => {
  const filesService = {
    download: jest.fn(),
  } as any;

  beforeEach(() => filesService.download.mockReset());

  const widgets = [
    { id: 'w1', type: 'text', label: 'Paciente' },
    { id: 'w2', type: 'text', label: 'Documento' },
    { id: 'wsig', type: 'signature', label: 'Firma' },
  ];

  it('reemplaza placeholders ${label} con valores string escapando HTML', async () => {
    const html = await interpolatePdfTemplate({
      template: '<p>Hola \${paciente} <${documento}></p>',
      data: { w1: 'María <b>López</b>', w2: 'CC 1234' },
      widgets,
      filesService,
    });
    expect(html).toContain('María &lt;b&gt;López&lt;/b&gt;');
    expect(html).toContain('&lt;CC 1234&gt;');
  });

  it('resuelve referencia gridfs:<id> desde FilesService y embebe como data-URL', async () => {
    filesService.download.mockResolvedValue({
      buffer: Buffer.from([1, 2, 3]),
      contentType: 'image/png',
    });
    const html = await interpolatePdfTemplate({
      template: '<div>${firma}</div>',
      data: { wsig: 'gridfs:abc123' },
      widgets,
      filesService,
    });
    expect(html).toContain('<img src="data:image/png;base64,AQID"');
    expect(filesService.download).toHaveBeenCalledWith('abc123');
  });

  it('conserva data-URLs pre-existentes en el snapshot (retrocompat)', async () => {
    const html = await interpolatePdfTemplate({
      template: '<div>${firma}</div>',
      data: { wsig: 'data:image/png;base64,ZZZ' },
      widgets,
      filesService,
    });
    expect(html).toContain('<img src="data:image/png;base64,ZZZ"');
  });

  it('deja placeholder sin resolver como cadena vacía', async () => {
    const html = await interpolatePdfTemplate({
      template: '<p>${desconocido}</p>',
      data: {},
      widgets,
      filesService,
    });
    expect(html).toBe('<p></p>');
  });
});
```

- [ ] **Step 3: Correr tests (deben fallar por módulo inexistente)**

```powershell
cd backend
npx jest src/submissions/pdf-interpolator.spec.ts
cd ..
```
Expected: FAIL "Cannot find module './pdf-interpolator'".

- [ ] **Step 4: Implementar el interpolador**

Crear `backend/src/submissions/pdf-interpolator.ts`:

```ts
import { FilesService } from '../files/files.service';

type Widget = { id: string; type: string; label?: string };

type Input = {
  template: string;
  data: Record<string, unknown>;
  widgets: Widget[];
  filesService: FilesService;
};

const GRIDFS_PREFIX = 'gridfs:';
const IMG_STYLE =
  'max-height:80px;max-width:100%;object-fit:contain;display:block;';

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/gi, '');
}

/**
 * Combina el template HTML (con placeholders `${slug}`) + los datos del envío
 * (`widgetId → value`) + resolución de referencias `gridfs:<id>` → data-URL,
 * y devuelve el HTML listo para enviar a Puppeteer.
 */
export async function interpolatePdfTemplate(input: Input): Promise<string> {
  const { template, data, widgets, filesService } = input;

  // Mapa slug(label) → widgetId para expandir ${paciente} → data[widgetId]
  const bySlug = new Map<string, Widget>();
  for (const w of widgets) {
    if (w.label) bySlug.set(slugLabel(w.label), w);
  }

  // Resolver cada placeholder (async por gridfs)
  const parts: Array<string | Promise<string>> = [];
  let last = 0;
  const re = /\$\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(template))) {
    parts.push(template.slice(last, match.index));
    parts.push(resolveValue(match[1], data, bySlug, filesService));
    last = re.lastIndex;
  }
  parts.push(template.slice(last));

  const resolved = await Promise.all(parts.map(async (p) => await p));
  return resolved.join('');
}

async function resolveValue(
  key: string,
  data: Record<string, unknown>,
  bySlug: Map<string, Widget>,
  filesService: FilesService,
): Promise<string> {
  const widget = bySlug.get(key);
  const value = widget ? data[widget.id] : undefined;
  if (value == null) return '';
  const str = typeof value === 'string' ? value : JSON.stringify(value);

  if (str.startsWith('data:image/')) {
    return `<img src="${str}" style="${IMG_STYLE}">`;
  }

  if (str.startsWith(GRIDFS_PREFIX)) {
    const fileId = str.slice(GRIDFS_PREFIX.length);
    try {
      const { buffer, contentType } = await filesService.download(fileId);
      const b64 = buffer.toString('base64');
      return `<img src="data:${contentType};base64,${b64}" style="${IMG_STYLE}">`;
    } catch {
      return '<span style="color:#999">[imagen no disponible]</span>';
    }
  }

  return escapeHtml(str);
}
```

- [ ] **Step 5: Correr tests (deben pasar)**

```powershell
cd backend
npx jest src/submissions/pdf-interpolator.spec.ts
cd ..
```
Expected: 4 tests passed.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/submissions/pdf-interpolator.ts backend/src/submissions/pdf-interpolator.spec.ts
git commit -m "feat(submissions): interpolador de pdfTemplate con resolucion GridFS

Combina template + data + resuelve referencias gridfs:<id> a data-URL.
Escape HTML por defecto para prevenir XSS en datos del usuario.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 1.3: RecordsService — listado paginado con filtros

**Files:**
- Create: `backend/src/submissions/records.service.ts`
- Create: `backend/src/submissions/records.service.spec.ts`

**Interfaces:**
- Consumes: `FormSubmission` model, `FormsService.findOne(id)`, `UsersService.findByIds(ids: number[])`
- Produces:
  - `RecordsService.listByForm(formId, opts): Promise<RecordsPage>`
  - Tipos: `RecordRow { id, submittedAt, userName, summary: Record<string,string>, hasPdf }`, `RecordsPage { data: RecordRow[], total, page, limit }`

- [ ] **Step 1: Verificar firma de `UsersService.findByIds`**

Run:
```powershell
Select-String "findByIds|findManyByIds|findMany" backend/src/users/users.service.ts
```

Si no existe un método así, crear uno mínimo en `UsersService`:

```ts
async findByIds(ids: number[]): Promise<Record<number, { name: string; email: string }>> {
  if (!ids.length) return {};
  const users = await this.usersRepo.find({ where: { id: In(ids) }, select: ['id','name','email'] });
  const out: Record<number, { name: string; email: string }> = {};
  for (const u of users) out[u.id] = { name: u.name, email: u.email };
  return out;
}
```

(agregar `import { In } from 'typeorm';` arriba). Este cambio va en el mismo commit del step 6.

- [ ] **Step 2: Escribir tests**

Crear `backend/src/submissions/records.service.spec.ts`:

```ts
import { RecordsService } from './records.service';

describe('RecordsService', () => {
  const model: any = {
    find: jest.fn(),
    countDocuments: jest.fn(),
  };
  const formsService: any = { findOne: jest.fn() };
  const usersService: any = { findByIds: jest.fn() };

  const service = new RecordsService(model, formsService, usersService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('devuelve página con hasPdf según templateSnapshot no-null', async () => {
    formsService.findOne.mockResolvedValue({
      _id: 'form1',
      schema: { widgets: [{ id: 'w1', label: 'Paciente' }, { id: 'w2', label: 'Documento' }] },
    });
    model.find.mockReturnValue({
      sort: () => ({ skip: () => ({ limit: () => ({ lean: () => Promise.resolve([
        { _id: 's1', submittedAt: new Date('2026-07-22'), data: { w1: 'Juan', w2: 'CC1' }, submittedById: 5, templateSnapshot: '<p></p>' },
        { _id: 's2', submittedAt: new Date('2026-07-21'), data: { w1: 'Ana',  w2: 'CC2' }, submittedById: 5, templateSnapshot: null },
      ])})})}),
    });
    model.countDocuments.mockResolvedValue(2);
    usersService.findByIds.mockResolvedValue({ 5: { name: 'Sara', email: 's@x' } });

    const page = await service.listByForm('form1', { page: 1, limit: 50 });

    expect(page.total).toBe(2);
    expect(page.data[0]).toMatchObject({ id: 's1', userName: 'Sara', hasPdf: true });
    expect(page.data[0].summary).toMatchObject({ Paciente: 'Juan', Documento: 'CC1' });
    expect(page.data[1]).toMatchObject({ id: 's2', hasPdf: false });
  });

  it('aplica filtro por rango de fechas', async () => {
    formsService.findOne.mockResolvedValue({ _id: 'form1', schema: { widgets: [] } });
    model.find.mockReturnValue({ sort: () => ({ skip: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }) }) });
    model.countDocuments.mockResolvedValue(0);
    usersService.findByIds.mockResolvedValue({});

    await service.listByForm('form1', { page: 1, limit: 50, from: '2026-07-01', to: '2026-07-31' });

    const query = model.find.mock.calls[0][0];
    expect(query.submittedAt.$gte).toEqual(new Date('2026-07-01'));
    expect(query.submittedAt.$lte).toEqual(new Date('2026-07-31T23:59:59.999Z'));
  });
});
```

- [ ] **Step 3: Correr tests (fallan)**

```powershell
cd backend
npx jest src/submissions/records.service.spec.ts
cd ..
```
Expected: FAIL "Cannot find module './records.service'".

- [ ] **Step 4: Implementar el service**

Crear `backend/src/submissions/records.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FormSubmission, FormSubmissionDocument } from './form-submission.schema';
import { FormsService } from '../forms/forms.service';
import { UsersService } from '../users/users.service';

export type RecordRow = {
  id: string;
  submittedAt: Date;
  userName: string;
  summary: Record<string, string>;
  hasPdf: boolean;
};

export type RecordsPage = {
  data: RecordRow[];
  total: number;
  page: number;
  limit: number;
};

// Widgets cuyo valor NO se resume en la tabla (no aportan como columna).
const SUMMARY_SKIP = new Set(['header', 'html_block', 'signature', 'photo']);
// Máximo de columnas resumen a devolver (además de Fecha y Usuario).
const MAX_SUMMARY_COLS = 4;

@Injectable()
export class RecordsService {
  constructor(
    @InjectModel(FormSubmission.name)
    private readonly submissionModel: Model<FormSubmissionDocument>,
    private readonly formsService: FormsService,
    private readonly usersService: UsersService,
  ) {}

  async listByForm(
    formId: string,
    opts: { page: number; limit: number; from?: string; to?: string; search?: string },
  ): Promise<RecordsPage> {
    const form = await this.formsService.findOne(formId);
    if (!form) throw new NotFoundException(`Formulario ${formId} no encontrado`);

    // Preparar mapa widgetId → label solo para las primeras N columnas útiles.
    const widgets = ((form.schema as { widgets?: Array<{ id: string; type: string; label?: string }> }).widgets ?? [])
      .filter((w) => w.label && !SUMMARY_SKIP.has(w.type))
      .slice(0, MAX_SUMMARY_COLS);

    const query: Record<string, unknown> = { formId };
    if (opts.from || opts.to) {
      const range: Record<string, Date> = {};
      if (opts.from) range.$gte = new Date(opts.from);
      if (opts.to) range.$lte = new Date(opts.to + 'T23:59:59.999Z');
      query.submittedAt = range;
    }
    if (opts.search && opts.search.trim()) {
      // Búsqueda simple: cualquier valor del data.* contiene el texto.
      // Mongo no permite $regex sobre valores mixtos → usamos $text si el
      // formulario tiene índice de texto; si no, filtramos post-fetch.
      // Por simplicidad y como los formularios son pequeños (<10k), filtramos
      // aquí en memoria después de traer la página.
    }

    const skip = (opts.page - 1) * opts.limit;
    const [docs, total] = await Promise.all([
      this.submissionModel
        .find(query)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(opts.limit)
        .lean() as unknown as Promise<Array<FormSubmissionDocument & { data: Record<string, unknown> }>>,
      this.submissionModel.countDocuments(query),
    ]);

    // Filtro por texto post-fetch (simple)
    const needle = opts.search?.trim().toLowerCase() ?? '';
    const filtered = needle
      ? docs.filter((d) =>
          Object.values(d.data ?? {}).some((v) =>
            String(v ?? '').toLowerCase().includes(needle),
          ),
        )
      : docs;

    const userIds = Array.from(new Set(filtered.map((d) => (d as any).submittedById).filter(Boolean))) as number[];
    const userMap = await this.usersService.findByIds(userIds);

    const data: RecordRow[] = filtered.map((d) => {
      const summary: Record<string, string> = {};
      for (const w of widgets) {
        const raw = d.data?.[w.id];
        summary[w.label ?? w.id] = raw == null ? '' : String(raw);
      }
      const uid = (d as any).submittedById as number | null;
      return {
        id: String((d as any)._id),
        submittedAt: d.submittedAt,
        userName: uid && userMap[uid] ? userMap[uid].name : '—',
        summary,
        hasPdf: !!(d as any).templateSnapshot,
      };
    });

    return { data, total, page: opts.page, limit: opts.limit };
  }
}
```

- [ ] **Step 5: Correr tests (pasan)**

```powershell
cd backend
npx jest src/submissions/records.service.spec.ts
cd ..
```
Expected: 2 tests passed.

- [ ] **Step 6: Añadir `findByIds` a UsersService si faltaba (del Step 1)**

Aplicar el snippet del Step 1 si `findByIds` no existía.

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m "feat(submissions): RecordsService lista paginada por formulario

Devuelve fecha, usuario, resumen configurable (max 4 columnas) y hasPdf.
Filtros por rango de fechas y busqueda de texto simple en memoria.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 1.4: RecordsController — endpoints GET individuales

**Files:**
- Create: `backend/src/submissions/records.controller.ts`
- Modify: `backend/src/submissions/submissions.module.ts` (registrar controller y providers)

**Interfaces:**
- Consumes: `RecordsService.listByForm`, `PdfRendererService.htmlToPdfBuffer`, `interpolatePdfTemplate`, `AdminAuditService.record`.
- Produces: rutas `GET /forms/:formId/records`, `GET /submissions/:id/pdf` (blob).

- [ ] **Step 1: Verificar helper `AdminAuditService.record` existe**

Run:
```powershell
Select-String "async record" backend/src/admin-audit/admin-audit.service.ts
```
Expected: método con firma tipo `record({ action, actorId, actorName, actorRole, targetType, targetId, metadata? })`.

Si la firma difiere, ajustar los `record()` de este task.

- [ ] **Step 2: Escribir el controller**

Crear `backend/src/submissions/records.controller.ts`:

```ts
import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions';
import { RecordsService } from './records.service';
import { PdfRendererService } from './pdf-renderer.service';
import { FormsService } from '../forms/forms.service';
import { FilesService } from '../files/files.service';
import { interpolatePdfTemplate } from './pdf-interpolator';
import { FormSubmission, FormSubmissionDocument } from './form-submission.schema';
import {
  AdminAuditService,
} from '../admin-audit/admin-audit.service';
import {
  AdminActionType,
  AdminActionTargetType,
} from '../admin-audit/admin-action.entity';

interface AuthedRequest {
  user: { id: number; name: string; role: string };
  ip?: string;
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class RecordsController {
  constructor(
    @InjectModel(FormSubmission.name)
    private readonly submissionModel: Model<FormSubmissionDocument>,
    private readonly recordsService: RecordsService,
    private readonly formsService: FormsService,
    private readonly filesService: FilesService,
    private readonly pdfRenderer: PdfRendererService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get('forms/:formId/records')
  @RequirePermission(Permission.REPORTS_VIEW)
  async list(
    @Param('formId') formId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') search?: string,
  ) {
    return this.recordsService.listByForm(formId, {
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(200, Math.max(1, parseInt(limit, 10) || 50)),
      from,
      to,
      search,
    });
  }

  @Get('submissions/:id/pdf')
  @RequirePermission(Permission.REPORTS_VIEW)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async downloadPdf(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ) {
    const sub = await this.submissionModel
      .findById(id)
      .select('templateSnapshot pdfFilename data formId submittedAt')
      .lean();
    if (!sub) throw new NotFoundException('Registro no encontrado');
    if (!sub.templateSnapshot) {
      throw new NotFoundException(
        'Este registro no tiene PDF disponible (fue enviado antes de habilitarse esta función).',
      );
    }

    const form = await this.formsService.findOne(sub.formId);
    if (!form) throw new NotFoundException('Formulario no encontrado');

    const html = await interpolatePdfTemplate({
      template: sub.templateSnapshot,
      data: sub.data as Record<string, unknown>,
      widgets: (form.schema as any).widgets ?? [],
      filesService: this.filesService,
    });
    const buffer = await this.pdfRenderer.htmlToPdfBuffer(html);
    const filename =
      sub.pdfFilename ??
      `registro_${sub.formId}_${sub.submittedAt.toISOString().slice(0, 10)}.pdf`;

    await this.audit.record({
      action: AdminActionType.SUBMISSION_PDF_DOWNLOADED,
      actorId: req.user.id,
      actorName: req.user.name,
      actorRole: req.user.role,
      targetType: AdminActionTargetType.SUBMISSION,
      targetId: id,
      targetName: form.name,
      metadata: { formId: sub.formId, ip: req.ip ?? null },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename.replace(/"/g, '')}"`,
    );
    res.send(buffer);
  }
}
```

- [ ] **Step 3: Registrar controller y providers en el módulo**

Editar `backend/src/submissions/submissions.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FormSubmission, FormSubmissionSchema } from './form-submission.schema';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';
import { PdfRendererService } from './pdf-renderer.service';
import { FormsModule } from '../forms/forms.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { FilesModule } from '../files/files.module';
import { UsersModule } from '../users/users.module';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FormSubmission.name, schema: FormSubmissionSchema },
    ]),
    FormsModule,
    ApiKeysModule,
    FilesModule,
    UsersModule,
    AdminAuditModule,
    AuthModule,
  ],
  controllers: [SubmissionsController, RecordsController],
  providers: [SubmissionsService, RecordsService, PdfRendererService, ApiKeyGuard],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
```

- [ ] **Step 4: Prueba manual del endpoint list**

```powershell
cd backend; npm run build; cd ..
```
Expected: 0 errores.

Levantar el server manualmente y probar:
```powershell
# Curl con un JWT válido — user con REPORTS_VIEW
$token = "<JWT>"
Invoke-RestMethod -Uri "http://localhost:3001/api/forms/<formId>/records?page=1&limit=10" -Headers @{Authorization="Bearer $token"}
```
Expected: JSON con `{data:[], total:0, page:1, limit:10}` (o datos si hay envíos).

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat(submissions): RecordsController con GET records + GET pdf

- GET /forms/:id/records: paginado con filtros fecha + busqueda
- GET /submissions/:id/pdf: render on-demand via interpolador + Puppeteer
  con permiso REPORTS_VIEW, rate limit 30/min y auditoria

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## FASE 2 · Frontend tabla + modal

### Task 2.1: API helpers en `services/api.ts`

**Files:**
- Modify: `src/services/api.ts`

**Interfaces:**
- Produces:
  - `getFormRecordsApi(formId, params): Promise<ApiResponse<RecordsPageDto>>`
  - `getSubmissionPdfBlobApi(id): Promise<{blob: Blob, filename: string, error: string|null}>`
  - Tipos `RecordRowDto`, `RecordsPageDto`.

- [ ] **Step 1: Agregar tipos**

En `src/services/api.ts` (después de los tipos de `SubmissionData`):

```ts
export type RecordRowDto = {
  id: string;
  submittedAt: string;
  userName: string;
  summary: Record<string, string>;
  hasPdf: boolean;
};

export type RecordsPageDto = {
  data: RecordRowDto[];
  total: number;
  page: number;
  limit: number;
};
```

- [ ] **Step 2: Agregar `getFormRecordsApi`**

```ts
export function getFormRecordsApi(
  formId: string,
  params: { page?: number; limit?: number; from?: string; to?: string; q?: string } = {},
): Promise<ApiResponse<RecordsPageDto>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.q) qs.set('q', params.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request<RecordsPageDto>(`/forms/${formId}/records${suffix}`);
}
```

- [ ] **Step 3: Agregar `getSubmissionPdfBlobApi` (fetch manual para blob)**

```ts
export async function getSubmissionPdfBlobApi(
  id: string,
): Promise<{ blob: Blob | null; filename: string; error: string | null }> {
  const token = localStorage.getItem('token');
  try {
    const resp = await fetch(`${API_URL}/submissions/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (resp.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
      return { blob: null, filename: '', error: 'Sesión expirada' };
    }
    if (!resp.ok) {
      const msg = await resp.text().catch(() => '');
      return { blob: null, filename: '', error: msg || `Error ${resp.status}` };
    }
    const blob = await resp.blob();
    const disp = resp.headers.get('Content-Disposition') ?? '';
    const match = /filename="?([^"]+)"?/i.exec(disp);
    return { blob, filename: match?.[1] ?? 'registro.pdf', error: null };
  } catch {
    return { blob: null, filename: '', error: 'No se pudo conectar con el servidor' };
  }
}
```

- [ ] **Step 4: Verificar typecheck**

```powershell
npm run build
```
Expected: 0 errores.

- [ ] **Step 5: Commit**

```powershell
git add src/services/api.ts
git commit -m "feat(api): helpers getFormRecordsApi y getSubmissionPdfBlobApi

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2.2: Hooks `useFormRecords` y `usePdfPreview`

**Files:**
- Create: `src/hooks/useFormRecords.ts`
- Create: `src/hooks/usePdfPreview.ts`

**Interfaces:**
- Consumes: `getFormRecordsApi`, `getSubmissionPdfBlobApi`.
- Produces:
  - `useFormRecords(formId, filters): { data, total, loading, error, refresh, page, setPage }`
  - `usePdfPreview(): { open(id), close(), blobUrl, filename, loading, error, blob }`

- [ ] **Step 1: `useFormRecords`**

Crear `src/hooks/useFormRecords.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { getFormRecordsApi, type RecordRowDto } from '../services/api';

type Filters = {
  from?: string;
  to?: string;
  q?: string;
};

export function useFormRecords(formId: string | null, filters: Filters) {
  const [data, setData] = useState<RecordRowDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const LIMIT = 25;

  const load = useCallback(async () => {
    if (!formId) return;
    setLoading(true);
    setError(null);
    const res = await getFormRecordsApi(formId, { page, limit: LIMIT, ...filters });
    if (res.error || !res.data) {
      setError(res.error ?? 'No se pudieron cargar los registros');
      setData([]);
      setTotal(0);
    } else {
      setData(res.data.data);
      setTotal(res.data.total);
    }
    setLoading(false);
  }, [formId, page, filters.from, filters.to, filters.q]);

  useEffect(() => {
    load();
  }, [load]);

  // Al cambiar filtros, volver a la página 1.
  useEffect(() => {
    setPage(1);
  }, [filters.from, filters.to, filters.q]);

  return {
    data,
    total,
    loading,
    error,
    page,
    setPage,
    pageCount: Math.max(1, Math.ceil(total / LIMIT)),
    refresh: load,
  };
}
```

- [ ] **Step 2: `usePdfPreview`**

Crear `src/hooks/usePdfPreview.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSubmissionPdfBlobApi } from '../services/api';

export function usePdfPreview() {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revokeRef = useRef<string | null>(null);

  const open = useCallback(async (submissionId: string) => {
    setLoading(true);
    setError(null);
    if (revokeRef.current) URL.revokeObjectURL(revokeRef.current);
    revokeRef.current = null;
    setBlob(null);
    setBlobUrl(null);
    const { blob, filename, error } = await getSubmissionPdfBlobApi(submissionId);
    if (error || !blob) {
      setError(error ?? 'No se pudo generar el PDF');
      setLoading(false);
      return;
    }
    const url = URL.createObjectURL(blob);
    revokeRef.current = url;
    setBlob(blob);
    setBlobUrl(url);
    setFilename(filename);
    setLoading(false);
  }, []);

  const close = useCallback(() => {
    if (revokeRef.current) URL.revokeObjectURL(revokeRef.current);
    revokeRef.current = null;
    setBlob(null);
    setBlobUrl(null);
    setFilename('');
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (revokeRef.current) URL.revokeObjectURL(revokeRef.current);
    };
  }, []);

  return { blob, blobUrl, filename, loading, error, open, close };
}
```

- [ ] **Step 3: Typecheck**

```powershell
npm run build
```
Expected: 0 errores.

- [ ] **Step 4: Commit**

```powershell
git add src/hooks/useFormRecords.ts src/hooks/usePdfPreview.ts
git commit -m "feat(hooks): useFormRecords + usePdfPreview

usePdfPreview gestiona URL.createObjectURL con cleanup automatico.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2.3: Componentes `RecordsTable` y `PdfPreviewModal`

**Files:**
- Create: `src/components/reports/RecordsTable.tsx`
- Create: `src/components/reports/PdfPreviewModal.tsx`

**Interfaces:**
- Consumes: `useFormRecords`, `usePdfPreview`, `RecordRowDto`.
- Produces: `<RecordsTable formId={string} />` renderiza la tabla + integra el modal.

- [ ] **Step 1: `PdfPreviewModal`**

Crear `src/components/reports/PdfPreviewModal.tsx`:

```tsx
import { useEffect } from 'react';

type Props = {
  open: boolean;
  loading: boolean;
  error: string | null;
  blobUrl: string | null;
  filename: string;
  headerInfo?: string;
  formName?: string;
  onClose: () => void;
  onDownload: () => void;
};

export default function PdfPreviewModal({
  open, loading, error, blobUrl, filename, headerInfo, formName, onClose, onDownload,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-[13.5px] font-bold text-slate-900">
              Vista previa · {formName ?? 'PDF'}
            </div>
            {headerInfo && (
              <div className="mt-0.5 text-[11.5px] text-slate-500">{headerInfo}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent text-[22px] leading-none text-slate-500 hover:text-slate-800"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-200 p-4">
          {loading && (
            <div className="flex h-full items-center justify-center text-[13px] text-slate-600">
              Generando PDF…
            </div>
          )}
          {error && !loading && (
            <div className="flex h-full items-center justify-center text-[13px] text-red-700">
              {error}
            </div>
          )}
          {blobUrl && !loading && !error && (
            <iframe
              src={blobUrl}
              title={filename}
              className="h-full w-full rounded-md border-none bg-white"
            />
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-[11px] text-slate-500">
            🔒 Generado en el servidor · registrado en auditoría
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md border-[1.5px] border-slate-300 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={onDownload}
              disabled={!blobUrl || loading}
              className="cursor-pointer rounded-md border-none bg-[#00c2a8] px-3.5 py-1.5 text-[12px] font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ⬇ Descargar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `RecordsTable`**

Crear `src/components/reports/RecordsTable.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { useFormRecords } from '../../hooks/useFormRecords';
import { usePdfPreview } from '../../hooks/usePdfPreview';
import PdfPreviewModal from './PdfPreviewModal';

type Props = {
  formId: string;
  formName: string;
};

export default function RecordsTable({ formId, formName }: Props) {
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [q, setQ] = useState<string>('');

  const filters = useMemo(() => ({ from, to, q }), [from, to, q]);
  const { data, total, loading, error, page, setPage, pageCount } = useFormRecords(
    formId,
    filters,
  );
  const preview = usePdfPreview();

  const [openId, setOpenId] = useState<string | null>(null);
  const openRow = data.find((r) => r.id === openId) ?? null;

  const summaryCols = useMemo(() => {
    const cols = new Set<string>();
    for (const row of data) {
      for (const k of Object.keys(row.summary)) cols.add(k);
    }
    return Array.from(cols).slice(0, 4);
  }, [data]);

  const handleRowClick = (id: string, hasPdf: boolean) => {
    if (!hasPdf) return;
    setOpenId(id);
    preview.open(id);
  };

  const handleDownload = () => {
    if (!preview.blob) return;
    const a = document.createElement('a');
    a.href = preview.blobUrl!;
    a.download = preview.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div>
      {/* Filtros */}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
        <span className="text-[11px] font-semibold text-slate-600">Desde</span>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-[12px]"
        />
        <span className="text-[11px] font-semibold text-slate-600">Hasta</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-[12px]"
        />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Buscar por texto"
          className="ml-2 flex-1 rounded border border-slate-300 px-2.5 py-1 text-[12px]"
        />
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
                Fecha
              </th>
              <th className="px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
                Usuario
              </th>
              {summaryCols.map((c) => (
                <th
                  key={c}
                  className="px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-500"
                >
                  {c}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={summaryCols.length + 3} className="px-3 py-8 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={summaryCols.length + 3} className="px-3 py-8 text-center text-red-600">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && data.length === 0 && (
              <tr>
                <td colSpan={summaryCols.length + 3} className="px-3 py-8 text-center text-slate-400">
                  Sin registros en el rango seleccionado.
                </td>
              </tr>
            )}
            {!loading && !error &&
              data.map((row) => {
                const disabled = !row.hasPdf;
                return (
                  <tr
                    key={row.id}
                    onClick={() => handleRowClick(row.id, row.hasPdf)}
                    className={`border-b border-slate-100 ${disabled ? 'text-slate-400' : 'cursor-pointer hover:bg-slate-50'}`}
                  >
                    <td className="px-3 py-2.5">
                      {new Date(row.submittedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5">{row.userName}</td>
                    {summaryCols.map((c) => (
                      <td key={c} className="px-3 py-2.5">
                        {row.summary[c] ?? ''}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right">
                      {row.hasPdf ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(row.id, true);
                          }}
                          className="cursor-pointer rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11.5px] font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          👁 Ver PDF
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">No disponible</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] text-slate-600">
          <span>
            Mostrando {data.length} de {total} registros
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="cursor-pointer rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] disabled:opacity-40"
            >
              ‹
            </button>
            <span className="px-2 py-0.5">
              {page} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(pageCount, page + 1))}
              disabled={page >= pageCount}
              className="cursor-pointer rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <PdfPreviewModal
        open={openId !== null}
        loading={preview.loading}
        error={preview.error}
        blobUrl={preview.blobUrl}
        filename={preview.filename}
        formName={formName}
        headerInfo={
          openRow
            ? `${openRow.userName} · ${new Date(openRow.submittedAt).toLocaleString()}`
            : undefined
        }
        onClose={() => {
          setOpenId(null);
          preview.close();
        }}
        onDownload={handleDownload}
      />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```powershell
npm run build
```
Expected: 0 errores.

- [ ] **Step 4: Commit**

```powershell
git add src/components/reports/RecordsTable.tsx src/components/reports/PdfPreviewModal.tsx
git commit -m "feat(reports): RecordsTable con modal preview PDF

- Filtros fecha + busqueda de texto
- Filas gris deshabilitadas para envios sin PDF
- Modal con iframe blob + boton descargar (reutiliza mismo blob)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2.4: Integrar pestañas en `ReportsPage`

**Files:**
- Create: `src/components/reports/ReportsTabs.tsx`
- Modify: `src/pages/ReportsPage.tsx` (envolver contenido en pestañas)

**Interfaces:**
- Produces: `<ReportsTabs>` con dos hijos: el flujo actual de Excel y el nuevo `<RecordsTable>`.

- [ ] **Step 1: Extraer contenido Excel actual a componente hijo**

Renombrar el JSX interno de `ReportsPage` en una función `ExcelReportPanel` dentro del mismo archivo (o extraer a `src/components/reports/ExcelReportPanel.tsx` si prefieres separar — decisión de bajo nivel).

- [ ] **Step 2: Nueva estructura de la página**

Rewrite `src/pages/ReportsPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useFolderStore } from '../store/useFolderStore';
import { requestReportByEmailApi } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import type { FormItem } from '../types/folder.types';
import type { WidgetInstance } from '../types/widget.types';
import RecordsTable from '../components/reports/RecordsTable';

type Field = { id: string; label: string; type: string };

type Tab = 'excel' | 'records';

export default function ReportsPage() {
  const { projects, selectedProjectId, selectProject, loadProjects } = useProjectStore();
  const { folders, loadFolders } = useFolderStore();
  const currentUser = useAuthStore((s) => s.currentUser);

  const [tab, setTab] = useState<Tab>('excel');
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [selectedFormId, setSelectedFormId] = useState('');

  useEffect(() => { loadProjects(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedProjectId) loadFolders(selectedProjectId); }, [selectedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const projectFolders = useMemo(
    () => folders.filter((f) => f.projectId === selectedProjectId),
    [folders, selectedProjectId],
  );
  const selectedFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId) ?? null,
    [folders, selectedFolderId],
  );
  const selectedForm: FormItem | null = useMemo(
    () => selectedFolder?.forms.find((f) => f.id === selectedFormId) ?? null,
    [selectedFolder, selectedFormId],
  );

  const handleProjectChange = (id: string) => {
    selectProject(id);
    setSelectedFolderId('');
    setSelectedFormId('');
  };
  const handleFolderChange = (id: string) => {
    setSelectedFolderId(id);
    setSelectedFormId('');
  };

  return (
    <div className="flex h-screen flex-col bg-[#f0f4f8]">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1100px] px-6 py-6">
          <h1 className="m-0 text-[22px] font-bold text-gray-900">Reportes</h1>

          <div className="mt-3 flex border-b border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setTab('excel')}
              className={`cursor-pointer border-none bg-transparent px-5 py-3 text-[13px] font-semibold ${
                tab === 'excel'
                  ? 'border-b-[2.5px] border-[#00c2a8] text-[#0f766e]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              📊 Excel por correo
            </button>
            <button
              type="button"
              onClick={() => setTab('records')}
              className={`cursor-pointer border-none bg-transparent px-5 py-3 text-[13px] font-semibold ${
                tab === 'records'
                  ? 'border-b-[2.5px] border-[#00c2a8] text-[#0f766e]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              📄 Registros y PDFs
            </button>
          </div>

          {/* Selectores comunes */}
          <div className="my-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Proyecto</label>
              <select
                value={selectedProjectId ?? ''}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-2.5 py-2 text-[13px]"
              >
                <option value="">— Seleccionar proyecto —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Carpeta</label>
              <select
                value={selectedFolderId}
                onChange={(e) => handleFolderChange(e.target.value)}
                disabled={!selectedProjectId}
                className="w-full cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-2.5 py-2 text-[13px] disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">— Seleccionar carpeta —</option>
                {projectFolders.map((f) => (
                  <option key={f.id} value={f.id}>{f.icon} {f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Formulario</label>
              <select
                value={selectedFormId}
                onChange={(e) => setSelectedFormId(e.target.value)}
                disabled={!selectedFolderId}
                className="w-full cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-2.5 py-2 text-[13px] disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">— Seleccionar formulario —</option>
                {(selectedFolder?.forms ?? []).map((form) => (
                  <option key={form.id} value={form.id}>📋 {form.name}</option>
                ))}
              </select>
            </div>
          </div>

          {tab === 'excel' && (
            <ExcelReportPanel selectedForm={selectedForm} currentUser={currentUser} />
          )}

          {tab === 'records' && selectedForm && (
            <RecordsTable formId={selectedForm.id} formName={selectedForm.name} />
          )}
          {tab === 'records' && !selectedForm && (
            <div className="rounded-xl border-2 border-dashed border-slate-200 px-6 py-14 text-center text-gray-400">
              Selecciona proyecto, carpeta y formulario para ver sus registros.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Panel Excel (contenido previo de ReportsPage) ───────────────────────────
function ExcelReportPanel({
  selectedForm,
  currentUser,
}: {
  selectedForm: FormItem | null;
  currentUser: { email?: string } | null;
}) {
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null);

  const fields: Field[] = useMemo(() => {
    if (!selectedForm) return [];
    const widgets = (selectedForm.widgets ?? []) as WidgetInstance[];
    return widgets
      .filter((w) => !!w.label?.trim())
      .map((w) => ({ id: w.id, label: w.label, type: w.type }));
  }, [selectedForm]);

  useEffect(() => {
    setSelectedFieldIds(new Set(fields.map((f) => f.id)));
    setFeedback(null);
  }, [selectedForm?.id, fields]);

  const toggleField = (id: string) => {
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSendByEmail = async () => {
    if (!selectedForm || selectedFieldIds.size === 0) {
      setFeedback({ kind: 'err', message: 'Selecciona al menos un campo.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    const res = await requestReportByEmailApi(selectedForm.id, Array.from(selectedFieldIds));
    setBusy(false);
    if (res.error || !res.data) {
      setFeedback({ kind: 'err', message: res.error ?? 'No se pudo generar el reporte.' });
      return;
    }
    setFeedback({ kind: 'ok', message: res.data.message });
  };

  if (!selectedForm) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 px-6 py-14 text-center text-gray-400">
        Selecciona un formulario para armar el reporte.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 text-[12px] text-slate-600">
        Te enviaremos un enlace de descarga a{' '}
        <strong>{currentUser?.email ?? 'tu correo'}</strong>. El enlace dura 2 min y requiere 2FA.
      </div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[12px] text-slate-500">
          {selectedFieldIds.size} de {fields.length} campo(s) seleccionado(s)
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setSelectedFieldIds(new Set(fields.map((f) => f.id)))} className="cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-gray-600">Todos</button>
          <button onClick={() => setSelectedFieldIds(new Set())} className="cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-gray-600">Ninguno</button>
        </div>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.id} className="flex cursor-pointer items-center gap-2.5 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2 hover:bg-slate-100">
            <input type="checkbox" checked={selectedFieldIds.has(f.id)} onChange={() => toggleField(f.id)} className="h-4 w-4 cursor-pointer accent-[#00c2a8]" />
            <div className="min-w-0 flex-1">
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold text-gray-900">{f.label}</div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">{f.type}</div>
            </div>
          </label>
        ))}
      </div>
      {feedback && (
        <div className={`mt-3 rounded-md border px-3 py-2 text-[12px] ${feedback.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {feedback.kind === 'ok' ? '✓ ' : '⚠️ '}{feedback.message}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <button onClick={handleSendByEmail} disabled={busy || selectedFieldIds.size === 0} className="cursor-pointer rounded-lg border-none bg-[#00c2a8] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(0,194,168,0.35)] disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? 'Enviando…' : 'Solicitar reporte →'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + probar en el navegador**

```powershell
npm run build
npm run dev
```

Abrir `http://localhost:5173/reports`, verificar que las pestañas cambian y que al elegir formulario en "Registros y PDFs" se ve la tabla (aunque sea vacía).

- [ ] **Step 4: Commit**

```powershell
git add src/pages/ReportsPage.tsx src/components/reports/RecordsTable.tsx src/components/reports/PdfPreviewModal.tsx
git commit -m "feat(reports): pestanas Excel / Registros y PDFs en /reports

Extrae panel Excel existente y agrega tab de registros con RecordsTable.
Los selectores proyecto/carpeta/formulario son comunes a ambas pestanas.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## FASE 3 · Backend descarga masiva

### Task 3.1: Rename `ReportDownload` → `SecureDownload` con `kind`

**Files:**
- Modify + rename: `backend/src/reports/report-download.schema.ts` → `secure-download.schema.ts`
- Modify + rename: `backend/src/reports/report-downloads.service.ts` → `secure-downloads.service.ts`
- Modify + rename: `backend/src/reports/report-downloads.controller.ts` → `secure-downloads.controller.ts`
- Modify: `backend/src/reports/reports.module.ts` (imports actualizados)
- Modify: `backend/src/reports/reports.service.ts` (usa el nuevo nombre y pasa `kind: 'excel'`)

**Interfaces:**
- Produces:
  - Schema `SecureDownload` con campo nuevo `kind: 'excel' | 'bulk-pdf'` (default `'excel'`).
  - `SecureDownloadsService.create({...input, kind})`.
  - `SecureDownloadsService.getMeta/consume/incrementTotpAttempts` sin cambio de firma.
  - Rutas del controller: `GET /secure-downloads/:token/meta`, `POST /secure-downloads/:token`.

- [ ] **Step 1: Rename de archivos**

```powershell
git mv backend/src/reports/report-download.schema.ts backend/src/reports/secure-download.schema.ts
git mv backend/src/reports/report-downloads.service.ts backend/src/reports/secure-downloads.service.ts
git mv backend/src/reports/report-downloads.controller.ts backend/src/reports/secure-downloads.controller.ts
```

- [ ] **Step 2: Actualizar schema con `kind`**

Editar `backend/src/reports/secure-download.schema.ts` — cambiar clase y agregar `kind`:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SecureDownloadKind = 'excel' | 'bulk-pdf';
export type SecureDownloadDocument = SecureDownload & Document;

@Schema({
  collection: 'secure_downloads',
  timestamps: { createdAt: true, updatedAt: false },
})
export class SecureDownload {
  @Prop({ type: String, default: () => crypto.randomUUID() })
  _id: string;

  @Prop({ required: true, index: true })
  userId: number;

  @Prop({ required: true, enum: ['excel', 'bulk-pdf'], default: 'excel' })
  kind: SecureDownloadKind;

  @Prop({ required: true })
  formId: string;

  @Prop({ required: true })
  formName: string;

  @Prop({ required: true, type: Buffer })
  encryptedBuffer: Buffer;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true, index: { expires: 0 } })
  expiresAt: Date;

  @Prop({ default: false })
  consumed: boolean;

  @Prop({ type: Date, default: null })
  consumedAt: Date | null;

  @Prop({ default: 0 })
  totpAttempts: number;

  @Prop({ type: String, default: null })
  createdIp: string | null;
}

export const SecureDownloadSchema = SchemaFactory.createForClass(SecureDownload);
```

Nota: cambia la colección de `report_downloads` a `secure_downloads`. Los documentos que estén vivos en la colección vieja quedarán huérfanos y expirarán solos por su TTL de 2 min. **No hay data-loss real** porque son blobs de descarga efímeros.

- [ ] **Step 3: Actualizar service**

Editar `backend/src/reports/secure-downloads.service.ts`:

```ts
// Reemplazar todos los imports/nombres:
import { SecureDownload, SecureDownloadDocument, SecureDownloadKind } from './secure-download.schema';

export type CreateSecureDownloadInput = {
  userId: number;
  kind: SecureDownloadKind;
  formId: string;
  formName: string;
  encryptedBuffer: Buffer;
  filename: string;
  ttlMinutes: number;
  createdIp?: string | null;
};

export const MAX_TOTP_ATTEMPTS = 3;

@Injectable()
export class SecureDownloadsService {
  private readonly db: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  constructor(
    @InjectModel(SecureDownload.name) model: Model<SecureDownloadDocument>,
  ) {
    this.db = model;
  }

  async create(input: CreateSecureDownloadInput): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + input.ttlMinutes * 60_000);
    const doc: SecureDownloadDocument = await this.db.create({
      userId: input.userId,
      kind: input.kind,
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

  async getMeta(
    token: string,
    userId: number,
  ): Promise<{ formName: string; expiresAt: Date; totpAttempts: number; kind: SecureDownloadKind }> {
    const doc: SecureDownloadDocument | null = await this.db.findOne({
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
      kind: doc.kind,
    };
  }

  async consume(
    token: string,
    userId: number,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const preview: SecureDownloadDocument | null = await this.db.findOne({ _id: token });
    if (preview && preview.userId !== userId) {
      throw new ForbiddenException('Enlace no válido');
    }
    const doc: SecureDownloadDocument | null = await this.db.findOneAndUpdate(
      { _id: token, userId, consumed: false, expiresAt: { $gt: new Date() } },
      { $set: { consumed: true, consumedAt: new Date() } },
    );
    if (!doc) throw new GoneException('Enlace expirado o ya usado');
    return { buffer: doc.encryptedBuffer, filename: doc.filename };
  }

  async incrementTotpAttempts(token: string, userId: number): Promise<number> {
    const updated: SecureDownloadDocument | null = await this.db.findOneAndUpdate(
      { _id: token, userId, consumed: false },
      { $inc: { totpAttempts: 1 } },
      { new: true },
    );
    if (!updated) return 0;
    const attempts: number = updated.totpAttempts ?? 0;
    if (attempts >= MAX_TOTP_ATTEMPTS) {
      await this.db.findOneAndUpdate(
        { _id: token, userId, consumed: false },
        { $set: { consumed: true, consumedAt: new Date() } },
      );
    }
    return attempts;
  }
}
```

Recordar agregar los imports arriba: `import { ForbiddenException, GoneException, Injectable, NotFoundException } from '@nestjs/common'; import { InjectModel } from '@nestjs/mongoose'; import { Model } from 'mongoose';`

- [ ] **Step 4: Actualizar controller**

Editar `backend/src/reports/secure-downloads.controller.ts`. Renombrar clase a `SecureDownloadsController` y cambiar ruta base:

```ts
@Controller('secure-downloads')
export class SecureDownloadsController {
  constructor(
    private readonly downloads: SecureDownloadsService,
    private readonly totp: TotpService,
    private readonly audit: AdminAuditService,
    private readonly users: UsersService,
  ) {}
  // ... resto igual, cambiando referencias
}
```

El `kind` ya se agrega al retorno de `getMeta` en el service (ver Step 3 de esta task). El controller simplemente lo pasa al frontend en el JSON de la respuesta — sin cambios adicionales de código, ya viaja porque devolvemos `getMeta(...)` sin filtrar campos.

- [ ] **Step 5: Actualizar module y todos los consumidores**

En `backend/src/reports/reports.module.ts`, sustituir referencias:

```ts
imports: [
  MongooseModule.forFeature([
    { name: SecureDownload.name, schema: SecureDownloadSchema },
  ]),
  // ...
],
controllers: [ReportsController, SecureDownloadsController],
providers: [ReportsService, SecureDownloadsService],
exports: [SecureDownloadsService], // exportar para SubmissionsModule
```

En `backend/src/reports/reports.service.ts`, buscar la línea que llama a `create()` y añadir `kind: 'excel'`:

```ts
await this.secureDownloads.create({
  userId,
  kind: 'excel',
  formId,
  formName: form.name,
  encryptedBuffer,
  filename: xlsxFilename,
  ttlMinutes: 2,
  createdIp: null,
});
```

Reemplazar el nombre del constructor arg: `secureDownloads: SecureDownloadsService`.

- [ ] **Step 6: Actualizar frontend — cambiar path del endpoint**

En `src/services/api.ts`, buscar `getReportDownloadMetaApi` y `downloadReportApi`; cambiar el path base:

```ts
// De: `/reports/download/${token}/meta` y `/reports/download/${token}`
// A:   `/secure-downloads/${token}/meta` y `/secure-downloads/${token}`
```

En `src/pages/ReportDownloadPage.tsx`, no cambia lógica (usa los helpers). Verificar que sigue funcionando después del rename.

- [ ] **Step 7: Build backend + frontend, probar el flujo Excel**

```powershell
cd backend; npm run build; cd ..
npm run build
```
Expected: 0 errores.

Levantar server, entrar como admin, ir a `/reports`, tab Excel, solicitar un reporte, abrir el link del correo → verificar que sigue funcionando end-to-end. Si algo se rompió, arreglar antes de commitear.

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m "refactor(reports): rename ReportDownload → SecureDownload con kind discriminador

- Colecion Mongoose report_downloads → secure_downloads (documentos vivos
  expiran por TTL 2 min, sin data-loss real).
- Nuevo campo kind: 'excel' | 'bulk-pdf' para servir ambos flujos.
- Rutas: /reports/download/:token → /secure-downloads/:token
- reports.service pasa kind:'excel' explicito para retrocompat.
- SubmissionsModule podra importar SecureDownloadsService en Fase 3.3.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3.2: `zip-crypto.ts` — helper de ZIP AES-256

**Files:**
- Create: `backend/src/submissions/zip-crypto.ts`
- Create: `backend/src/submissions/zip-crypto.spec.ts`

**Interfaces:**
- Consumes: `archiver`, `archiver-zip-encrypted` (ya instalados).
- Produces: `encryptedZip(files: Array<{name: string; buffer: Buffer}>, password: string): Promise<Buffer>`.

- [ ] **Step 1: Verificar dependencia**

```powershell
Select-String "archiver-zip-encrypted" backend/package.json
```
Expected: aparece en dependencies. Si no está: `cd backend; npm install archiver-zip-encrypted; cd ..`

- [ ] **Step 2: Tests**

Crear `backend/src/submissions/zip-crypto.spec.ts`:

```ts
import { encryptedZip } from './zip-crypto';

describe('encryptedZip', () => {
  it('produce un Buffer no vacío con firma PK', async () => {
    const zip = await encryptedZip(
      [
        { name: 'a.txt', buffer: Buffer.from('hola') },
        { name: 'b.txt', buffer: Buffer.from('mundo') },
      ],
      'password123',
    );
    expect(Buffer.isBuffer(zip)).toBe(true);
    expect(zip.length).toBeGreaterThan(50);
    // Firma ZIP estándar (PK\003\004)
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
  });

  it('rechaza si password vacía', async () => {
    await expect(encryptedZip([{ name: 'x', buffer: Buffer.alloc(0) }], '')).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Correr tests (fallan)**

```powershell
cd backend
npx jest src/submissions/zip-crypto.spec.ts
cd ..
```
Expected: FAIL.

- [ ] **Step 4: Implementar**

Crear `backend/src/submissions/zip-crypto.ts`:

```ts
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
// Casts a any: los tipos de archiver-zip-encrypted no exportan definiciones.
const archiver = require('archiver');
const archiverZipEncrypted = require('archiver-zip-encrypted');
import { PassThrough } from 'stream';

let formatRegistered = false;
function ensureFormat() {
  if (formatRegistered) return;
  archiver.registerFormat('zip-encrypted', archiverZipEncrypted);
  formatRegistered = true;
}

export async function encryptedZip(
  files: Array<{ name: string; buffer: Buffer }>,
  password: string,
): Promise<Buffer> {
  if (!password) throw new Error('encryptedZip: password vacía');
  ensureFormat();

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = new PassThrough();
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);

    const archive = (archiver as any)('zip-encrypted', {
      zlib: { level: 6 },
      encryptionMethod: 'aes256',
      password,
    });
    archive.on('error', reject);
    archive.pipe(stream);
    for (const f of files) archive.append(f.buffer, { name: f.name });
    archive.finalize();
  });
}
```

- [ ] **Step 5: Correr tests (pasan)**

```powershell
cd backend
npx jest src/submissions/zip-crypto.spec.ts
cd ..
```
Expected: 2 tests passed.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat(submissions): helper encryptedZip con AES-256

Reutilizable para bulk-pdf y cualquier futura descarga masiva cifrada.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3.3: `BulkPdfService` — genera y guarda ZIP masivo

**Files:**
- Create: `backend/src/submissions/bulk-pdf.service.ts`
- Create: `backend/src/submissions/bulk-pdf.service.spec.ts`

**Interfaces:**
- Consumes: `submissionModel`, `formsService`, `filesService`, `pdfRenderer`, `usersService`, `secureDownloadsService`, `emailService`, `auditService`.
- Produces: `BulkPdfService.request(formId, userId, filters, ip): Promise<{ok, count}>`.

- [ ] **Step 1: Test unitario del particionado (concurrencia)**

Crear `backend/src/submissions/bulk-pdf.service.spec.ts`:

```ts
import { renderInBatches } from './bulk-pdf.service';

describe('renderInBatches', () => {
  it('respeta concurrencia y mantiene orden de resultados', async () => {
    const items = [1, 2, 3, 4, 5];
    const inflight = { count: 0, max: 0 };
    const results = await renderInBatches(items, 2, async (n) => {
      inflight.count++;
      inflight.max = Math.max(inflight.max, inflight.count);
      await new Promise((r) => setTimeout(r, 10));
      inflight.count--;
      return n * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(inflight.max).toBeLessThanOrEqual(2);
  });

  it('devuelve null en items que fallan sin abortar el resto', async () => {
    const results = await renderInBatches([1, 2, 3], 3, async (n) => {
      if (n === 2) throw new Error('boom');
      return n;
    });
    expect(results).toEqual([1, null, 3]);
  });
});
```

- [ ] **Step 2: Fallar y luego implementar service + helper**

```powershell
cd backend
npx jest src/submissions/bulk-pdf.service.spec.ts
cd ..
```
Expected: FAIL.

Crear `backend/src/submissions/bulk-pdf.service.ts`:

```ts
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FormSubmission, FormSubmissionDocument } from './form-submission.schema';
import { FormsService } from '../forms/forms.service';
import { FilesService } from '../files/files.service';
import { PdfRendererService } from './pdf-renderer.service';
import { UsersService } from '../users/users.service';
import { SecureDownloadsService } from '../reports/secure-downloads.service';
import { EmailService } from '../email/email.service';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { AdminActionType, AdminActionTargetType } from '../admin-audit/admin-action.entity';
import { interpolatePdfTemplate } from './pdf-interpolator';
import { encryptedZip } from './zip-crypto';

const MAX_PDFS = 500;
const RENDER_CONCURRENCY = 3;
const TTL_MINUTES = 2;

export async function renderInBatches<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<R>,
): Promise<Array<R | null>> {
  const out: Array<R | null> = new Array(items.length).fill(null);
  let cursor = 0;
  async function next(): Promise<void> {
    const i = cursor++;
    if (i >= items.length) return;
    try {
      out[i] = await worker(items[i], i);
    } catch {
      out[i] = null;
    }
    await next();
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => next());
  await Promise.all(workers);
  return out;
}

@Injectable()
export class BulkPdfService {
  private readonly logger = new Logger(BulkPdfService.name);

  constructor(
    @InjectModel(FormSubmission.name)
    private readonly submissionModel: Model<FormSubmissionDocument>,
    private readonly formsService: FormsService,
    private readonly filesService: FilesService,
    private readonly pdfRenderer: PdfRendererService,
    private readonly usersService: UsersService,
    private readonly secureDownloads: SecureDownloadsService,
    private readonly emailService: EmailService,
    private readonly audit: AdminAuditService,
  ) {}

  async request(
    formId: string,
    userId: number,
    filters: { from?: string; to?: string; q?: string },
    ip: string | null,
    actor: { name: string; role: string },
  ): Promise<{ ok: boolean; count: number; message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.documentNumber) {
      throw new ForbiddenException(
        'Debes configurar tu número de documento en tu perfil antes de descargar PDFs masivos (será la contraseña del ZIP).',
      );
    }

    const form = await this.formsService.findOne(formId);
    if (!form) throw new NotFoundException('Formulario no encontrado');

    // Query submissions con snapshot
    const query: Record<string, unknown> = {
      formId,
      templateSnapshot: { $ne: null },
    };
    if (filters.from || filters.to) {
      const range: Record<string, Date> = {};
      if (filters.from) range.$gte = new Date(filters.from);
      if (filters.to) range.$lte = new Date(filters.to + 'T23:59:59.999Z');
      query.submittedAt = range;
    }

    let subs = await this.submissionModel
      .find(query)
      .select('templateSnapshot pdfFilename data formId submittedAt')
      .sort({ submittedAt: -1 })
      .limit(MAX_PDFS)
      .lean() as unknown as Array<any>;

    if (filters.q?.trim()) {
      const needle = filters.q.toLowerCase();
      subs = subs.filter((s) =>
        Object.values(s.data ?? {}).some((v) => String(v ?? '').toLowerCase().includes(needle)),
      );
    }

    if (subs.length === 0) {
      return { ok: false, count: 0, message: 'No hay registros con PDF disponible en el filtro seleccionado.' };
    }

    this.logger.log(`[bulkPdf] Generando ${subs.length} PDFs para "${form.name}"`);

    const widgets = (form.schema as any).widgets ?? [];
    const rendered = await renderInBatches(subs, RENDER_CONCURRENCY, async (sub) => {
      const html = await interpolatePdfTemplate({
        template: sub.templateSnapshot,
        data: sub.data,
        widgets,
        filesService: this.filesService,
      });
      const buffer = await this.pdfRenderer.htmlToPdfBuffer(html);
      const name =
        sub.pdfFilename ??
        `registro_${new Date(sub.submittedAt).toISOString().slice(0, 10)}_${sub._id}.pdf`;
      return { name, buffer };
    });

    const files = rendered.filter((r): r is { name: string; buffer: Buffer } => r != null);
    if (files.length === 0) {
      return { ok: false, count: 0, message: 'Ningún PDF se pudo generar. Contacta a soporte.' };
    }

    const zipBuffer = await encryptedZip(files, user.documentNumber);
    const filename = `PDFs_${sanitizeFilename(form.name)}_${new Date().toISOString().slice(0, 10)}.zip`;

    const { token, expiresAt } = await this.secureDownloads.create({
      userId,
      kind: 'bulk-pdf',
      formId,
      formName: form.name,
      encryptedBuffer: zipBuffer,
      filename,
      ttlMinutes: TTL_MINUTES,
      createdIp: ip,
    });

    await this.audit.record({
      action: AdminActionType.SUBMISSIONS_BULK_PDF_REQUESTED,
      actorId: userId,
      actorName: actor.name,
      actorRole: actor.role,
      targetType: AdminActionTargetType.FORM,
      targetId: formId,
      targetName: form.name,
      metadata: { count: files.length, filtered: subs.length - files.length, ip },
    });

    const baseUrl = process.env.PUBLIC_BASE_URL ?? '';
    const downloadUrl = `${baseUrl}/records/download/${token}`;
    await this.emailService.sendReportLink(user.email, {
      formName: form.name,
      downloadUrl,
      expiresAt,
      kind: 'bulk-pdf',
      count: files.length,
    });

    return {
      ok: true,
      count: files.length,
      message: `Se enviaron ${files.length} PDF(s) a ${user.email}. Revisa tu correo.`,
    };
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 60) || 'formulario';
}
```

- [ ] **Step 3: Extender `EmailService.sendReportLink` para soportar `kind`**

Verificar la firma actual del helper:
```powershell
Select-String -Pattern "sendReportLink" backend/src/email/email.service.ts -Context 0,3
```

Adaptar la firma en `backend/src/email/email.service.ts`. Firma esperada (si difiere, ajustar; el patrón conceptual es el mismo):

```ts
async sendReportLink(
  toEmail: string,
  opts: {
    formName: string;
    downloadUrl: string;
    expiresAt: Date;
    kind?: 'excel' | 'bulk-pdf';   // NUEVO: default 'excel' para retrocompat
    count?: number;                 // NUEVO: solo para bulk-pdf
  },
): Promise<void> {
  const kind = opts.kind ?? 'excel';
  const safeName = escapeHtml(opts.formName);
  const safeUrl = escapeHtml(opts.downloadUrl);
  const expiresLocal = opts.expiresAt.toLocaleString('es-CO');

  const subject =
    kind === 'bulk-pdf'
      ? `📦 ${opts.count ?? '?'} PDFs de "${opts.formName}" listos para descargar`
      : `📊 Tu reporte de "${opts.formName}" está listo`;

  const intro =
    kind === 'bulk-pdf'
      ? `Se generaron <strong>${opts.count ?? 0} PDF(s)</strong> del formulario <strong>${safeName}</strong>.`
      : `El reporte Excel del formulario <strong>${safeName}</strong> está listo.`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#00c2a8;margin:0 0 12px">Descarga segura</h2>
      <p>${intro}</p>
      <p>
        <a href="${safeUrl}"
           style="display:inline-block;background:#00c2a8;color:#fff;padding:12px 20px;
                  border-radius:8px;text-decoration:none;font-weight:600">
          Descargar ahora
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px">
        El enlace expira el <strong>${escapeHtml(expiresLocal)}</strong> (aprox. 2 min desde ahora).
        Al abrirlo se pedirá tu código 2FA. La contraseña del archivo es tu número de documento.
      </p>
    </div>`;

  await this.sendEmail({
    subject,
    emailBody: html,
    toRecipients: [{ type: 'static', email: toEmail }],
    senderName: 'SoulForms',
  });
}
```

Todas las interpolaciones usan `escapeHtml()` — helper existente en el mismo archivo.

- [ ] **Step 4: Registrar `BulkPdfService` en el módulo**

En `backend/src/submissions/submissions.module.ts`, agregar `BulkPdfService` a providers e importar `EmailModule`, `ReportsModule` (o `SecureDownloadsService` exportado):

```ts
import { EmailModule } from '../email/email.module';
import { ReportsModule } from '../reports/reports.module'; // exporta SecureDownloadsService
import { BulkPdfService } from './bulk-pdf.service';

@Module({
  imports: [
    // ...existentes
    EmailModule,
    ReportsModule,
  ],
  controllers: [SubmissionsController, RecordsController],
  providers: [SubmissionsService, RecordsService, PdfRendererService, BulkPdfService, ApiKeyGuard],
  exports: [SubmissionsService],
})
```

- [ ] **Step 5: Correr tests**

```powershell
cd backend
npx jest src/submissions/bulk-pdf.service.spec.ts
cd ..
```
Expected: 2 tests passed.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat(submissions): BulkPdfService genera ZIP AES-256 y dispara link+2FA

- Concurrencia 3 renders simultaneos, limite 500 PDFs, TTL 2 min.
- Reutiliza SecureDownloadsService con kind:'bulk-pdf'.
- Envia link por correo con EmailService.sendReportLink extendido para
  soportar el kind bulk-pdf.
- 403 si el usuario no tiene documentNumber configurado.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3.4: Endpoint `POST /forms/:formId/records/bulk-pdf`

**Files:**
- Modify: `backend/src/submissions/records.controller.ts` (agregar endpoint)

**Interfaces:**
- Consumes: `BulkPdfService.request`.
- Produces: `POST /forms/:formId/records/bulk-pdf` con body `{from?, to?, q?}` → `{ok, count, message}`.

- [ ] **Step 1: Añadir endpoint al controller**

En `backend/src/submissions/records.controller.ts`:

```ts
// ... imports adicionales
import { Body, Post, HttpException, InternalServerErrorException } from '@nestjs/common';
import { BulkPdfService } from './bulk-pdf.service';

// dentro de la clase
constructor(
  // ... existentes
  private readonly bulkPdf: BulkPdfService,
) {}

@Post('forms/:formId/records/bulk-pdf')
@RequirePermission(Permission.REPORTS_VIEW)
@Throttle({ default: { limit: 1, ttl: 60_000 } })
async requestBulk(
  @Param('formId') formId: string,
  @Body() body: { from?: string; to?: string; q?: string },
  @Req() req: AuthedRequest,
) {
  try {
    return await this.bulkPdf.request(
      formId,
      req.user.id,
      body ?? {},
      req.ip ?? null,
      { name: req.user.name, role: req.user.role },
    );
  } catch (err) {
    if (err instanceof HttpException) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new InternalServerErrorException(`Error generando PDFs masivos: ${message}`);
  }
}
```

- [ ] **Step 2: Build + prueba manual end-to-end**

```powershell
cd backend; npm run build; cd ..
```

Levantar el server, autenticarse, y llamar:
```powershell
$token = "<JWT>"
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/forms/<formId>/records/bulk-pdf" `
  -Headers @{Authorization="Bearer $token"} `
  -ContentType "application/json" `
  -Body '{"from":"2026-07-01","to":"2026-07-31"}'
```
Expected: `{ok:true, count:N, message:"Se enviaron N PDF(s) a ..."}`. Verificar que llega el correo con link.

- [ ] **Step 3: Commit**

```powershell
git add -A
git commit -m "feat(records): POST /forms/:id/records/bulk-pdf con rate limit 1/min

Delega en BulkPdfService que arma el ZIP cifrado y envia link por correo.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## FASE 4 · Frontend descarga masiva

### Task 4.1: Botón "Enviar todos" en `RecordsTable`

**Files:**
- Modify: `src/services/api.ts` (agregar `requestBulkPdfApi`)
- Modify: `src/components/reports/RecordsTable.tsx`

**Interfaces:**
- Produces: `requestBulkPdfApi(formId, filters): Promise<ApiResponse<{ok, count, message}>>`.

- [ ] **Step 1: API helper**

En `src/services/api.ts`:

```ts
export function requestBulkPdfApi(
  formId: string,
  filters: { from?: string; to?: string; q?: string },
): Promise<ApiResponse<{ ok: boolean; count: number; message: string }>> {
  return request<{ ok: boolean; count: number; message: string }>(
    `/forms/${formId}/records/bulk-pdf`,
    { method: 'POST', body: JSON.stringify(filters) },
  );
}
```

- [ ] **Step 2: Botón en la tabla**

En `RecordsTable.tsx`, arriba del componente table (dentro del bloque de filtros):

```tsx
import { requestBulkPdfApi } from '../../services/api';

// dentro del componente, junto a los estados de filtros:
const [bulkBusy, setBulkBusy] = useState(false);
const [bulkFeedback, setBulkFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

const handleBulk = async () => {
  if (!confirm(`Se enviará un correo con el link de descarga de todos los PDFs de "${formName}". ¿Continuar?`)) return;
  setBulkBusy(true);
  setBulkFeedback(null);
  const res = await requestBulkPdfApi(formId, { from, to, q });
  setBulkBusy(false);
  if (res.error || !res.data) {
    setBulkFeedback({ kind: 'err', msg: res.error ?? 'No se pudo iniciar la descarga masiva.' });
    return;
  }
  if (!res.data.ok) {
    setBulkFeedback({ kind: 'err', msg: res.data.message });
    return;
  }
  setBulkFeedback({ kind: 'ok', msg: res.data.message });
};
```

Agregar en el JSX (dentro del div de filtros, al final):

```tsx
<button
  type="button"
  onClick={handleBulk}
  disabled={bulkBusy || total === 0}
  className="ml-auto cursor-pointer rounded-md border-none bg-[#00c2a8] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
>
  {bulkBusy ? 'Enviando…' : `📦 Enviar todos por correo (${total})`}
</button>
```

Y bajo la tabla:

```tsx
{bulkFeedback && (
  <div className={`mt-3 rounded-md border px-3 py-2 text-[12px] ${bulkFeedback.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
    {bulkFeedback.kind === 'ok' ? '✓ ' : '⚠️ '}{bulkFeedback.msg}
  </div>
)}
```

- [ ] **Step 3: Typecheck y prueba**

```powershell
npm run build
```
Expected: 0 errores.

- [ ] **Step 4: Commit**

```powershell
git add src/services/api.ts src/components/reports/RecordsTable.tsx
git commit -m "feat(reports): boton 'Enviar todos por correo' en RecordsTable

Dispara POST bulk-pdf y muestra feedback. Confirm() antes de enviar.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4.2: Página pública `/records/download/:token`

**Files:**
- Create: `src/pages/RecordsDownloadPage.tsx`

**Interfaces:**
- Consumes: `getSecureDownloadMetaApi`, `consumeSecureDownloadApi` (helpers ya existentes tras el rename en Fase 3.1 — solo actualizar/aliasar si hace falta).
- Produces: página completa con state machine (loading / not_logged_in / verify_2fa / downloading / done / expired / error) — copiar y adaptar `ReportDownloadPage.tsx` cambiando labels a "PDFs".

- [ ] **Step 1: Clonar el archivo existente**

```powershell
Copy-Item src/pages/ReportDownloadPage.tsx src/pages/RecordsDownloadPage.tsx
```

- [ ] **Step 2: Ajustar labels**

Editar `src/pages/RecordsDownloadPage.tsx`:

- Cambiar todos los textos "reporte Excel" / "reporte" por "PDFs" / "archivo ZIP".
- Cambiar el subtítulo del header a "Descarga masiva de PDFs".
- Cambiar el mensaje final: "Se descargó el ZIP. Ábrelo con tu número de documento como contraseña."
- Después de descargar, si `getMeta` devolvía `kind` (Fase 3.1), mostrar copy distinto según `kind === 'bulk-pdf'`.

**Alternativa (recomendada por DRY):** en vez de clonar, agregar prop `kind` a `ReportDownloadPage` y montarlo desde dos rutas distintas. Decidir en el momento — si el 80% del código es idéntico, generalizar.

- [ ] **Step 3: Typecheck**

```powershell
npm run build
```
Expected: 0 errores.

- [ ] **Step 4: Commit (aún sin ruta registrada)**

```powershell
git add src/pages/RecordsDownloadPage.tsx
git commit -m "feat(records): RecordsDownloadPage clon adaptado del flujo Excel

Cambia labels a 'PDFs' / 'ZIP'. State machine identica: loading /
not_logged_in / verify_2fa / downloading / done / expired / error.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4.3: Ruta pública + safe-list `returnTo` + prueba end-to-end

**Files:**
- Modify: `src/router/AppRouter.tsx` (ruta pública)
- Modify: `src/router/routes/LoginRoute.tsx` (safe-list extendida)

**Interfaces:**
- Produces: ruta `/records/download/:token` accesible sin auth previo; `LoginRoute` acepta `returnTo=/records/download/*` como safe.

- [ ] **Step 1: Agregar ruta en `AppRouter`**

En `src/router/AppRouter.tsx`, junto a la ruta existente de `/reports/download`:

```tsx
import RecordsDownloadPage from '../pages/RecordsDownloadPage';

// dentro de <Routes>:
<Route path="/records/download/:token" element={<RecordsDownloadPage />} />
```

- [ ] **Step 2: Extender safe-list del `returnTo` en `LoginRoute`**

En `src/router/routes/LoginRoute.tsx`, buscar el bloque que valida `returnTo` y agregar el prefijo:

```ts
const SAFE_RETURN_TO_PREFIXES = [
  '/reports/download/',
  '/records/download/',
];
const isSafe = SAFE_RETURN_TO_PREFIXES.some((p) => returnTo?.startsWith(p));
```

Si el mecanismo actual usa un `startsWith('/reports/download/')` literal, sustituirlo por la lista anterior.

- [ ] **Step 3: Build**

```powershell
npm run build
```
Expected: 0 errores.

- [ ] **Step 4: Prueba end-to-end manual**

1. Levantar backend + frontend.
2. Ir a `/reports` → tab "Registros y PDFs".
3. Elegir formulario con envíos que tengan PDF (usar uno creado post-Fase 0).
4. Verificar tabla → clic fila → modal muestra PDF → botón "Descargar" guarda el archivo.
5. Clic "Enviar todos por correo" → confirmar → esperar feedback OK.
6. Abrir el correo → clic link → deberías ver la página de descarga con countdown.
7. Ingresar código 2FA → descargar ZIP.
8. Abrir ZIP con tu documento como contraseña → verificar que los PDFs están dentro con formato correcto.
9. Revisar `/admin/audit` que estén las 3 entradas: `SUBMISSION_PDF_DOWNLOADED` (por el paso 4), `SUBMISSIONS_BULK_PDF_REQUESTED` (paso 5), `SUBMISSIONS_BULK_PDF_DOWNLOADED` (paso 7).

Si algo falla, arreglar antes del commit final.

- [ ] **Step 5: Commit**

```powershell
git add src/router/AppRouter.tsx src/router/routes/LoginRoute.tsx
git commit -m "feat(router): ruta publica /records/download/:token + safe-list returnTo

Fin del flujo end-to-end: al abrir el link del correo, si no hay sesion
redirige al login con returnTo, y al autenticarse vuelve a la pagina de
descarga con el token intacto.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Cierre

Verificación final:

- [ ] `cd backend; npm run build && npm test; cd ..; npm run build`
- [ ] Todos los criterios de aceptación del spec ejecutados manualmente end-to-end.
- [ ] `git log --oneline` muestra todos los commits del plan.
- [ ] Si algo quedó sin verificar, documentarlo en la conversación antes de cerrar.
