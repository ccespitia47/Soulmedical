# SP1 · Plan 3 — Tipos nuevos + PDF/GridFS + vista de registros + navegación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sumar los 5 tipos de consentimiento restantes como definiciones del motor, exponer la descarga de PDF resolviendo binarios de GridFS, y entregar la navegación (selector de tipo) y la vista de registros unificada (listar/buscar/ver/editar/PDF/anular) dentro del apartado Consientify, con UI moderna.

**Architecture:** Cada tipo nuevo es un archivo de `ConsentDefinition` (Plan 2) registrado en un `definitionsRegistry`. Un `ConsentForm` genérico (shell) renderiza cualquier definición con `ConsentRenderer` + `useConsentSubmission`. Un selector de 6 tarjetas en `ConsentimientosPage` elige el tipo. La vista de registros usa `listConsentsApi`/`getConsentApi` y un endpoint backend `GET /consents/:id/pdf` que resuelve las referencias `gridfs:<id>` a data URLs para regenerar el PDF client-side.

**Tech Stack:** React 19, TypeScript estricto, Tailwind 4, Zustand 5; backend NestJS 11 + Mongoose (endpoint PDF).

**Spec:** `docs/superpowers/specs/2026-09-10-sp1-consentimientos-design.md`
**Depende de:** Plan 1 (API `/consents`) y Plan 2 (motor: `ConsentDefinition`, `ConsentRenderer`, `useConsentSubmission`, `consentsApi`, primitivas `PhotoField`/`LegalBlock`).
**Fuente de contenido clínico/legal:** `C:/proyectos/consentify_archivos_20260430/var/www/html/consentify/` (archivos `consen_*.php`, `guardar_consentimiento*.php`, `generar*_pdf.php`).

## Global Constraints

- TypeScript estricto; Atomic Design; componentes pequeños; mobile-first; dark mode; estilo Vercel.
- Fidelidad "modernizar y depurar": conservar TODOS los campos y el contenido clínico/legal, permitido reorganizar/limpiar; el usuario valida el contenido clínico/legal al final (marcar dudas en el reporte, no inventar texto legal).
- Multi-entidad SOLO Vacunación/Vacunación‑B; los otros tipos usan `ciudad`, sin `entidad`.
- Reusar el motor del Plan 2 sin duplicar lógica de render/PDF/envío.
- Binarios: el POST manda data URLs (Plan 1 los guarda en GridFS); la descarga los resuelve desde GridFS.
- Tests: mismo runner del front que Plan 2; backend con `npx jest` desde `backend/`.
- Commits en español, convencionales, con footer de atribución del proyecto.

---

### Task 1: Backend — endpoint de PDF (resuelve GridFS a data URLs)

**Files:**
- Modify: `backend/src/files/files.service.ts` (añadir `readAsDataUrl`)
- Modify: `backend/src/consents/consents.service.ts` (añadir `pdfPayload`)
- Modify: `backend/src/consents/consents.controller.ts` (`GET /consents/:id/pdf`)
- Modify: `backend/src/consents/consents.service.spec.ts` y `consents.controller.spec.ts`

**Interfaces:**
- Produces:
  - `FilesService.readAsDataUrl(ref: string): Promise<string | null>` — recibe `gridfs:<id>` (o id crudo), lee el archivo de GridFS a Buffer y devuelve `data:<contentType>;base64,<...>`; `null` si no existe.
  - `ConsentsService.pdfPayload(id): Promise<{ record: ConsentRecord; firmaPacienteDataUrl: string|null; firmaResponsableDataUrl: string|null; fotoDataUrl: string|null }>` — busca el registro (NotFound si no), resuelve sus refs con `readAsDataUrl`.
  - `GET /consents/:id/pdf` → `pdfPayload`. El front regenera el PDF con `buildConsentPdf` + estos data URLs.

- [ ] **Step 1: Write the failing tests**

```typescript
// añadir en backend/src/consents/consents.service.spec.ts
describe('ConsentsService.pdfPayload', () => {
  it('resuelve las refs gridfs de firmas/foto a data URLs', async () => {
    const { service, model, filesService } = makeDeps();
    model.findById = jest.fn().mockReturnValue({ lean: () => Promise.resolve({
      _id: 'r1', tipo: 'infectologia', firmaPaciente: 'gridfs:a', firmaResponsable: null, foto: 'gridfs:c',
    }) });
    filesService.readAsDataUrl = jest.fn()
      .mockResolvedValueOnce('data:image/png;base64,AA')  // firma
      .mockResolvedValueOnce('data:image/jpeg;base64,BB'); // foto
    const p = await service.pdfPayload('r1');
    expect(p.firmaPacienteDataUrl).toBe('data:image/png;base64,AA');
    expect(p.firmaResponsableDataUrl).toBeNull();
    expect(p.fotoDataUrl).toBe('data:image/jpeg;base64,BB');
  });
});
```

