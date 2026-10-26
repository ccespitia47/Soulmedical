# Historial de paciente y esquemas de vacunación — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el número de documento traiga los datos generales del paciente y, en vacunación, su historial de vacunas con la dosis y la fecha de la próxima aplicación calculadas.

**Architecture:** Un endpoint nuevo de backend resuelve la consulta por documento (coincidencia exacta, filtrada por entidad, sin anulados) y devuelve el último consentimiento más el historial de Sección C ya aplanado. En el frontend, un módulo puro contiene el catálogo clínico y el cálculo de fechas, un hook enlaza la consulta al estado del formulario, y dos componentes la muestran: el aviso de autorrelleno y el panel de historial.

**Tech Stack:** NestJS + Mongoose (backend), React 19 + TypeScript + Tailwind (frontend), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-consentimientos-historial-paciente-design.md`

## Global Constraints

- La columna "Próxima aplicación" se cuenta **desde la dosis 1**, no desde la dosis aplicada. El intervalo de la fila N es el desplazamiento desde la dosis 1 al que ocurre la dosis N+1.
- **La última fila de cada vacuna no agenda nada**: `proxima` queda `""`. Igual para las de dosis única y las que solo tienen una fila.
- La consulta exige **coincidencia exacta** de `numDoc` y **igualdad de `entidad`** (`null` incluido). Nunca regex parcial.
- Se excluyen los consentimientos con `estado === "anulado"`.
- `fecha` y `profesional` **nunca** se autorrellenan. Tampoco respuestas del cuestionario, firmas ni foto.
- Solo se rellenan campos **vacíos**.
- La ciudad se guarda y se imprime como `"Municipio, Departamento"`.
- Nada se escribe en `respuestas` para trazabilidad: entra en `hashVerificacion`.
- Existe un prototipo desechable en `src/components/consents/spike/` que la Task 1 elimina.

## Review Focus

- `numDoc` con espacios alrededor o ceros a la izquierda: debe normalizarse antes de comparar, o el paciente no aparece (Task 3).
- Paciente con dosis 2 registrada pero **sin** registro de la dosis 1: no hay fecha base, `proxima` debe quedar vacío en vez de calcularse sobre hoy (Task 1).
- `respuestas.seccionC` con JSON inválido o texto libre heredado: el panel debe ignorar ese registro, no romperse (Task 3).
- Autorrelleno sobre un campo que el profesional ya tecleó: no se pisa (Task 4).
- Vacuna presente a la vez como esquema y como dosis única (Neumococo 13, Pentavalente, Hexavalente, Meningococo): buscar la dosis 1 no debe confundir ambas entradas (Task 1).

---

### Task 1: Retirar el prototipo y crear el catálogo de vacunas

**Files:**
- Delete: `src/components/consents/spike/` (carpeta completa)
- Revert: `src/components/consents/fields/VaccineTable.tsx`, `src/components/consents/engine/ConsentRenderer.tsx` (a su estado en HEAD)
- Create: `src/components/consents/vaccines/vaccineSchedule.ts`
- Test: `src/components/consents/vaccines/vaccineSchedule.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type Unidad = "dias" | "meses" | "anios"`
  - `type Intervalo = { cantidad: number; unidad: Unidad }`
  - `type EsquemaEntry = { label: string; vacuna: string; dosis: string; intervalo: Intervalo | null; esUltima: boolean }`
  - `const CATALOGO: EsquemaEntry[]`
  - `const OTRA_LABEL = "Otra (escribir a mano)"`
  - `findEntry(label: string): EsquemaEntry | undefined`
  - `addIntervalo(baseIso: string, intervalo: Intervalo): string`
  - `calcularProxima(entry: EsquemaEntry, fechaDosis1: string): string`
  - `siguienteDosisLabel(vacuna: string, dosisRegistradas: string[]): string | null`

El catálogo se transcribe de la tabla del spec (§2). `esUltima` se deriva al construirlo: es `true` para la fila con la dosis mayor de cada `vacuna` del esquema, y para toda entrada de dosis única.

- [ ] **Step 1: Write the failing tests**

```ts
describe("calcularProxima", () => {
  it("cuenta desde la dosis 1: Antirrábica POS da 0-3-7", () => {
    expect(calcularProxima(findEntry("ANTIRRABICA POS D1")!, "2026-01-01")).toBe("2026-01-04");
    expect(calcularProxima(findEntry("ANTIRRABICA POS D2")!, "2026-01-01")).toBe("2026-01-08");
  });

  it("la última fila de la vacuna no agenda nada", () => {
    expect(calcularProxima(findEntry("ANTIRRABICA POS D3")!, "2026-01-01")).toBe("");
    expect(calcularProxima(findEntry("HEPATITIS B D2")!, "2026-01-01")).toBe("");
  });

  it("las vacunas de una sola fila no agendan nada", () => {
    for (const label of ["DENGUE D1", "DPT-a D1", "HEPATITIS A D1", "HERPES ZOSTER D1",
                         "MENINGOCOCO B D1", "MENINGOCOCO AYW 135 D1", "NEUMOCOCO 23 D1",
                         "VARICELA D1", "ANTIRRABICA PRE D1"]) {
      expect(calcularProxima(findEntry(label)!, "2026-01-01")).toBe("");
    }
  });

  it("las de dosis única no agendan nada", () => {
    expect(calcularProxima(findEntry("INFLUENZA · dosis única")!, "2026-01-01")).toBe("");
  });

  it("sin fecha de dosis 1 no inventa una fecha", () => {
    expect(calcularProxima(findEntry("HEPATITIS B D1")!, "")).toBe("");
  });
});

