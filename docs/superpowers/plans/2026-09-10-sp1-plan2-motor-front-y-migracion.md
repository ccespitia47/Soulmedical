# SP1 · Plan 2 — Motor de consentimientos (front) + migración de Vacunación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalizar el consentimiento de Vacunación en un motor config-driven (definición → renderer → PDF → envío a la API `/consents` del Plan 1), reexpresar Vacunación sobre ese motor sin cambiar su comportamiento, y migrar sus envíos existentes a la colección `consent_records`.

**Architecture:** Un tipo `ConsentDefinition` (evolución de `EntityConfig`) describe cualquier consentimiento como secciones ordenadas de campos tipados. Un `ConsentRenderer` pinta la definición reutilizando las primitivas existentes (`FieldGrid`, `TriStateQuestion`, `CheckboxGroupField`, `VaccineTable`, `SignaturePad`) más dos nuevas (`PhotoField`, `LegalBlock`). `useConsentSubmission(definition)` aplana + valida + postea a la API `/consents` (Plan 1) y genera/enví­a el PDF. Vacunación pasa a ser una definición (SAI/SOUL) renderizada por el motor. Un script de backend migra las submissions de Vacunación a `consent_records`.

**Tech Stack:** React 19, TypeScript estricto, Vite, Tailwind 4, Zustand 5; backend NestJS 11 + Mongoose (solo el script de migración).

**Spec:** `docs/superpowers/specs/2026-09-10-sp1-consentimientos-design.md`
**Depende de:** Plan 1 (API `/consents` en `feature/sp1-consentimientos`).

## Global Constraints

- TypeScript estricto; Atomic Design; hooks reutilizables; componentes pequeños; evitar archivos gigantes; mobile-first; dark mode; estilo Vercel.
- El motor NO rompe el comportamiento actual de Vacunación (tests de caracterización antes del refactor).
- Nuevos envíos van a la API `/consents` (Plan 1), NO a `addSubmission`.
- Binarios (firma/foto) viajan como data URL en el POST; el backend ya los sube a GridFS (Plan 1).
- Cliente HTTP: reusar `request<T>(endpoint, options)` de `src/services/api.ts` (Bearer token desde localStorage).
- Tests: Vitest/Jest según config del front (`npx vitest run <ruta>` o el runner configurado; verificar en `package.json`). Specs co-locados.
- Multi-entidad SOLO Vacunación.
- Commits en español, convencionales, con footer de atribución del proyecto.

---

### Task 1: Cliente API de consentimientos

**Files:**
- Modify: `src/services/api.ts` (añadir funciones + tipos al final)
- Test: `src/services/consentsApi.spec.ts`

**Interfaces:**
- Consumes: `request<T>` interno de `api.ts` (reutilizar el patrón exportando helpers nuevos que llamen a `/consents`).
- Produces:
  - `type ConsentRecordDto = { id: string; tipo: string; entidad: 'SAI'|'SOUL'|null; tipoDoc: string; numDoc: string; nombres: string; apellidos: string; ciudad: string|null; profesional: string|null; estado: string; respuestas: Record<string, unknown>; firmaPaciente: string|null; firmaResponsable: string|null; foto: string|null; hashVerificacion: string; createdAt: string; creadoPor?: string|null }`
  - `type CreateConsentPayload = { tipo: string; entidad?: 'SAI'|'SOUL'; tipoDoc: string; numDoc: string; nombres: string; apellidos: string; ciudad?: string; profesional?: string; respuestas: Record<string, unknown>; firmaPaciente: string; firmaResponsable?: string; foto?: string }`
  - `createConsentApi(payload): Promise<ApiResponse<ConsentRecordDto>>` → `POST /consents`
  - `listConsentsApi(params): Promise<ApiResponse<{ data: ConsentRecordDto[]; total: number; page: number; limit: number }>>` → `GET /consents?...`
  - `getConsentApi(id): Promise<ApiResponse<ConsentRecordDto>>` → `GET /consents/:id`
  - `updateConsentApi(id, payload): Promise<ApiResponse<ConsentRecordDto>>` → `PATCH /consents/:id`
  - `anularConsentApi(id): Promise<ApiResponse<ConsentRecordDto>>` → `POST /consents/:id/anular`
  - `verifyConsentApi(id): Promise<ApiResponse<{ valido: boolean; hash: string }>>` → `GET /consents/:id/verificar`

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/consentsApi.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createConsentApi, listConsentsApi } from "./api";