```typescript
// añadir en backend/src/consents/consents.controller.spec.ts
it('GET /consents/:id/pdf delega en pdfPayload', async () => {
  service.pdfPayload = jest.fn().mockResolvedValue({ record: { id: 'r1' }, firmaPacienteDataUrl: null, firmaResponsableDataUrl: null, fotoDataUrl: null });
  const r = await ctrl.pdf('r1');
  expect(service.pdfPayload).toHaveBeenCalledWith('r1');
  expect(r.record.id).toBe('r1');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (desde `backend/`): `npx jest src/consents/consents.service.spec.ts src/consents/consents.controller.spec.ts`
Expected: FAIL — `service.pdfPayload`/`ctrl.pdf` no existen.

- [ ] **Step 3: Write minimal implementation**

`FilesService.readAsDataUrl(ref)`: normaliza `gridfs:<id>`→id, abre `bucket.openDownloadStream(new Types.ObjectId(id))`, acumula chunks a Buffer, lee `contentType` de los metadatos del archivo (`bucket.find({_id}).next()`), devuelve `data:<ct>;base64,<buffer.toString('base64')>`; captura errores → `null`.
`ConsentsService.pdfPayload(id)`: `findOne(id)` (ya normaliza), resuelve `firmaPaciente`/`firmaResponsable`/`foto` con `readAsDataUrl` (null si la ref es null).
Controller: `@Get(':id/pdf') pdf(@Param('id') id) { return this.service.pdfPayload(id); }`.

- [ ] **Step 4: Run tests + build**

Run: `npx jest src/consents/` → PASS. Run: `npm run build` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/src/files/files.service.ts backend/src/consents/
git commit -m "feat(consents): endpoint GET /consents/:id/pdf (resuelve GridFS a data URLs)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Registro de definiciones + `ConsentForm` genérico + selector de tipo

**Files:**
- Create: `src/components/consents/definitions/index.ts` (registry)
- Create: `src/components/consents/ConsentForm.tsx` (shell genérico)
- Modify: `src/pages/ConsentimientosPage.tsx` (selector de 6 tarjetas)
- Test: `src/components/consents/definitions/index.spec.ts`

**Interfaces:**
- Consumes: `vacunacionDefinition` (Plan 2 Task 7), `ConsentRenderer`, `useConsentSubmission`, `buildConsentPdf`, `collectMissing`/`buildCreatePayload` (Plan 2).
- Produces:
  - `type ConsentTipo = 'vacunacion'|'vacunacion_b'|'tuberculina'|'venopuncion'|'vih'|'infectologia'`
  - `CONSENT_TYPES: { tipo: ConsentTipo; label: string; icon: string; multiEntidad: boolean }[]` (orden del selector)
  - `getDefinition(tipo: ConsentTipo, entity?: 'soul'|'sai'): ConsentDefinition` — resuelve la definición (vacunación usa entity; los demás ignoran entity). En esta task solo `vacunacion`/`vacunacion_b` pueden estar aún incompletos si se ejecuta antes que sus definiciones; el registry se completa en Tasks 3-5.
  - `ConsentForm({ tipo, entity?, onBack }: {...})` — shell: header (logo/título/código), `ConsentRenderer`, botones Vista previa PDF / Firmar y enviar, y modales `MissingFields`/`Success`/`Confirm` — generaliza `VaccinationConsentForm`.
  - `ConsentimientosPage` muestra un grid de tarjetas (una por tipo disponible); al elegir, renderiza `<ConsentForm tipo=... />`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/consents/definitions/index.spec.ts
import { describe, it, expect } from "vitest";
import { CONSENT_TYPES, getDefinition } from "./index";

describe("definitions registry", () => {
  it("expone los 6 tipos en orden con etiqueta e icono", () => {
    expect(CONSENT_TYPES.map((t) => t.tipo)).toEqual([
      "vacunacion", "vacunacion_b", "tuberculina", "venopuncion", "vih", "infectologia",
    ]);
    expect(CONSENT_TYPES.every((t) => t.label && t.icon)).toBe(true);
  });
  it("getDefinition('vih') devuelve una definición con meta.tipo vih", () => {
    expect(getDefinition("vih").meta.tipo).toBe("vih");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/consents/definitions/index.spec.ts`