describe("siguienteDosisLabel", () => {
  it("sugiere la dosis siguiente a la mayor registrada", () => {
    expect(siguienteDosisLabel("HEPATITIS B", ["1"])).toBe("HEPATITIS B D2");
  });
  it("sin registros sugiere la dosis 1", () => {
    expect(siguienteDosisLabel("TETANO", [])).toBe("TETANO D1");
  });
  it("devuelve null cuando ya se puso la última dosis del esquema", () => {
    expect(siguienteDosisLabel("HEPATITIS B", ["1", "2"])).toBeNull();
  });
  it("ignora la entrada de dosis única al contar dosis del esquema", () => {
    expect(siguienteDosisLabel("NEUMOCOCO 13", ["única"])).toBe("NEUMOCOCO 13 D1");
  });
});

describe("CATALOGO", () => {
  it("tiene 34 entradas de esquema y 8 de dosis única", () => {
    expect(CATALOGO.filter((e) => e.dosis !== "única")).toHaveLength(34);
    expect(CATALOGO.filter((e) => e.dosis === "única")).toHaveLength(8);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/consents/vaccines/vaccineSchedule.spec.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Borrar el prototipo y revertir lo que tocó**

```bash
rm -rf src/components/consents/spike
git checkout -- src/components/consents/fields/VaccineTable.tsx src/components/consents/engine/ConsentRenderer.tsx
```

- [ ] **Step 4: Implementar `vaccineSchedule.ts`**

Transcribir la tabla del spec §2 tal cual, incluido `ROTAVIRUS D2 → 1 mes`. `calcularProxima` devuelve `""` si `entry.esUltima`, si `entry.intervalo` es `null` o si `fechaDosis1` está vacía; en otro caso `addIntervalo(fechaDosis1, entry.intervalo)`. `addIntervalo` opera sobre ISO `yyyy-mm-dd` a mediodía para no cruzar día por zona horaria.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/consents/vaccines/vaccineSchedule.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A src/components/consents
git commit -m "feat(consents): catálogo de vacunas y cálculo de próxima dosis desde la dosis 1"
```

---

### Task 2: Ciudades de Colombia como desplegable

**Files:**
- Create: `src/components/consents/cities/colombiaCities.ts`
- Modify: `src/components/consents/engine/ConsentRenderer.tsx`
- Test: `src/components/consents/cities/colombiaCities.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `const CIUDADES_COLOMBIA: string[]` — cada entrada `"Municipio, Departamento"`, ordenada alfabéticamente, sin duplicados.

- [ ] **Step 1: Write the failing test**

```ts
it("toda entrada tiene municipio y departamento", () => {
  for (const c of CIUDADES_COLOMBIA) expect(c).toMatch(/^[^,]+, [^,]+$/);
});
it("incluye las 32 capitales de departamento y Bogotá", () => {
  expect(CIUDADES_COLOMBIA).toContain("Medellín, Antioquia");
  expect(CIUDADES_COLOMBIA).toContain("Bogotá D.C., Bogotá D.C.");
  expect(CIUDADES_COLOMBIA.length).toBeGreaterThanOrEqual(33);
});
it("no tiene duplicados y está ordenada", () => {
  expect(new Set(CIUDADES_COLOMBIA).size).toBe(CIUDADES_COLOMBIA.length);
  expect([...CIUDADES_COLOMBIA].sort((a, b) => a.localeCompare(b, "es"))).toEqual(CIUDADES_COLOMBIA);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/consents/cities/colombiaCities.spec.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar `colombiaCities.ts`**

Las 32 capitales más los municipios de mayor población. Encabezar el fichero con un comentario: la lista no es la del DANE completa (~1.100) y está pensada para sustituirse por el CSV oficial cuando el usuario lo aporte; mientras tanto el valor ya guardado se conserva aunque no esté en la lista.

- [ ] **Step 4: Convertir el campo `ciudad` a `select` en `ConsentRenderer.tsx`**

En el caso `"fields"`, mapear los campos antes de pasarlos a `FieldGrid`: si `f.id === "ciudad"`, devolver `{ ...f, type: "select", options }` donde `options` son `CIUDADES_COLOMBIA` más el valor actual de `state.values.ciudad` si no está en la lista. `FieldGrid`/`FieldControl` ya renderizan `select`; no hay que tocarlos.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/consents && npx tsc -b --pretty false`
Expected: PASS, sin salida de tsc.

- [ ] **Step 6: Commit**

```bash
git add src/components/consents
git commit -m "feat(consents): ciudad como desplegable municipio/departamento"
```

---

### Task 3: Endpoint de consulta por documento

**Files:**
- Create: `backend/src/consents/dto/paciente-lookup.dto.ts`
- Modify: `backend/src/consents/consents.service.ts`, `backend/src/consents/consents.controller.ts`
- Test: `backend/src/consents/consents.service.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type VacunaPreviaDto = { vacuna: string; dosis: string; aplicada: string; proxima: string }`
  - `type PacienteLookupDto = { ultimo: ConsentRecord | null; vacunas: VacunaPreviaDto[] }`
  - `ConsentsService.lookupPaciente(numDoc: string, entidad: string | null): Promise<PacienteLookupDto>`
  - Ruta: `GET /consents/paciente?numDoc=<doc>&entidad=<SOUL|SAI>` (omitir `entidad` significa `null`)

`lookupPaciente` filtra `{ numDoc: <exacto y recortado>, entidad, estado: { $ne: 'anulado' } }`, ordena por `createdAt` descendente, toma `ultimo` del primero, y construye `vacunas` recorriendo `respuestas.seccionC` de todos los registros. Una `seccionC` que no parsee como array se ignora.

- [ ] **Step 1: Write the failing tests**

```ts
describe("lookupPaciente", () => {
  it("exige coincidencia exacta de numDoc", async () => { /* '100' no debe traer al paciente '1009' */ });
  it("recorta espacios del numDoc antes de comparar", async () => { /* ' 1009 ' encuentra a '1009' */ });
  it("no cruza entidades", async () => { /* un registro SAI no sale al consultar con entidad SOUL */ });
  it("excluye los anulados", async () => { /* ... */ });
  it("aplana las filas de seccionC de todos los registros", async () => { /* ... */ });
  it("ignora un seccionC que no sea JSON de array", async () => {
    // texto libre heredado: devuelve vacunas: [] sin lanzar
  });
  it("devuelve ultimo: null cuando no hay registros", async () => { /* ... */ });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx jest src/consents/consents.service.spec.ts`
Expected: FAIL — `lookupPaciente` no existe.

- [ ] **Step 3: Implementar `lookupPaciente` en `consents.service.ts` y la ruta en `consents.controller.ts`**

La ruta va **antes** de `@Get(':id')` para que `paciente` no se interprete como un id. El controlador registra la consulta en la auditoría que ya existe (`AdminAuditService`), con el usuario de `req.user.id`, el `numDoc` consultado y la marca de tiempo.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && npx jest src/consents && npm run build`
Expected: PASS y build limpio.

- [ ] **Step 5: Commit**

```bash
git add backend/src/consents
git commit -m "feat(consents): endpoint de consulta de paciente por documento"
```

---

### Task 4: Autorrelleno de datos generales

**Files:**
- Modify: `src/services/api.ts`
- Create: `src/components/consents/patient/usePatientLookup.ts`
- Modify: `src/components/consents/engine/ConsentRenderer.tsx`
- Test: `src/components/consents/patient/usePatientLookup.spec.ts`

**Interfaces:**
- Consumes: `PacienteLookupDto` (Task 3).
- Produces:
  - `lookupPacienteApi(numDoc: string, entidad?: "SOUL" | "SAI")` en `api.ts`
  - `type VacunaPrevia = { vacuna: string; dosis: string; aplicada: string; proxima: string; vencida: boolean }`
  - `usePatientLookup(def: ConsentDefinition, state: ConsentState, onChange: (p: Partial<ConsentState>) => void): { aviso: { fecha: string; nombre: string } | null; historial: VacunaPrevia[]; deshacer: () => void }`

Dispara con rebote de 600 ms y `numDoc` de 5 caracteres o más. Rellena solo los ids de las secciones `fields` que estén vacíos, excluyendo `numDoc`, `fecha` y `profesional`. `vencida` es `proxima !== "" && proxima <= hoy`.

- [ ] **Step 1: Write the failing tests**

```ts
it("rellena solo los campos vacíos", async () => {
  // state.values.nombres = "Ya escrito" → no se pisa; ciudad vacía → se rellena
});
it("nunca rellena fecha ni profesional", async () => { /* ... */ });
it("no consulta con menos de 5 caracteres", async () => { /* el api no se llama */ });
it("deshacer devuelve los valores previos", async () => { /* ... */ });
it("sin paciente no emite aviso", async () => { /* ... */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/consents/patient/usePatientLookup.spec.ts`
Expected: FAIL — el hook no existe.

- [ ] **Step 3: Implementar `lookupPacienteApi`, el hook y el aviso**

El aviso se renderiza en `ConsentRenderer` antes del `map` de secciones: un bloque con el nombre y la fecha del consentimiento de origen y un botón "Deshacer". Sigue el sistema de diseño del proyecto (Tailwind, `cardCls`/`labelCls` de `sharedUi`), sin bordes de acento laterales.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/consents && npx tsc -b --pretty false && npx eslint src`
Expected: PASS, tsc y eslint limpios.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(consents): autorrelleno de datos generales por documento"
```

---

### Task 5: Panel de historial de vacunas

**Files:**
- Create: `src/components/consents/patient/PatientHistoryPanel.tsx`
- Modify: `src/components/consents/engine/ConsentRenderer.tsx`
- Test: `src/components/consents/patient/PatientHistoryPanel.spec.tsx`

**Interfaces:**
- Consumes: `VacunaPrevia` (Task 4).
- Produces: `PatientHistoryPanel({ historial }: { historial: VacunaPrevia[] })` — plegable, abierto por defecto, `null` si el historial está vacío.

Se renderiza inmediatamente antes de la sección `vaccineTable`, así que solo aparece en los tipos que la tienen.

- [ ] **Step 1: Write the failing test**

```ts
it("no renderiza nada sin historial", () => { /* container vacío */ });
it("marca como vencida la fila cuya próxima ya pasó", () => { /* texto "toca" presente */ });
it("muestra guion cuando no hay próxima fecha", () => { /* ... */ });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/consents/patient/PatientHistoryPanel.spec.tsx`
Expected: FAIL — el componente no existe.

- [ ] **Step 3: Implementar el panel y montarlo en `ConsentRenderer`**

Tabla de cuatro columnas: Vacuna, Dosis, Aplicada, Próxima. La vencida en ámbar con el sufijo "· toca".

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/consents && npx tsc -b --pretty false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/consents
git commit -m "feat(consents): panel de historial de vacunas del paciente"
```

---

### Task 6: Sección C con catálogo, dosis sugerida y fecha calculada

**Files:**
- Modify: `src/components/consents/fields/VaccineTable.tsx`, `src/components/consents/engine/ConsentRenderer.tsx`
- Test: `src/components/consents/fields/VaccineTable.spec.tsx`

**Interfaces:**
- Consumes: `CATALOGO`, `OTRA_LABEL`, `findEntry`, `calcularProxima`, `siguienteDosisLabel` (Task 1); `VacunaPrevia` (Task 4).
- Produces: `VaccineTable` acepta dos props nuevas: `historial?: VacunaPrevia[]` y `fechaConsentimiento?: string`.

La columna `nombre` pasa a `<select>` con `CATALOGO` más `OTRA_LABEL`; elegir `OTRA_LABEL` devuelve esa fila a texto libre. Al elegir una entrada se fijan `nombre`, `dosis` y `proxima` a la vez. La fecha base es `fechaConsentimiento` si la entrada es dosis 1, o la `aplicada` de la dosis 1 de esa vacuna en `historial` si no. **No se preselecciona vacuna**; `siguienteDosisLabel` solo se usa para fijar la dosis una vez elegida la vacuna.

- [ ] **Step 1: Write the failing tests**

```ts
it("al elegir una vacuna fija dosis y fecha próxima", () => { /* ... */ });
it("usa la fecha de la dosis 1 del historial para una dosis posterior", () => { /* ... */ });
it("deja la próxima vacía si la dosis 1 no está en el historial", () => { /* ... */ });
it("no preselecciona ninguna vacuna", () => { /* el select arranca en "" */ });
it("'Otra' devuelve la fila a texto libre", () => { /* ... */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/consents/fields/VaccineTable.spec.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar el desplegable y el cálculo**

`VaccineTable` sigue siendo no controlado: las props nuevas solo alimentan el cálculo, no el estado de las filas. `ConsentRenderer` le pasa `historial` y `state.values.fecha`.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run && npx tsc -b --pretty false && npx eslint src` y `cd backend && npx jest src/consents`
Expected: todo PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/consents
git commit -m "feat(consents): Sección C con catálogo de vacunas y fecha próxima calculada"
```