describe("consentsApi", () => {
  beforeEach(() => {
    localStorage.setItem("token", "jwt-abc");
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("createConsentApi hace POST /consents con Bearer token y body", async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "r1" }) });
    const res = await createConsentApi({
      tipo: "vih", tipoDoc: "CC", numDoc: "1", nombres: "A", apellidos: "B",
      respuestas: {}, firmaPaciente: "data:image/png;base64,AA",
    });
    expect(res.data?.id).toBe("r1");
    const [url, opts] = (fetch as any).mock.calls[0];
    expect(url).toMatch(/\/consents$/);
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe("Bearer jwt-abc");
  });

  it("listConsentsApi arma el querystring de filtros", async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [], total: 0, page: 1, limit: 50 }) });
    await listConsentsApi({ tipo: "vih", page: 2, limit: 10, search: "juan" });
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toMatch(/tipo=vih/);
    expect(url).toMatch(/page=2/);
    expect(url).toMatch(/search=juan/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/consentsApi.spec.ts`
Expected: FAIL — `createConsentApi` no exportado. (Si el runner del front es Jest, usar `npx jest`; confirmar en `package.json`.)

- [ ] **Step 3: Write minimal implementation (añadir al final de `src/services/api.ts`)**

```typescript
// ─── Consentimientos (API dedicada, Plan 1) ──────────────────────────────
export type ConsentRecordDto = {
  id: string; tipo: string; entidad: "SAI" | "SOUL" | null;
  tipoDoc: string; numDoc: string; nombres: string; apellidos: string;
  ciudad: string | null; profesional: string | null; estado: string;
  respuestas: Record<string, unknown>;
  firmaPaciente: string | null; firmaResponsable: string | null; foto: string | null;
  hashVerificacion: string; createdAt: string; creadoPor?: string | null;
};
export type CreateConsentPayload = {
  tipo: string; entidad?: "SAI" | "SOUL";
  tipoDoc: string; numDoc: string; nombres: string; apellidos: string;
  ciudad?: string; profesional?: string;
  respuestas: Record<string, unknown>;
  firmaPaciente: string; firmaResponsable?: string; foto?: string;
};

export function createConsentApi(payload: CreateConsentPayload) {
  return request<ConsentRecordDto>("/consents", { method: "POST", body: JSON.stringify(payload) });
}
export function listConsentsApi(params: {
  tipo?: string; search?: string; from?: string; to?: string; page?: number; limit?: number;
} = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== "") qs.set(k, String(v)); });
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<{ data: ConsentRecordDto[]; total: number; page: number; limit: number }>(`/consents${suffix}`);
}
export function getConsentApi(id: string) {
  return request<ConsentRecordDto>(`/consents/${id}`);
}
export function updateConsentApi(id: string, payload: Partial<CreateConsentPayload>) {
  return request<ConsentRecordDto>(`/consents/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}
export function anularConsentApi(id: string) {
  return request<ConsentRecordDto>(`/consents/${id}/anular`, { method: "POST" });
}
export function verifyConsentApi(id: string) {
  return request<{ valido: boolean; hash: string }>(`/consents/${id}/verificar`);
}
```

> NOTA: `request` es función interna del módulo; estas funciones se añaden EN `api.ts` para reutilizarla. Si `request` no está exportada, no hace falta exportarla — las funciones nuevas viven en el mismo archivo.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/consentsApi.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/api.ts src/services/consentsApi.spec.ts
git commit -m "feat(consents-front): cliente API de consentimientos (/consents)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Tipo `ConsentDefinition` + estado (flatten/validación) genéricos

**Files:**
- Create: `src/components/consents/engine/consentDefinition.ts`
- Create: `src/components/consents/engine/consentState.ts`
- Test: `src/components/consents/engine/consentState.spec.ts`

**Interfaces:**
- Consumes: los tipos de campo existentes en `config/entityConfig.ts` (`ConsentField`, `TriStateQ`, `ConditionsGroup`, `VaccineTableColumn`) — reexportarlos/reutilizarlos.
- Produces:
  - `type ConsentSection = { id: string; title?: string; kind: 'fields'|'tristate'|'conditions'|'vaccineTable'|'legal'|'signatures'; ... }` — una sección discriminada por `kind`, cada una con su payload tipado (fields: `ConsentField[]`; tristate: `TriStateQ[]`; conditions: `ConditionsGroup`; vaccineTable: `{columns}`; legal: `{ legalText: string; habeasData: string; acceptId: string }`; signatures: `{ firmaPaciente:{id,label}; firmaResponsable?:{id,label} }`; y un tipo opcional `photo: { id: string; label: string }`).
  - `type ConsentDefinition = { meta: { tipo: string; entidad?: 'SAI'|'SOUL'; titulo: string; entidadNombre: string; displayName: string; codigo: string; version: string; logo: string }; sections: ConsentSection[] }`
  - `type ConsentState = { values: Record<string,string>; firma: string; firmaResp: string; foto: string; accepted: boolean }`
  - `collectMissing(def: ConsentDefinition, state: ConsentState): string[]`
  - `flattenConsent(def: ConsentDefinition, state: ConsentState): Record<string,string>`
  - `buildCreatePayload(def, state): CreateConsentPayload` — mapea identidad (por convención de ids `nombres/apellidos/tipo_doc|tipoDoc/num_doc|numDoc/ciudad/profesional`) a columnas y el resto a `respuestas`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/consents/engine/consentState.spec.ts
import { describe, it, expect } from "vitest";
import { collectMissing, flattenConsent, buildCreatePayload } from "./consentState";
import type { ConsentDefinition, ConsentState } from "./consentDefinition";

const def: ConsentDefinition = {
  meta: { tipo: "vih", titulo: "VIH", entidadNombre: "SOUL", displayName: "SOUL", codigo: "C1", version: "1", logo: "" },
  sections: [
    { id: "grales", kind: "fields", title: "Datos", fields: [
      { id: "nombres", label: "Nombres", type: "text", required: true },
      { id: "apellidos", label: "Apellidos", type: "text", required: true },
      { id: "tipoDoc", label: "Tipo doc", type: "text", required: true },
      { id: "numDoc", label: "N° doc", type: "text", required: true },
      { id: "ciudad", label: "Ciudad", type: "text" },
    ] },
    { id: "legal", kind: "legal", legalText: "...", habeasData: "...", acceptId: "acepta" },
    { id: "firmas", kind: "signatures", firmaPaciente: { id: "firma_paciente", label: "Firma" } },
  ],
};

const full: ConsentState = {
  values: { nombres: "Juan", apellidos: "Perez", tipoDoc: "CC", numDoc: "1", ciudad: "Bogota" },
  firma: "data:image/png;base64,AA", firmaResp: "", foto: "", accepted: true,
};

describe("consentState", () => {
  it("collectMissing exige requeridos, aceptación y firma", () => {
    expect(collectMissing(def, full)).toHaveLength(0);
    const miss = collectMissing(def, { ...full, values: {}, accepted: false, firma: "" });
    expect(miss).toContain("Nombres");
    expect(miss).toContain("Aceptar el consentimiento informado");
  });

  it("flattenConsent incluye valores + firma + aceptación", () => {
    const flat = flattenConsent(def, full);
    expect(flat.firma_paciente).toBe("data:image/png;base64,AA");
    expect(flat.acepta).toBe("Sí");
  });

  it("buildCreatePayload separa identidad de respuestas", () => {
    const p = buildCreatePayload(def, full);
    expect(p.tipo).toBe("vih");
    expect(p.nombres).toBe("Juan");
    expect(p.numDoc).toBe("1");
    expect(p.firmaPaciente).toBe("data:image/png;base64,AA");
    expect(p.respuestas.acepta).toBe("Sí");
    expect(p.respuestas.nombres).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/consents/engine/consentState.spec.ts`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Write minimal implementation**

`consentDefinition.ts`: definir los tipos descritos en Interfaces (reutilizando `ConsentField`/`TriStateQ`/`ConditionsGroup`/`VaccineTableColumn` importados desde `../config/entityConfig`). `consentState.ts`: implementar `collectMissing` (recorre secciones: fields.required, tristate.required, signatures obligatoria, legal→accepted), `flattenConsent` (spread values + firma ids + accept id), y `buildCreatePayload` (extrae `nombres/apellidos/tipoDoc/numDoc/ciudad/profesional` de values por id; el resto del flatten va a `respuestas`; `entidad` desde `def.meta.entidad`). Escribir el código completo siguiendo las firmas del test.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/consents/engine/consentState.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/consents/engine/consentDefinition.ts src/components/consents/engine/consentState.ts src/components/consents/engine/consentState.spec.ts
git commit -m "feat(consents-front): tipo ConsentDefinition + estado genérico (flatten/validación)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Primitivas nuevas `PhotoField` y `LegalBlock`

**Files:**
- Create: `src/components/consents/fields/PhotoField.tsx`
- Create: `src/components/consents/fields/LegalBlock.tsx`
- Test: `src/components/consents/fields/PhotoField.spec.tsx`

**Interfaces:**
- Produces:
  - `PhotoField({ label, value, onChange }: { label: string; value: string; onChange: (dataUrl: string) => void })` — `<input type="file" accept="image/*">` que lee a data URL (FileReader) y muestra preview; valor vacío = sin foto.
  - `LegalBlock({ legalText, habeasData }: { legalText: string; habeasData: string })` — renderiza párrafos (split `\n\n`) con el estilo `cardCls`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/consents/fields/PhotoField.spec.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PhotoField from "./PhotoField";

describe("PhotoField", () => {
  it("lee el archivo a data URL y llama onChange", async () => {
    const onChange = vi.fn();
    render(<PhotoField label="Foto" value="" onChange={onChange} />);
    const file = new File(["x"], "f.png", { type: "image/png" });
    const input = screen.getByLabelText(/foto/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect((onChange.mock.calls[0][0] as string).startsWith("data:")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/consents/fields/PhotoField.spec.tsx`
Expected: FAIL — módulo inexistente. (Confirmar que `@testing-library/react` está instalado; si no, el front usa otro método de test de componentes — seguir el patrón existente de tests de componentes del repo.)

- [ ] **Step 3: Write minimal implementation**

Implementar `PhotoField` (input file → `FileReader.readAsDataURL` → `onChange(reader.result)`, preview `<img>` si `value`) y `LegalBlock` (map de `legalText.split("\n\n")` + bloque Habeas Data), usando las clases Tailwind de `sections/sharedUi.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/consents/fields/PhotoField.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/consents/fields/PhotoField.tsx src/components/consents/fields/LegalBlock.tsx src/components/consents/fields/PhotoField.spec.tsx
git commit -m "feat(consents-front): primitivas PhotoField y LegalBlock

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `ConsentRenderer` (pinta una definición)

**Files:**
- Create: `src/components/consents/engine/ConsentRenderer.tsx`
- Test: `src/components/consents/engine/ConsentRenderer.spec.tsx`

**Interfaces:**
- Consumes: `ConsentDefinition`, `ConsentState` (Task 2); primitivas `FieldGrid` (`sections/sharedUi`), `TriStateQuestion`, `CheckboxGroupField`, `VaccineTable`, `SignaturePad`, `PhotoField`, `LegalBlock`.
- Produces: `ConsentRenderer({ definition, state, onChange }: { definition: ConsentDefinition; state: ConsentState; onChange: (patch: Partial<ConsentState>) => void })` — recorre `definition.sections` y renderiza cada `kind` con su primitiva, dentro de tarjetas (`cardCls`). Cambios de valor llaman `onChange`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/consents/engine/ConsentRenderer.spec.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConsentRenderer from "./ConsentRenderer";
import type { ConsentDefinition, ConsentState } from "./consentDefinition";

const def: ConsentDefinition = {
  meta: { tipo: "vih", titulo: "VIH", entidadNombre: "SOUL", displayName: "SOUL", codigo: "C", version: "1", logo: "" },
  sections: [{ id: "g", kind: "fields", title: "Datos", fields: [{ id: "nombres", label: "Nombres", type: "text", required: true }] }],
};
const state: ConsentState = { values: {}, firma: "", firmaResp: "", foto: "", accepted: false };

describe("ConsentRenderer", () => {
  it("renderiza campos y propaga cambios", () => {
    const onChange = vi.fn();
    render(<ConsentRenderer definition={def} state={state} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/nombres/i), { target: { value: "Ana" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ values: expect.objectContaining({ nombres: "Ana" }) }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/consents/engine/ConsentRenderer.spec.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Write minimal implementation**

`ConsentRenderer` recorre `definition.sections` con un `switch (section.kind)` y renderiza la primitiva correspondiente, cableando lecturas/escrituras contra `state`/`onChange` (para `fields` usa `FieldGrid`; `tristate` mapea `TriStateQuestion`; `conditions` → `CheckboxGroupField`; `vaccineTable` → `VaccineTable`; `photo` → `PhotoField`; `legal` → `LegalBlock` + checkbox de aceptación; `signatures` → `SignaturePad` paciente/responsable). Un `<section>` por `kind`, envuelto en `cardCls`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/consents/engine/ConsentRenderer.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/consents/engine/ConsentRenderer.tsx src/components/consents/engine/ConsentRenderer.spec.tsx
git commit -m "feat(consents-front): ConsentRenderer config-driven

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `buildConsentPdf` genérico

**Files:**
- Create: `src/components/consents/engine/buildConsentPdf.ts`
- Test: `src/components/consents/engine/buildConsentPdf.spec.ts`

**Interfaces:**
- Consumes: `ConsentDefinition`, flatten `Record<string,string>`; reutilizar el estilo/estructura de `vaccinationConsentPdf.ts` (encabezado con logo/código/versión, secciones, firmas embebidas como `<img src=dataUrl>`, texto legal).
- Produces: `buildConsentPdf(def: ConsentDefinition, flat: Record<string,string>): string` (HTML listo para `htmlToPdfBase64`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/consents/engine/buildConsentPdf.spec.ts
import { describe, it, expect } from "vitest";
import { buildConsentPdf } from "./buildConsentPdf";
import type { ConsentDefinition } from "./consentDefinition";

const def: ConsentDefinition = {
  meta: { tipo: "vih", titulo: "Consentimiento VIH", entidadNombre: "SOULMEDICAL", displayName: "SOUL", codigo: "C1", version: "2", logo: "" },
  sections: [
    { id: "g", kind: "fields", title: "Datos", fields: [{ id: "nombres", label: "Nombres", type: "text" }] },
    { id: "legal", kind: "legal", legalText: "Párrafo 1\n\nPárrafo 2", habeasData: "HD", acceptId: "acepta" },
    { id: "f", kind: "signatures", firmaPaciente: { id: "firma_paciente", label: "Firma" } },
  ],
};

describe("buildConsentPdf", () => {
  it("incluye título, código/versión, valores y firma embebida", () => {
    const html = buildConsentPdf(def, { nombres: "Juan", firma_paciente: "data:image/png;base64,AA", acepta: "Sí" });
    expect(html).toContain("Consentimiento VIH");
    expect(html).toContain("C1");
    expect(html).toContain("Juan");
    expect(html).toContain("Párrafo 2");
    expect(html).toContain("data:image/png;base64,AA");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/consents/engine/buildConsentPdf.spec.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Write minimal implementation**

Implementar `buildConsentPdf` recorriendo `def.sections` y emitiendo HTML por `kind` (encabezado con `meta`, tablas de `fields`, listas de `tristate` con su respuesta desde `flat`, `vaccineTable` desde el JSON en `flat`, `legal` con párrafos + Habeas Data, `signatures`/`photo` como `<img>`). Basarse en la estructura y estilos de `vaccinationConsentPdf.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/consents/engine/buildConsentPdf.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/consents/engine/buildConsentPdf.ts src/components/consents/engine/buildConsentPdf.spec.ts
git commit -m "feat(consents-front): generador de PDF config-driven

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: `useConsentSubmission(definition)` → API `/consents`

**Files:**
- Create: `src/components/consents/engine/useConsentSubmission.ts`
- Test: `src/components/consents/engine/useConsentSubmission.spec.ts`

**Interfaces:**
- Consumes: `createConsentApi` (Task 1), `buildCreatePayload`/`flattenConsent` (Task 2), `buildConsentPdf` (Task 5), `htmlToPdfBase64`, el servicio de email existente (`sendFormEmail`) — mismo flujo que `useVaccinationConsent`.
- Produces: `useConsentSubmission(def)` → `{ submitConsent(state): Promise<void>; submitting; emailStatus; emailError; done; reset }`. `submitConsent`: `buildCreatePayload` → `createConsentApi` (persiste en `consent_records`); si OK, genera PDF y envía correo (clínica + paciente) reutilizando el patrón de `useVaccinationConsent`. Si el POST falla, expone el error (no lanza).

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/consents/engine/useConsentSubmission.spec.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../../../services/api", () => ({
  createConsentApi: vi.fn(),
}));
vi.mock("../../../utils/pdfExporter", () => ({ htmlToPdfBase64: vi.fn().mockResolvedValue("BASE64") }));
vi.mock("../../../services/emailService", () => ({ sendFormEmail: vi.fn().mockResolvedValue(undefined) }));

import { useConsentSubmission } from "./useConsentSubmission";
import { createConsentApi } from "../../../services/api";
import type { ConsentDefinition, ConsentState } from "./consentDefinition";

const def: ConsentDefinition = {
  meta: { tipo: "vih", titulo: "VIH", entidadNombre: "SOUL", displayName: "SOUL", codigo: "C", version: "1", logo: "" },
  sections: [
    { id: "g", kind: "fields", fields: [{ id: "nombres", label: "Nombres", type: "text" }, { id: "numDoc", label: "Doc", type: "text" }] },
    { id: "f", kind: "signatures", firmaPaciente: { id: "firma_paciente", label: "Firma" } },
  ],
};
const state: ConsentState = { values: { nombres: "Juan", numDoc: "1" }, firma: "data:image/png;base64,AA", firmaResp: "", foto: "", accepted: true };

describe("useConsentSubmission", () => {
  beforeEach(() => vi.clearAllMocks());
  it("persiste vía createConsentApi con el payload del estado", async () => {
    (createConsentApi as any).mockResolvedValue({ data: { id: "r1" }, error: null });
    const { result } = renderHook(() => useConsentSubmission(def));
    await act(async () => { await result.current.submitConsent(state); });
    expect(createConsentApi).toHaveBeenCalledWith(expect.objectContaining({ tipo: "vih", nombres: "Juan", numDoc: "1", firmaPaciente: "data:image/png;base64,AA" }));
    expect(result.current.done).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/consents/engine/useConsentSubmission.spec.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Write minimal implementation**

Implementar el hook reproduciendo la estructura de `useVaccinationConsent.ts` pero: `buildCreatePayload(def, state)` → `await createConsentApi(payload)`; si `error`, set `emailError`/estado y NO enviar correo; si OK, `buildConsentPdf` → `htmlToPdfBase64` → `sendFormEmail` (mismo template que Vacunación, parametrizado por `def.meta`). Manejar `submitting/emailStatus/emailError/done/reset`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/consents/engine/useConsentSubmission.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/consents/engine/useConsentSubmission.ts src/components/consents/engine/useConsentSubmission.spec.ts
git commit -m "feat(consents-front): hook de envío a la API de consentimientos

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Vacunación como `ConsentDefinition` + refactor del formulario (comportamiento preservado)

**Files:**
- Create: `src/components/consents/definitions/vacunacion.ts` (deriva `ConsentDefinition` SOUL/SAI desde los `EntityConfig` existentes)
- Modify: `src/components/consents/VaccinationConsentForm.tsx` (usar `ConsentRenderer` + `useConsentSubmission`)
- Test: `src/components/consents/definitions/vacunacion.spec.ts` (caracterización: la definición produce las mismas secciones/campos que el `EntityConfig`)

**Interfaces:**
- Consumes: `soulConfig`/`saiConfig` (`config/`), tipos del motor (Tasks 2,4,6).
- Produces: `vacunacionDefinition(entity: 'soul'|'sai'): ConsentDefinition` mapeando `EntityConfig` → secciones del motor. El formulario mantiene: selector de entidad, vista previa PDF, MissingFields/Success/Confirm modals, y el mismo resultado de envío (ahora vía API).

- [ ] **Step 1: Write the failing (characterization) test**

```typescript
// src/components/consents/definitions/vacunacion.spec.ts
import { describe, it, expect } from "vitest";
import { vacunacionDefinition } from "./vacunacion";
import { getEntityConfig } from "../config";

describe("vacunacionDefinition (caracterización)", () => {
  it("mapea los datos generales del EntityConfig SOUL sin perder campos", () => {
    const cfg = getEntityConfig("soul");
    const def = vacunacionDefinition("soul");
    const grales = def.sections.find((s) => s.kind === "fields");
    const ids = (grales as any).fields.map((f: any) => f.id).sort();
    expect(ids).toEqual(cfg.datosGenerales.map((f) => f.id).sort());
    expect(def.meta.entidad).toBe("SOUL");
    expect(def.meta.codigo).toBe(cfg.meta.codigo);
  });

  it("incluye una sección de firmas con firma de paciente y responsable", () => {
    const def = vacunacionDefinition("soul");
    const firmas = def.sections.find((s) => s.kind === "signatures") as any;
    expect(firmas.firmaPaciente).toBeTruthy();
    expect(firmas.firmaResponsable).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/consents/definitions/vacunacion.spec.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Write minimal implementation**

Implementar `vacunacionDefinition(entity)` que arma un `ConsentDefinition` a partir del `EntityConfig` (datosGenerales→fields; seccionA condiciones→conditions + tristates; seccionB/virusVivos→tristate; seccionC→vaccineTable; legalText/habeasData→legal; firmas→signatures). Luego refactorizar `VaccinationConsentForm.tsx` para: derivar `def = vacunacionDefinition(entityKey)`, manejar `state` con el motor, renderizar `<ConsentRenderer definition={def} state={state} onChange={patch}/>`, usar `useConsentSubmission(def)` en submit y `buildConsentPdf` en la vista previa. Conservar header/selector/modales.

- [ ] **Step 4: Run test + smoke manual**

Run: `npx vitest run src/components/consents/definitions/vacunacion.spec.ts` → PASS.
Run: `npm run build` (raíz) → compila. Verificación manual (en el reporte): el formulario de Vacunación abre, valida, previsualiza PDF y envía igual que antes.

- [ ] **Step 5: Commit**

```bash
git add src/components/consents/definitions/vacunacion.ts src/components/consents/VaccinationConsentForm.tsx src/components/consents/definitions/vacunacion.spec.ts
git commit -m "refactor(consents-front): Vacunación sobre el motor config-driven

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Script de migración — submissions de Vacunación → `consent_records`

**Files:**
- Create: `backend/src/consents/migrate-vaccination.ts` (script one-off, ejecutable con ts-node)
- Test: `backend/src/consents/migrate-vaccination.spec.ts`

**Interfaces:**
- Consumes: modelos Mongoose `FormSubmission` y `ConsentRecord`; los formIds de Vacunación (SAI/SOUL) desde `consents.seeder.ts`; el mapeo de field-ids desde `EntityConfig`/seeder.
- Produces: `mapSubmissionToConsent(sub, entidad): Partial<ConsentRecord>` (función pura, testeable) y un `runMigration({ dryRun })` que lee submissions de los formIds de Vacunación, mapea y hace upsert en `consent_records` (idempotente por un campo `origenSubmissionId`), verifica conteos e imprime un resumen. Reversible: `origenSubmissionId` permite borrar lo migrado.

- [ ] **Step 1: Write the failing test (función pura de mapeo)**

```typescript
// backend/src/consents/migrate-vaccination.spec.ts
import { mapSubmissionToConsent } from './migrate-vaccination';

describe('mapSubmissionToConsent', () => {
  it('mapea identidad a columnas y el resto a respuestas, conservando firmas gridfs', () => {
    const sub: any = {
      _id: 's1',
      submittedById: 5,
      submittedAt: new Date('2026-07-01'),
      data: {
        nombres: 'Juan', apellidos: 'Perez', tipo_doc: 'CC', num_doc: '900064854',
        ciudad: 'Bogota', firma_paciente: 'gridfs:aaa', firma_responsable: 'gridfs:bbb',
        pregunta_1: 'No',
      },
    };
    const rec = mapSubmissionToConsent(sub, 'SOUL');
    expect(rec.tipo).toBe('vacunacion');
    expect(rec.entidad).toBe('SOUL');
    expect(rec.numDoc).toBe('900064854');
    expect(rec.firmaPaciente).toBe('gridfs:aaa');
    expect((rec.respuestas as any).pregunta_1).toBe('No');
    expect((rec.respuestas as any).nombres).toBeUndefined();
    expect((rec as any).origenSubmissionId).toBe('s1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (desde `backend/`): `npx jest src/consents/migrate-vaccination.spec.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Write minimal implementation**

Implementar `mapSubmissionToConsent(sub, entidad)` (identidad por ids `nombres/apellidos/tipo_doc/num_doc/ciudad/profesional`; firmas `firma_paciente`/`firma_responsable` → `firmaPaciente`/`firmaResponsable`; resto → `respuestas`; `hashVerificacion` con el mismo `consentHash`/shape del backend; `origenSubmissionId = sub._id`; `createdById`/`createdAt` desde la submission) y `runMigration({dryRun})` (conecta con Mongoose usando la config del proyecto, lee por formIds de Vacunación, upsert idempotente por `origenSubmissionId`, imprime resumen y en dryRun no escribe). Añadir `origenSubmissionId?: string` (indexado) al schema `consent-record.schema.ts`.

- [ ] **Step 4: Run test + dry-run**

Run: `npx jest src/consents/migrate-vaccination.spec.ts` → PASS.
Run: `npx ts-node src/consents/migrate-vaccination.ts --dry-run` (contra una BD de pruebas) → imprime conteos sin escribir. Registrar la salida en el reporte. NO correr la migración real sin confirmación del usuario (operación con efecto sobre datos).

- [ ] **Step 5: Commit**

```bash
git add backend/src/consents/migrate-vaccination.ts backend/src/consents/migrate-vaccination.spec.ts backend/src/consents/consent-record.schema.ts
git commit -m "feat(consents): script de migración Vacunación → consent_records (idempotente, dry-run)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:** Motor config-driven (spec §5) → Tasks 2,3,4,5,6. API front → Task 1. Vacunación preservada + sobre el motor (spec §2, decisión "conservar") → Task 7. Migración (spec §8) → Task 8. ✔
**2. Placeholder scan:** cada task trae test real + implementación descrita con firmas concretas; los pasos que dependen de mapeos del `EntityConfig`/seeder nombran los ids exactos a usar. ✔
**3. Type consistency:** `ConsentDefinition`/`ConsentState`/`CreateConsentPayload` se usan idénticos en Tasks 1,2,4,6,7; `buildCreatePayload` produce el shape que consume `createConsentApi`. ✔

## Nota de ejecución
- Confirmar el runner de tests del front (Vitest vs Jest) y `@testing-library/react` en `package.json` antes de Task 1; ajustar los comandos `npx vitest run` si el repo usa otro.
- Task 8 (migración real) es la única con efecto sobre datos: solo dry-run en el plan; la corrida real la aprueba el usuario.