Expected: FAIL — módulo/definiciones inexistentes. (Nota: este test pasa completo una vez existan las definiciones de Tasks 3-5; en el orden de ejecución, dejar `getDefinition` cableado y las definiciones faltantes lanzando un error claro hasta que existan, o ejecutar Task 2 después de 3-5. Recomendado: implementar el shell/registro aquí y agregar cada `tipo` al registry en su task de definición.)

- [ ] **Step 3: Write minimal implementation**

Crear `ConsentForm.tsx` generalizando `VaccinationConsentForm` (mismo header/preview/submit/modales, pero `tipo`-driven vía `getDefinition`). Crear el registry con `CONSENT_TYPES` y `getDefinition`. Refactorizar `ConsentimientosPage` para mostrar el selector de tarjetas (icono + label, estilo Vercel/dark) y, al elegir, renderizar `<ConsentForm tipo onBack={()=>setSel(null)} />`. Mantener el `onBack` a Consientify.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/consents/definitions/index.spec.ts` → PASS (tras Tasks 3-5). Run: `npm run build` → compila.

- [ ] **Step 5: Commit**

```bash
git add src/components/consents/definitions/index.ts src/components/consents/ConsentForm.tsx src/pages/ConsentimientosPage.tsx src/components/consents/definitions/index.spec.ts
git commit -m "feat(consents-front): registro de tipos + ConsentForm genérico + selector

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Definiciones VIH e Infectología (con foto)

**Files:**
- Create: `src/components/consents/definitions/vih.ts`
- Create: `src/components/consents/definitions/infectologia.ts`
- Modify: `src/components/consents/definitions/index.ts` (registrar ambos)
- Test: `src/components/consents/definitions/vih.spec.ts`

**Interfaces:**
- Consumes: `ConsentDefinition` (Plan 2).
- Produces: `vihDefinition: ConsentDefinition` y `infectologiaDefinition: ConsentDefinition`. Ambos: datos de identidad (nombres, apellidos, tipoDoc, numDoc, ciudad, profesional) + bloque legal + Habeas Data + firma paciente. Infectología añade además una sección `photo` (foto del paciente).
- **Fuente:** extraer campos y texto legal de `consentify/consen_vih.php` + `guardar_consentimientovih.php`, y `consen_infe.php` + `guardar_consentimientoinfe.php` (identidad + `foto`). Marcar en el reporte cualquier texto legal que deba validar el usuario.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/consents/definitions/vih.spec.ts
import { describe, it, expect } from "vitest";
import { vihDefinition } from "./vih";
import { infectologiaDefinition } from "./infectologia";

describe("definiciones VIH / Infectología", () => {
  it("VIH tiene identidad + legal + firma, sin entidad", () => {
    expect(vihDefinition.meta.tipo).toBe("vih");
    expect(vihDefinition.meta.entidad).toBeUndefined();
    const kinds = vihDefinition.sections.map((s) => s.kind);
    expect(kinds).toContain("fields");
    expect(kinds).toContain("legal");
    expect(kinds).toContain("signatures");
    const ids = (vihDefinition.sections.find((s) => s.kind === "fields") as any).fields.map((f: any) => f.id);
    expect(ids).toEqual(expect.arrayContaining(["nombres", "apellidos", "tipoDoc", "numDoc"]));
  });
  it("Infectología incluye una sección de foto", () => {
    expect(infectologiaDefinition.sections.some((s) => s.kind === "photo")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/consents/definitions/vih.spec.ts`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Write minimal implementation**

Leer las fuentes PHP indicadas, construir `vihDefinition` e `infectologiaDefinition` como `ConsentDefinition` (identidad → fields; consentimiento informado → legal + habeasData; firma → signatures; Infectología añade `photo`). Registrar ambos en `definitions/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/consents/definitions/vih.spec.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/consents/definitions/vih.ts src/components/consents/definitions/infectologia.ts src/components/consents/definitions/index.ts src/components/consents/definitions/vih.spec.ts
git commit -m "feat(consents-front): definiciones VIH e Infectología (con foto)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Definiciones Tuberculina y Venopunción

**Files:**
- Create: `src/components/consents/definitions/tuberculina.ts`
- Create: `src/components/consents/definitions/venopuncion.ts`
- Modify: `src/components/consents/definitions/index.ts`
- Test: `src/components/consents/definitions/tuberculina.spec.ts`

**Interfaces:**
- Produces: `tuberculinaDefinition` y `venopuncionDefinition` (`ConsentDefinition`).
- **Fuente:** `consen_tuber.php` + `guardar_consentimientot.php` (muchas preguntas clínicas: exposición, síntomas, tratamiento previo, medicación) y `consen_veno.php` + `guardar_consentimientov.php` (identidad + acompañante + profesional + ayuno/dieta/última menstruación). Conservar TODOS los campos; agrupar en secciones legibles.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/consents/definitions/tuberculina.spec.ts
import { describe, it, expect } from "vitest";
import { tuberculinaDefinition } from "./tuberculina";
import { venopuncionDefinition } from "./venopuncion";

describe("definiciones Tuberculina / Venopunción", () => {
  it("Tuberculina conserva identidad + preguntas clínicas + firma", () => {
    expect(tuberculinaDefinition.meta.tipo).toBe("tuberculina");
    const kinds = tuberculinaDefinition.sections.map((s) => s.kind);
    expect(kinds).toContain("fields");
    expect(kinds).toContain("signatures");
    // al menos una sección de preguntas (tristate) o campos clínicos adicionales
    expect(tuberculinaDefinition.sections.length).toBeGreaterThanOrEqual(3);
  });
  it("Venopunción incluye datos de acompañante y profesional", () => {
    const allIds = venopuncionDefinition.sections.flatMap((s: any) => (s.fields ?? []).map((f: any) => f.id));
    expect(allIds.some((id: string) => /acompan/i.test(id))).toBe(true);
    expect(allIds.some((id: string) => /profesional/i.test(id))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/consents/definitions/tuberculina.spec.ts`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Write minimal implementation**

Leer las fuentes PHP, construir ambas definiciones conservando todos los campos (identidad, preguntas clínicas como `fields`/`tristate`, acompañante/profesional en Venopunción), legal + firma. Registrar en `index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/consents/definitions/tuberculina.spec.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/consents/definitions/tuberculina.ts src/components/consents/definitions/venopuncion.ts src/components/consents/definitions/index.ts src/components/consents/definitions/tuberculina.spec.ts
git commit -m "feat(consents-front): definiciones Tuberculina y Venopunción

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Definición Vacunación‑B

**Files:**
- Create: `src/components/consents/definitions/vacunacionB.ts`
- Modify: `src/components/consents/definitions/index.ts`
- Test: `src/components/consents/definitions/vacunacionB.spec.ts`

**Interfaces:**
- Produces: `vacunacionBDefinition(entity: 'soul'|'sai'): ConsentDefinition` — variante B de vacunación (multi-entidad). **Fuente:** `consen_vacunaen.php`/`generarvacunab_pdf.php` (variante B) vs. la de Vacunación estándar.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/consents/definitions/vacunacionB.spec.ts
import { describe, it, expect } from "vitest";
import { vacunacionBDefinition } from "./vacunacionB";

describe("definición Vacunación‑B", () => {
  it("es multi-entidad y de tipo vacunacion_b", () => {
    const def = vacunacionBDefinition("soul");
    expect(def.meta.tipo).toBe("vacunacion_b");
    expect(def.meta.entidad).toBe("SOUL");
    expect(def.sections.some((s) => s.kind === "signatures")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/consents/definitions/vacunacionB.spec.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Write minimal implementation**

Construir `vacunacionBDefinition(entity)` a partir de la fuente PHP de la variante B (reutilizar la estructura de `vacunacionDefinition` de Plan 2 donde coincida). Registrar `vacunacion_b` en `index.ts` (usando `entity`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/consents/definitions/vacunacionB.spec.ts` → PASS. Run: `npm run build` → compila. Ahora `definitions/index.spec.ts` (Task 2) pasa completo (6 tipos).

- [ ] **Step 5: Commit**

```bash
git add src/components/consents/definitions/vacunacionB.ts src/components/consents/definitions/index.ts src/components/consents/definitions/vacunacionB.spec.ts
git commit -m "feat(consents-front): definición Vacunación‑B

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Vista de registros unificada (listar/buscar/ver/editar/PDF/anular)

**Files:**
- Create: `src/components/consents/records/ConsentRecordsPage.tsx`
- Create: `src/components/consents/records/useConsentRecords.ts`
- Modify: `src/pages/Consientify.tsx` (tile "Reportes"/"Registros" → abre la vista)
- Test: `src/components/consents/records/useConsentRecords.spec.ts`

**Interfaces:**
- Consumes: `listConsentsApi`, `getConsentApi`, `anularConsentApi`, `verifyConsentApi` (Plan 2 Task 1), `GET /consents/:id/pdf` (Task 1 aquí), `getDefinition`/`buildConsentPdf`/`htmlToPdfBase64`.
- Produces:
  - `useConsentRecords()` — estado de la tabla: `{ rows, total, page, limit, filters, setFilters, setPage, refetch, loading }` sobre `listConsentsApi`.
  - `ConsentRecordsPage` — tabla moderna (documento/nombre/fecha, filtro por tipo y rango), acciones por fila: **ver**, **descargar PDF** (llama `/pdf` → `buildConsentPdf(getDefinition(tipo), respuestas+identidad)` con los data URLs → `htmlToPdfBase64` → descarga), **editar** (reabre `ConsentForm` en modo edición con `getConsentApi`), **anular**, **reenviar correo**. Reutiliza un solo componente de tabla para los 6 tipos.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/consents/records/useConsentRecords.spec.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("../../../services/api", () => ({ listConsentsApi: vi.fn() }));
import { useConsentRecords } from "./useConsentRecords";
import { listConsentsApi } from "../../../services/api";

describe("useConsentRecords", () => {
  beforeEach(() => vi.clearAllMocks());
  it("carga la primera página y aplica filtros", async () => {
    (listConsentsApi as any).mockResolvedValue({ data: { data: [{ id: "r1" }], total: 1, page: 1, limit: 50 }, error: null });
    const { result } = renderHook(() => useConsentRecords());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    act(() => result.current.setFilters({ tipo: "vih" }));
    await waitFor(() => expect(listConsentsApi).toHaveBeenLastCalledWith(expect.objectContaining({ tipo: "vih" })));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/consents/records/useConsentRecords.spec.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Write minimal implementation**

Implementar `useConsentRecords` (efecto que llama `listConsentsApi` con `filters/page/limit`, expone rows/total/loading, `setFilters` reinicia a page 1). Implementar `ConsentRecordsPage` (tabla + filtros + acciones descritas; descarga de PDF vía el endpoint `/pdf` + `buildConsentPdf`; editar reabre `ConsentForm`). Cablear el tile en `Consientify.tsx` (habilitar "Registros"/"Reportes" para abrir la vista).

- [ ] **Step 4: Run test + build**

Run: `npx vitest run src/components/consents/records/useConsentRecords.spec.ts` → PASS. Run: `npm run build` → compila. Smoke manual: listar, filtrar por tipo, ver/descargar PDF, anular.

- [ ] **Step 5: Commit**

```bash
git add src/components/consents/records/ src/pages/Consientify.tsx
git commit -m "feat(consents-front): vista de registros unificada (listar/buscar/ver/editar/PDF/anular)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:** 6 tipos (spec §2) → Tasks 3,4,5 (+ Vacunación de Plan 2). PDF/descarga con GridFS (spec §7/§9) → Task 1. Selector/navegación (spec §10) → Task 2. Vista de registros: listar/buscar/ver/editar/PDF/anular (spec §9) → Task 6. ✔
**2. Placeholder scan:** cada task trae test real; las definiciones nombran las fuentes PHP exactas a extraer, con la instrucción de marcar dudas legales para el usuario (fidelidad "modernizar y depurar"). ✔
**3. Type consistency:** `ConsentDefinition`/`ConsentTipo`/`getDefinition` consistentes entre registry (Task 2) y definiciones (Tasks 3-5); `pdfPayload` (Task 1) alimenta `buildConsentPdf` en Task 6. ✔

## Notas de ejecución / dependencias
- Orden recomendado: Task 1 (backend PDF) → Tasks 3,4,5 (definiciones) → Task 2 (registry/selector, que las consume) → Task 6 (registros). El `index.spec.ts` de Task 2 pasa completo una vez existan las 6 definiciones.
- Contenido clínico/legal: el implementador extrae de las fuentes PHP y **marca en el reporte** lo que el usuario debe validar; no inventar texto legal.
- Confirmar el runner del front (Vitest/Jest) y `@testing-library/react` como en Plan 2.
