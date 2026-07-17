# Consentimiento de Vacunación multi-entidad (SAI / SOUL) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el consentimiento de vacunación simplificado por un formulario fiel a los PDFs de SOUL (SV-FT-B01 v01) y SAI (SV-FT-01 v02), con un dropdown que elige la entidad y persiste cada envío en su propio formulario sembrado.

**Architecture:** Diseño data-driven. Un `EntityConfig` por entidad (SOUL, SAI) describe secciones, campos, preguntas tri-estado, tabla de vacunas y textos legales. Un único conjunto de componentes de sección los renderiza. El backend siembra dos formularios (`consent-vaccination-soul`, `consent-vaccination-sai`) cuyos IDs de widget son espejo exacto de los configs.

**Tech Stack:** React + TypeScript (estricto), Vite, Tailwind, Zustand (stores existentes), NestJS + Mongoose (backend seeder).

## Global Constraints

- **Sin framework de tests en el repo.** El ciclo de verificación de cada tarea es: `npm run build` (ejecuta `tsc -b`, typecheck estricto) y `npm run lint` (ESLint), ambos sin errores nuevos; las tareas de UI añaden verificación visual con la skill `run`. No introducir Vitest/Jest.
- **Reglas de repo:** Atomic Design, componentes pequeños, evitar archivos gigantes, Tailwind mobile-first, dark mode. TypeScript estricto (sin `any`).
- **IDs de widget = fuente de verdad compartida.** Cualquier ID de campo/pregunta en un config del frontend DEBE existir con el mismo `id` en el array de widgets del seeder (backend), o la firma no baja a GridFS y el export a Power BI pierde el label.
- **Textos legales verbatim.** Los textos de consentimiento y Habeas Data se transcriben literalmente de los PDFs (SOUL Secciones D+E; SAI efectos adversos + consentimiento + Habeas Data F). No resumir.
- **Correo de clínica:** sin cambios (`CLINIC_EMAIL` actual sirve para ambas entidades).
- **Commits frecuentes**, uno por tarea, con `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` al final del mensaje.

---

## File Structure

```
src/assets/consents/
  soul-logo.png                # provisto por el usuario
  sai-logo.png                 # provisto por el usuario
src/components/consents/
  config/
    entityConfig.ts            # tipos compartidos + IDs especiales
    soulConfig.ts              # config SOUL (textos verbatim)
    saiConfig.ts               # config SAI  (textos verbatim)
    index.ts                   # ENTITIES, EntityKey, getEntityConfig
  fields/
    CheckboxGroupField.tsx     # condiciones Sección A (multi-select)
    TriStateQuestion.tsx       # SI / No / tercera opción + "indique"
    VaccineTable.tsx           # Sección C, filas repetibles (resetKey)
  sections/
    GeneralDataSection.tsx
    SectionA.tsx
    SectionB.tsx
    LiveVaccinesSection.tsx
    SectionC.tsx
    LegalSection.tsx
  flattenConsent.ts            # estado compuesto -> Record<string,string>
  VaccinationConsentForm.tsx   # orquestador (dropdown + secciones)
  useVaccinationConsent.ts     # MODIFICAR: recibe formId
  vaccinationConsentPdf.ts     # MODIFICAR: PDF data-driven por config
  consentConfig.ts             # CONSERVAR IDs especiales; deprecar campos viejos
backend/src/consents/
  consents.seeder.ts           # MODIFICAR: siembra 2 formularios
```

---

### Task 1: Tipos compartidos y scaffolding de config

**Files:**
- Create: `src/components/consents/config/entityConfig.ts`
- Create: `src/components/consents/config/index.ts`

**Interfaces:**
- Produces: los tipos `ConsentField`, `TriStateQ`, `ConditionsGroup`, `VaccineTableColumn`, `EntityConfig`, `EntityKey`; la constante `ENTITIES: Record<EntityKey, EntityConfig>` y `getEntityConfig(key)`. Todas las tareas siguientes consumen estos tipos.
- Consumes: nada (primera tarea). `soulConfig`/`saiConfig` se importan en `index.ts` pero se crean en Tasks 2-3; hasta entonces `index.ts` no compila, así que esta tarea deja `ENTITIES` comentado con un TODO explícito resuelto en Task 3.

- [ ] **Step 1: Crear `entityConfig.ts` con los tipos**

```ts
// Tipos compartidos del Consentimiento de Vacunación multi-entidad.
// Fuente de verdad de los IDs de campo/pregunta: cada `id` debe existir como
// widget con el mismo id en backend/src/consents/consents.seeder.ts.

export type ConsentFieldType = "text" | "email" | "tel" | "date" | "select" | "number";

export type ConsentField = {
  id: string;
  label: string;
  type: ConsentFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  /** Ocupa media columna en la grilla (por defecto, columna completa). */
  half?: boolean;
};

export type ThirdLabel = "No aplica" | "No está seguro";

/** Pregunta con respuesta Sí / No / (tercera opción) y "indique" opcional. */
export type TriStateQ = {
  id: string;
  /** Número visible en el PDF (ej. "1", "7"). */
  num: string;
  text: string;
  thirdLabel: ThirdLabel;
  /** Campo de texto libre asociado ("De ser así, indique:"). */
  note?: { id: string; label: string };
  required?: boolean;
};

/** Grupo de casillas (Sección A: condiciones). Se guarda como "A; B; C". */
export type ConditionsGroup = {
  id: string;
  label: string;
  options: string[];
};

export type VaccineTableColumn = { id: string; label: string };

export type EntityConfig = {
  meta: {
    key: EntityKey;
    formId: string;
    /** Nombre legal completo para textos ("SOULMEDICAL LTDA"). */
    entidadNombre: string;
    /** Etiqueta corta para dropdown y encabezado ("SOUL"). */
    displayName: string;
    codigo: string;
    version: string;
    /** URL importada del logo (Vite resuelve el import a string). */
    logo: string;
  };
  datosGenerales: ConsentField[];
  seccionA: {
    /** Solo SOUL: años desde última vacuna de tétanos. */
    tetanosAnios?: ConsentField;
    condiciones: ConditionsGroup;
    antineumococica: TriStateQ;
    antineumococicaFecha: ConsentField;
    herpesZoster: TriStateQ;
  };
  /** Preguntas 1-6 (todas las vacunas). */
  seccionB: TriStateQ[];
  /** Preguntas 7-13 (vacunas de virus vivos). */
  virusVivos: TriStateQ[];
  seccionC: { columns: VaccineTableColumn[] };
  /** Solo SAI: bloque informativo de efectos adversos (párrafos). */
  efectosAdversos?: string[];
  /** Texto de consentimiento (verbatim del PDF). Párrafos separados por \n\n. */
  legalText: string;
  /** Texto de Habeas Data (verbatim del PDF). */
  habeasData: string;
  firmas: {
    firmaPaciente: { id: string; label: string };
    firmaResponsable: { id: string; label: string };
  };
};

export type EntityKey = "soul" | "sai";

// IDs especiales usados por el flujo de envío (espejo del seeder).
export const ACCEPT_FIELD_ID = "aceptaConsentimiento";
export const SIGNATURE_FIELD_ID = "firma";
export const SIGNATURE_RESP_FIELD_ID = "firmaResponsable";
export const PATIENT_EMAIL_FIELD_ID = "pacienteEmail";
export const PATIENT_NAME_FIELD_ID = "pacienteNombre";
export const PATIENT_DOC_FIELD_ID = "pacienteNumDoc";

// Carpeta lógica del sistema (compartida por ambas entidades).
export const CONSENT_FOLDER_ID = "consent-system-folder";
// Correo de clínica (copia siempre). Editable.
export const CLINIC_EMAIL = "consentimientos@gruposoul.com";
```

- [ ] **Step 2: Crear `index.ts` con el registro (placeholder hasta Task 3)**

```ts
import type { EntityConfig, EntityKey } from "./entityConfig";
import { soulConfig } from "./soulConfig";
import { saiConfig } from "./saiConfig";

export * from "./entityConfig";

export const ENTITIES: Record<EntityKey, EntityConfig> = {
  soul: soulConfig,
  sai: saiConfig,
};

/** Orden de aparición en el dropdown. */
export const ENTITY_ORDER: EntityKey[] = ["soul", "sai"];

export function getEntityConfig(key: EntityKey): EntityConfig {
  return ENTITIES[key];
}
```

- [ ] **Step 3: Verificar typecheck (fallará por imports faltantes — esperado)**

Run: `npm run build`
Expected: FALLA con "Cannot find module './soulConfig'" y './saiConfig'. Es esperado; se resuelve en Tasks 2-3. No commitear todavía si se ejecuta aislado; esta tarea se cierra junto a Task 3. **No commit aquí** — continuar a Task 2.

---

### Task 2: Config SOUL (`soulConfig.ts`)

**Files:**
- Create: `src/components/consents/config/soulConfig.ts`

**Interfaces:**
- Consumes: tipos de `entityConfig.ts` (Task 1).
- Produces: `export const soulConfig: EntityConfig`.

**Referencia de contenido (PDF SOUL, SV-FT-B01):** Datos generales = Fecha, Ciudad, Nombre y Apellidos, Documento, Fecha de nacimiento, RH, Entidad, EPS, Dirección del domicilio, Teléfono, Email. Sección A: item 1 = años tétanos; item 2 = condiciones + antineumocócica + "¿cuándo?"; item 3 = herpes zoster. Tercera columna "No está seguro" en toda la Sección A. Preguntas B 1-6 y virus vivos 7-13 con tercera columna "No está seguro".

- [ ] **Step 1: Crear `soulConfig.ts`**

```ts
import type { EntityConfig } from "./entityConfig";
import logo from "../../../assets/consents/soul-logo.png";

export const soulConfig: EntityConfig = {
  meta: {
    key: "soul",
    formId: "consent-vaccination-soul",
    entidadNombre: "SOULMEDICAL LTDA",
    displayName: "SOUL",
    codigo: "SV-FT-B01",
    version: "01",
    logo,
  },
  datosGenerales: [
    { id: "fecha", label: "Fecha", type: "date", required: true, half: true },
    { id: "ciudad", label: "Ciudad", type: "text", half: true },
    { id: "pacienteNombre", label: "Nombre y Apellidos", type: "text", required: true, placeholder: "Nombres y apellidos" },
    { id: "pacienteTipoDoc", label: "Tipo de documento", type: "select", required: true, half: true, options: ["CC", "TI", "CE", "Pasaporte", "RC"] },
    { id: "pacienteNumDoc", label: "Documento", type: "text", required: true, half: true, placeholder: "Ej: 1020304050" },
    { id: "pacienteFechaNac", label: "Fecha de nacimiento", type: "date", half: true },
    { id: "rh", label: "RH", type: "text", half: true, placeholder: "Ej: O+" },
    { id: "entidad", label: "Entidad", type: "text", half: true },
    { id: "eps", label: "EPS", type: "text", half: true },
    { id: "direccion", label: "Dirección del domicilio", type: "text" },
    { id: "pacienteTelefono", label: "Teléfono", type: "tel", half: true, placeholder: "Ej: 3001234567" },
    { id: "pacienteEmail", label: "Email", type: "email", required: true, half: true, placeholder: "paciente@correo.com" },
  ],
  seccionA: {
    tetanosAnios: { id: "tetanosAnios", label: "¿Cuánto tiempo (años) desde su última inyección contra el TÉTANOS?", type: "number", placeholder: "Años" },
    condiciones: {
      id: "condiciones",
      label: "Marque todo lo que aplique a usted:",
      options: ["Asma/Epoc", "Diabetes", "Enfermedad cardiaca", "Fumador de tabaco", "Inmunosupresión", "65 años o mayor"],
    },
    antineumococica: {
      id: "antineumococica",
      num: "2",
      text: "Si marcó alguna de las anteriores, ¿alguna vez ha recibido la vacuna ANTINEUMOCÓCICA?",
      thirdLabel: "No está seguro",
    },
    antineumococicaFecha: { id: "antineumococicaFecha", label: "Si la respuesta es afirmativa, ¿cuándo?", type: "text", placeholder: "Ej: 2021" },
    herpesZoster: {
      id: "herpesZoster",
      num: "3",
      text: "Pacientes de 60 años o mayores: ¿Alguna vez ha recibido la vacuna contra el HERPES ZOSTER?",
      thirdLabel: "No está seguro",
    },
  },
  seccionB: [
    { id: "b1", num: "1", text: "¿Se siente enfermo hoy?", thirdLabel: "No está seguro" },
    { id: "b2", num: "2", text: "¿Tiene una alergia seria a ALGÚN medicamento o alimento (p. ej., huevos, gelatina, timerosal, neomicina, gentamicina, etc.)?", thirdLabel: "No está seguro", note: { id: "b2Indique", label: "De ser así, indique:" } },
    { id: "b3", num: "3", text: "¿Alguna vez ha tenido una reacción seria o se ha desmayado después de recibir alguna vacuna?", thirdLabel: "No está seguro" },
    { id: "b4", num: "4", text: "¿Tiene sensibilidad al látex (p. ej., guantes o vendajes)?", thirdLabel: "No está seguro" },
    { id: "b5", num: "5", text: "¿Tiene un trastorno de convulsiones o trastorno cerebral? (Solo Tdap)", thirdLabel: "No está seguro" },
    { id: "b6", num: "6", text: "Para mujeres: ¿Está embarazada o está considerando quedar embarazada en el próximo mes?", thirdLabel: "No está seguro" },
  ],
  virusVivos: [
    { id: "v7", num: "7", text: "¿Ha recibido alguna vacuna en las últimas cuatro semanas?", thirdLabel: "No está seguro", note: { id: "v7Indique", label: "De ser así, indique:" } },
    { id: "v8", num: "8", text: "¿Tiene cáncer, leucemia, VIH, herpes activo o cualquier otro problema del sistema inmunológico?", thirdLabel: "No está seguro" },
    { id: "v9", num: "9", text: "¿Toma prednisona, esteroides orales, medicamentos contra el cáncer o antivirales o medicamentos que afecten el sistema inmunológico?", thirdLabel: "No está seguro" },
    { id: "v10", num: "10", text: "Durante el último año, ¿ha recibido una transfusión de sangre o productos sanguíneos, se le ha administrado inmunoglobulina (gamma) o ha tenido radioterapia?", thirdLabel: "No está seguro" },
    { id: "v11", num: "11", text: "¿Se le ha extirpado la glándula timo o tiene un historial de problemas con su timo, como miastenia gravis, síndrome DiGeorge o timoma? (Solo fiebre amarilla)", thirdLabel: "No está seguro" },
    { id: "v12", num: "12", text: "¿Actualmente está tomando algún antibiótico o medicamentos antimaláricos? (Solo tifoidea oral)", thirdLabel: "No está seguro" },
    { id: "v13", num: "13", text: "¿Tiene un historial de trombocitopenia o trombocitopenia púrpura? (Solo MMR® II)", thirdLabel: "No está seguro" },
  ],
  seccionC: {
    columns: [
      { id: "nombre", label: "Nombre vacuna" },
      { id: "dosis", label: "N° Dosis" },
      { id: "lote", label: "Lote" },
      { id: "vencimiento", label: "Fecha vencimiento" },
      { id: "proxima", label: "Fecha próxima vacuna" },
      { id: "fabricante", label: "Fabricante" },
    ],
  },
  legalText: `Por la presente hago constar que soy: (a) el paciente, mayor de 18 años; (b) la madre / el padre / tutor legal del paciente menor de edad; o (c) el tutor legal del paciente. Asimismo, por este medio doy mi consentimiento a SOULMEDICAL LTDA, según corresponda, para que administren la(s) vacuna(s) solicitadas. Tengo entendido que no es posible predecir todos los posibles efectos secundarios o complicaciones a consecuencia de la administración de la(s) vacuna(s). Entiendo los riesgos y beneficios asociados a la(s) vacuna(s) descrita(s) arriba; he recibido, leído y/o se me ha explicado las vacunas que he decidido recibir. También reconozco que se me ha dado la oportunidad de hacer preguntas, las cuales fueron contestadas a mi entera satisfacción. Además, admito que se me ha aconsejado permanecer cerca del lugar asignado a la vacunación por aproximadamente 15 minutos después de recibir la(s) vacuna(s) para estar bajo la observación del proveedor de servicios de salud que administra la(s) vacuna(s). El suscrito, en mi nombre, y en nombre de mis herederos y representantes personales, por la presente certifico eximir de cualquier responsabilidad y dejar en paz y a salvo a "SOULMEDICAL LTDA", a su personal, agentes, sucesores, divisiones, afiliados, subsidiarias, dirigentes, directores, contratistas y empleados, de toda responsabilidad o queja, ya sea conocida o desconocida, derivada en virtud de y respecto a la administración de la(s) vacuna(s) administradas. Hago constar que: (a) entiendo los objetivos y beneficios del registro de vacunación ("Registro distrital") y el intercambio de información de salud de mi estado; y (b) el "Proveedor de Aplicación" puede divulgar la información de mi vacunación a –o a través del Registro distrital para propósitos de información de salud pública o a mis proveedores de servicios de salud inscritos en el Registro distrital para fines de coordinación de los cuidados de salud. Entiendo que, dependiendo de la ley de mi estado, puedo prevenir que "SOULMEDICAL", (a) divulguen la información de mi vacunación al Registro distrital; o (b) el Registro distrital compartan la información de mi vacunación con cualquiera de mis otros proveedores de salud inscritos en el Registro distrital. Estoy consciente de que, conforme a la ley, es requerido que otorgue mi consentimiento específico, salvo que la ley disponga lo contrario, con mi firma a continuación; por lo que doy mi autorización al "Proveedor de Aplicación SOULMEDICAL LTDA" para que divulgue la información de mi vacunación, a las entidades correspondientes y para los fines descritos en este Consentimiento informado de vacunación. A menos que yo proporcione al "Proveedor de Aplicación" la planilla de exclusión aprobada, tengo entendido que mi consentimiento permanecerá en vigor hasta que retire dicho permiso y puedo retirar mi consentimiento al proporcionar a "SOULMEDICAL", según corresponda, la planilla de exclusión voluntaria. Entiendo que, aunque no otorgue mi consentimiento o, aunque retire dicho consentimiento, las leyes de mi estado podrán permitir ciertas revelaciones de la información de mi vacunación a través del Registro distrital, según corresponda. Asimismo, doy mi autorización a "SOULMEDICAL" para que (a) dé a conocer mi información médica u otra información pertinente, incluso información sobre mis enfermedades transmisibles (como VIH), salud mental y abuso de drogas / alcohol a los profesionales encargados de los cuidados de mi salud, SOULMEDICAL, o terceros pagadores requeridos para efectuar cuidados o pagos, (b) presentar una reclamación de gastos a mi compañía de seguros por concepto de los productos y servicios arriba solicitados, y (c) solicitar que los pagos correspondientes a beneficios autorizados en mi nombre por los productos y servicios arriba solicitados se hagan a "SOULMEDICAL". Estoy de acuerdo en asumir la responsabilidad financiera completa por cualquier copago, coaseguro y deducible incurrido por los productos y servicios solicitados, así como por otros productos y servicios cuyo costo no esté incluido en la cubierta de mi plan de salud. Tengo entendido que es mi responsabilidad hacer los pagos a los que estoy obligado al momento de recibir dichos productos y servicios; en caso de que "SOULMEDICAL" remita las facturas correspondientes con fecha posterior a la realización de los servicios, dichas facturas son pagaderas al momento de recibirlas.`,
  habeasData: `SECCIÓN E: HABEAS DATA (Ley estatutaria 1581 2012). Otorgo por este medio autorización a SOULMEDICAL para que almacenen, administren, y / o utilicen la información de mis datos personales y los transfieran entre ella según requiera en desarrollo de la IPS SOULMEDICAL, así mismo autorizo para que me contacten de manera telefónica, electrónica, física o cualquier otro medio de comunicación para darme información o brindarme apoyo de tipo educativo relacionado con temas de salud y manejo de mi enfermedad. Ley 1581 2012 ART. 3, 4, 5, 6, 7.

Conozco y entiendo que tengo el derecho de conocer, actualizar, corregir o solicitar que se certifique o elimine mi información personal de las bases de datos en que se encuentre.

Entiendo que los responsables del manejo de mi información es SOULMEDICAL LTDA y que estos no compartirán mi información con terceros salvo con aquellos que utilicen para el manejo de la base de datos.`,
  firmas: {
    firmaPaciente: { id: "firma", label: "Firma del paciente (o Madre / Padre / Tutor legal si es menor de edad)" },
    firmaResponsable: { id: "firmaResponsable", label: "Firma responsable de vacunación" },
  },
};
```

- [ ] **Step 2: Verificar typecheck (aún falla por saiConfig faltante — esperado). No commit; continuar a Task 3.**

Run: `npm run build`
Expected: FALLA solo con "Cannot find module './saiConfig'".

---

### Task 3: Config SAI (`saiConfig.ts`) y cierre del scaffolding

**Files:**
- Create: `src/components/consents/config/saiConfig.ts`

**Interfaces:**
- Consumes: tipos de `entityConfig.ts`.
- Produces: `export const saiConfig: EntityConfig`. Con esto `index.ts` (Task 1) compila.

**Referencia (PDF SAI, SV-FT-01 v02):** Datos generales incluyen `Edad` y `Entidad (que lo remite)`. Sección A tiene 2 ítems (SIN pregunta de tétanos): item 1 = condiciones + antineumocócica + "¿cuándo?"; item 2 = herpes zoster; tercera columna "No aplica". Preguntas B 1-6 tercera columna "No está seguro". Virus vivos 7-13 tercera columna "No aplica". Incluye bloque de efectos adversos y Habeas Data Sección F con dirección/teléfono.

- [ ] **Step 1: Crear `saiConfig.ts`**

```ts
import type { EntityConfig } from "./entityConfig";
import logo from "../../../assets/consents/sai-logo.png";

export const saiConfig: EntityConfig = {
  meta: {
    key: "sai",
    formId: "consent-vaccination-sai",
    entidadNombre: "SERVICIOS Y ASESORÍAS EN INFECTOLOGÍA SAI",
    displayName: "SAI",
    codigo: "SV-FT-01",
    version: "02",
    logo,
  },
  datosGenerales: [
    { id: "fecha", label: "Fecha (dd/mm/aaaa)", type: "date", required: true, half: true },
    { id: "ciudad", label: "Ciudad", type: "text", half: true },
    { id: "pacienteNombre", label: "Nombres y Apellidos", type: "text", required: true, placeholder: "Nombres y apellidos" },
    { id: "entidadRemite", label: "Entidad (que lo remite)", type: "text", half: true },
    { id: "pacienteTipoDoc", label: "Tipo de documento", type: "select", required: true, half: true, options: ["CC", "TI", "CE", "Pasaporte", "RC"] },
    { id: "pacienteNumDoc", label: "Documento (N° ID)", type: "text", required: true, half: true, placeholder: "Ej: 1020304050" },
    { id: "pacienteFechaNac", label: "Fecha de nacimiento (dd/mm/aaaa)", type: "date", half: true },
    { id: "edad", label: "Edad (años)", type: "number", half: true, placeholder: "Años" },
    { id: "rh", label: "RH (O, A, B, AB)", type: "text", half: true, placeholder: "Ej: O+" },
    { id: "eps", label: "EPS", type: "text", half: true },
    { id: "direccion", label: "Dirección del domicilio", type: "text" },
    { id: "pacienteTelefono", label: "Teléfono", type: "tel", half: true, placeholder: "Ej: 3001234567" },
    { id: "pacienteEmail", label: "Email", type: "email", required: true, half: true, placeholder: "paciente@correo.com" },
  ],
  seccionA: {
    // SAI no tiene pregunta de tétanos -> tetanosAnios ausente (opcional).
    condiciones: {
      id: "condiciones",
      label: "Seleccione uno o más de los siguientes ítems, si aplica en su caso:",
      options: ["Asma/Epoc", "Diabetes", "Enfermedad cardiaca", "Fumador de tabaco", "Inmunosupresión", "65 años o mayor"],
    },
    antineumococica: {
      id: "antineumococica",
      num: "1",
      text: "Si marcó alguna de las anteriores, ¿alguna vez ha recibido la vacuna ANTINEUMOCÓCICA?",
      thirdLabel: "No aplica",
    },
    antineumococicaFecha: { id: "antineumococicaFecha", label: "Si la respuesta es afirmativa, ¿cuándo?", type: "text", placeholder: "Ej: 2021" },
    herpesZoster: {
      id: "herpesZoster",
      num: "2",
      text: "Pacientes de 60 años o mayores: ¿Alguna vez ha recibido la vacuna contra el HERPES ZOSTER?",
      thirdLabel: "No aplica",
    },
  },
  seccionB: [
    { id: "b1", num: "1", text: "¿Se siente enfermo hoy?", thirdLabel: "No está seguro" },
    { id: "b2", num: "2", text: "¿Tiene una alergia seria a ALGÚN medicamento o alimento (p. ej., huevos, gelatina, timerosal, neomicina, gentamicina, etc.)?", thirdLabel: "No está seguro", note: { id: "b2Indique", label: "De ser así, indique:" } },
    { id: "b3", num: "3", text: "¿Alguna vez ha tenido una reacción seria o se ha desmayado después de recibir alguna vacuna?", thirdLabel: "No está seguro" },
    { id: "b4", num: "4", text: "¿Tiene sensibilidad al látex (p. ej., guantes o vendajes)?", thirdLabel: "No está seguro" },
    { id: "b5", num: "5", text: "¿Tiene un trastorno de convulsiones o trastorno cerebral? (Solo Tdap)", thirdLabel: "No está seguro" },
    { id: "b6", num: "6", text: "Para mujeres: ¿Está embarazada o está considerando quedar embarazada en el próximo mes?", thirdLabel: "No está seguro" },
  ],
  virusVivos: [
    { id: "v7", num: "7", text: "¿Ha recibido alguna vacuna en las últimas cuatro semanas?", thirdLabel: "No aplica", note: { id: "v7Indique", label: "De ser así, indique:" } },
    { id: "v8", num: "8", text: "¿Tiene cáncer, leucemia, VIH, herpes activo o cualquier otro problema del sistema inmunológico?", thirdLabel: "No aplica" },
    { id: "v9", num: "9", text: "¿Toma prednisona, esteroides orales, medicamentos contra el cáncer o antivirales o medicamentos que afecten el sistema inmunológico?", thirdLabel: "No aplica" },
    { id: "v10", num: "10", text: "Durante el último año, ¿ha recibido una transfusión de sangre o productos sanguíneos, se le ha administrado inmunoglobulina (gamma) o ha tenido radioterapia?", thirdLabel: "No aplica" },
    { id: "v11", num: "11", text: "¿Se le ha extirpado la glándula timo o tiene un historial de problemas con su timo, como miastenia gravis, síndrome DiGeorge o timoma? (Solo fiebre amarilla)", thirdLabel: "No aplica" },
    { id: "v12", num: "12", text: "¿Actualmente está tomando algún antibiótico o medicamentos antimaláricos? (Solo tifoidea oral)", thirdLabel: "No aplica" },
    { id: "v13", num: "13", text: "¿Tiene un historial de trombocitopenia o trombocitopenia púrpura?", thirdLabel: "No aplica" },
  ],
  seccionC: {
    columns: [
      { id: "nombre", label: "Nombre vacuna" },
      { id: "dosis", label: "N° Dosis" },
      { id: "lote", label: "Lote" },
      { id: "vencimiento", label: "Fecha vencimiento" },
      { id: "proxima", label: "Fecha próxima vacuna" },
      { id: "fabricante", label: "Fabricante" },
    ],
  },
  efectosAdversos: [
    "Las reacciones más frecuentes son en el sitio de inyección: dolor, enrojecimiento e hinchazón en el lugar de vacunación. Desaparece (sin tratamiento médico) dentro de las 48 horas. Otras reacciones poco frecuentes son: dolor de cabeza, fatiga, fiebre, náuseas, que desaparecen en las siguientes 48 horas. Si persisten, buscar atención en los establecimientos de salud.",
    "Desmayo: esta reacción puede producirse por temor o miedo y no por la vacuna propiamente. Para evitarla se recomienda administrar la vacuna mientras el paciente se encuentre sentado/a y permanecer así en observación 15 minutos después de la administración.",
    "Reacciones alérgicas como ronchas o picazón que pasan rápidamente. Si persisten, buscar atención en el establecimiento de salud.",
  ],
  legalText: `Por la presente hago constar que soy: (a) el paciente, mayor de 18 años; (b) la madre / el padre / tutor legal del paciente menor de edad; o (c) el tutor legal del paciente. Asimismo, por este medio doy mi consentimiento a Servicios y Asesorías En Infectología SAI, según corresponda, para que administren la(s) vacuna(s) solicitadas. Tengo entendido que no es posible predecir todos los posibles efectos secundarios o complicaciones a consecuencia de la administración de la(s) vacuna(s). Entiendo los riesgos y beneficios asociados a la(s) vacuna(s) descrita(s) arriba; he recibido, leído y/o se me ha explicado las vacunas que he decidido recibir. También reconozco que se me ha dado la oportunidad de hacer preguntas, las cuales fueron contestadas a mi entera satisfacción. Se me ha aconsejado permanecer cerca del lugar asignado a la vacunación por aproximadamente 15 minutos después de recibir la(s) vacuna(s) para estar bajo la observación del proveedor de servicios de salud que administra la(s) vacuna(s). El suscrito, en mi nombre, y en nombre de mis herederos y representantes personales, por la presente certifico eximir de cualquier responsabilidad y dejar en paz y a salvo a "Servicios Y Asesorías En Infectología", a su personal, agentes, sucesores, divisiones, afiliados, subsidiarias, dirigentes, directores, contratistas y empleados, de toda responsabilidad o queja, ya sea conocida o desconocida, derivada en virtud de y respecto a la administración de la(s) vacuna(s) administradas. Hago constar que: (a) entiendo los objetivos y beneficios del registro de vacunación ("Registro distrital") y el intercambio de información de salud de mi estado; y (b) el "Proveedor de Aplicación" puede divulgar la información de mi vacunación a –o a través del Registro distrital para propósitos de información de salud pública o a mis proveedores de servicios de salud inscritos en el Registro distrital para fines de coordinación de los cuidados de salud. Entiendo que, dependiendo de la ley, puedo prevenir que el "SAI", (a) divulguen la información de mi vacunación al Registro distrital; o (b) el Registro distrital compartan la información de mi vacunación con cualquiera de mis otros proveedores de salud inscritos en el Registro distrital. Estoy consciente de que, conforme a la ley, es requerido que otorgue mi consentimiento específico, salvo que la ley disponga lo contrario, con mi firma a continuación; por lo que doy mi autorización a SERVICIOS Y ASESORIAS EN INFECTOLOGIA SAI para que divulgue la información de mi vacunación, a las entidades correspondientes y para los fines descritos en este Consentimiento informado de vacunación. A menos que yo proporcione la planilla de exclusión aprobada, tengo entendido que mi consentimiento permanecerá en vigor hasta que retire dicho permiso y puedo retirar mi consentimiento al proporcionar a "SAI", según corresponda, la planilla de exclusión voluntaria. Entiendo que, aunque no otorgue mi consentimiento o, aunque retire dicho consentimiento, las leyes podrán permitir ciertas revelaciones de la información de mi vacunación a través del Registro distrital, según corresponda. Asimismo, doy mi autorización a "SAI" para que (a) dé a conocer mi información médica u otra información pertinente, incluso información sobre mis enfermedades transmisibles (como VIH), salud mental y abuso de drogas / alcohol a los profesionales encargados de los cuidados de mi salud, Servicios Y Asesorías En Infectología, o terceros pagadores requeridos para efectuar cuidados o pagos, (b) presentar una reclamación de gastos a mi compañía de seguros por concepto de los productos y servicios arriba solicitados, y (c) solicitar que los pagos correspondientes a beneficios autorizados en mi nombre por los productos y servicios arriba solicitados se hagan a "SAI". Estoy de acuerdo en asumir la responsabilidad financiera completa por cualquier copago, coaseguro y deducible incurrido por los productos y servicios solicitados, así como por otros productos y servicios cuyo costo no esté incluido en la cubierta de mi plan de salud. Tengo entendido que es mi responsabilidad hacer los pagos a los que estoy obligado al momento de recibir dichos productos y servicios; en caso de que "SAI" remita las facturas correspondientes con fecha posterior a la realización de los servicios, dichas facturas son pagaderas al momento de recibirlas.`,
  habeasData: `SECCIÓN F: HABEAS DATA (Ley estatutaria 1581 2012). Otorgo por este medio autorización a SAI para que almacenen, administren, y / o utilicen la información de mis datos personales y los transfieran entre ella según requiera en desarrollo de la IPS SAI, así mismo autorizo para que me contacten de manera telefónica, electrónica, física o cualquier otro medio de comunicación para darme información o brindarme apoyo de tipo educativo relacionado con temas de salud y manejo de mi enfermedad. Ley 1581 2012 ART. 3, 4, 5, 6, 7. Conozco y entiendo que tengo el derecho de conocer, actualizar, corregir o solicitar que se certifique o elimine mi información personal de las bases de datos en que se encuentre.

Entiendo que los responsables del manejo de mi información es SAI CALLE 50 # 13-62, PISO 3, TEL: 7449571 y que estos no compartirán mi información con terceros salvo con aquellos que utilicen para el manejo de la base de datos.`,
  firmas: {
    firmaPaciente: { id: "firma", label: "Firma del paciente (o Madre / Padre / Tutor legal si es menor de edad)" },
    firmaResponsable: { id: "firmaResponsable", label: "Firma responsable de vacunación" },
  },
};
```

- [ ] **Step 2: Colocar logos placeholder si el usuario aún no los entregó**

Si `src/assets/consents/soul-logo.png` o `sai-logo.png` no existen, el build falla. Verificar:

Run: `ls src/assets/consents/`
Si faltan: pedir al usuario los archivos, o crear placeholders temporales copiando el logo existente para no bloquear typecheck:
```bash
mkdir -p src/assets/consents
cp src/assets/Logo_GrupoSoul.png src/assets/consents/soul-logo.png
cp src/assets/Logo_GrupoSoul.png src/assets/consents/sai-logo.png
```
(Placeholder; el usuario reemplaza los .png reales después. Registrar en el commit que son placeholders.)

- [ ] **Step 3: Verificar typecheck (ahora sí pasa)**

Run: `npm run build`
Expected: PASS (o solo errores preexistentes ajenos a `config/`). El módulo `config/` compila.

- [ ] **Step 4: Commit (cierra Tasks 1-3)**

```bash
git add src/components/consents/config/ src/assets/consents/
git commit -m "consents: configs data-driven SOUL/SAI + tipos compartidos

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Componentes de campo atómicos

**Files:**
- Create: `src/components/consents/fields/CheckboxGroupField.tsx`
- Create: `src/components/consents/fields/TriStateQuestion.tsx`
- Create: `src/components/consents/fields/VaccineTable.tsx`

**Interfaces:**
- Consumes: tipos `ConditionsGroup`, `TriStateQ`, `VaccineTableColumn` de `../config/entityConfig`.
- Produces:
  - `CheckboxGroupField({ group, value, onChange })` — `value: string` ("A; B"), `onChange(next: string)`.
  - `TriStateQuestion({ q, value, note, onChange, onNoteChange })` — `value: string` (uno de "Sí"|"No"|thirdLabel|""), `note: string`, callbacks.
  - `VaccineTable({ columns, onChange, resetKey })` — mantiene filas internamente y emite `onChange(json: string)`; se limpia cuando cambia `resetKey` (patrón de SignaturePad).

- [ ] **Step 1: `CheckboxGroupField.tsx`**

```tsx
import type { ConditionsGroup } from "../config/entityConfig";

type Props = {
  group: ConditionsGroup;
  /** Valor serializado "Opción A; Opción B". */
  value: string;
  onChange: (next: string) => void;
};

const SEP = "; ";

export default function CheckboxGroupField({ group, value, onChange }: Props) {
  const selected = new Set(value ? value.split(SEP) : []);

  const toggle = (opt: string) => {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    // Conserva el orden de group.options para salida estable.
    const ordered = group.options.filter((o) => next.has(o));
    onChange(ordered.join(SEP));
  };

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-2 block text-[13px] font-semibold text-slate-700 dark:text-slate-200">
        {group.label}
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {group.options.map((opt) => (
          <label
            key={opt}
            className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200"
          >
            <input
              type="checkbox"
              checked={selected.has(opt)}
              onChange={() => toggle(opt)}
              className="h-4 w-4 accent-[#00c2a8]"
            />
            {opt}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 2: `TriStateQuestion.tsx`**

```tsx
import type { TriStateQ } from "../config/entityConfig";

type Props = {
  q: TriStateQ;
  value: string;         // "Sí" | "No" | q.thirdLabel | ""
  note: string;
  onChange: (v: string) => void;
  onNoteChange: (v: string) => void;
};

export default function TriStateQuestion({ q, value, note, onChange, onNoteChange }: Props) {
  const options = ["Sí", "No", q.thirdLabel];
  return (
    <div className="border-b border-slate-100 py-3 last:border-0 dark:border-slate-700">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <p className="m-0 text-[13px] leading-snug text-slate-700 dark:text-slate-200">
          <span className="mr-1 font-semibold text-[#0f766e] dark:text-[#2dd4bf]">{q.num}.</span>
          {q.text}
          {q.required && <span className="ml-0.5 text-red-500">*</span>}
        </p>
        <div className="flex shrink-0 gap-3">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-1 text-[12px] text-slate-600 dark:text-slate-300">
              <input
                type="radio"
                name={q.id}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="h-3.5 w-3.5 accent-[#00c2a8]"
              />
              {opt}
            </label>
          ))}
        </div>
      </div>
      {q.note && (
        <div className="mt-2">
          <label className="mb-1 block text-[12px] text-slate-500 dark:text-slate-400">{q.note.label}</label>
          <input
            type="text"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#00c2a8] focus:ring-2 focus:ring-[#00c2a8]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `VaccineTable.tsx`**

```tsx
import { useEffect, useState } from "react";
import type { VaccineTableColumn } from "../config/entityConfig";

type Row = Record<string, string>;

type Props = {
  columns: VaccineTableColumn[];
  /** Emite las filas no vacías como JSON legible. */
  onChange: (json: string) => void;
  /** Al cambiar, reinicia a una fila vacía (patrón de SignaturePad). */
  resetKey?: number;
};

const emptyRow = (columns: VaccineTableColumn[]): Row =>
  Object.fromEntries(columns.map((c) => [c.id, ""]));

export default function VaccineTable({ columns, onChange, resetKey = 0 }: Props) {
  const [rows, setRows] = useState<Row[]>([emptyRow(columns)]);

  useEffect(() => {
    if (resetKey === 0) return;
    setRows([emptyRow(columns)]);
  }, [resetKey, columns]);

  const emit = (next: Row[]) => {
    const filled = next.filter((r) => Object.values(r).some((v) => v.trim() !== ""));
    onChange(filled.length ? JSON.stringify(filled) : "");
  };

  const setCell = (i: number, colId: string, v: string) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [colId]: v } : r));
    setRows(next);
    emit(next);
  };

  const addRow = () => setRows((r) => [...r, emptyRow(columns)]);
  const removeRow = (i: number) => {
    const next = rows.filter((_, idx) => idx !== i);
    const safe = next.length ? next : [emptyRow(columns)];
    setRows(safe);
    emit(safe);
  };

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[640px] border-collapse text-[12px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800">
              {columns.map((c) => (
                <th key={c.id} className="border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  {c.label}
                </th>
              ))}
              <th className="border-b border-slate-200 px-2 py-2 dark:border-slate-700" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.id} className="border-b border-slate-100 px-1.5 py-1.5 dark:border-slate-700">
                    <input
                      type="text"
                      value={row[c.id]}
                      onChange={(e) => setCell(i, c.id, e.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-900 outline-none focus:border-[#00c2a8] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </td>
                ))}
                <td className="border-b border-slate-100 px-1.5 py-1.5 text-center dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="rounded px-2 py-1 text-slate-400 hover:text-red-500"
                    aria-label="Eliminar fila"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 rounded-md border-[1.5px] border-[#00c2a8] bg-transparent px-4 py-1.5 text-[13px] font-medium text-[#00c2a8] transition-colors hover:bg-[#00c2a8]/5"
      >
        + Agregar vacuna
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Verificar typecheck + lint**

Run: `npm run build && npm run lint`
Expected: PASS sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/components/consents/fields/
git commit -m "consents: campos atomicos CheckboxGroup, TriState y VaccineTable

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Helper de aplanado (`flattenConsent.ts`)

**Files:**
- Create: `src/components/consents/flattenConsent.ts`

**Interfaces:**
- Consumes: `EntityConfig` de `./config`.
- Produces:
  - `type ConsentState = { values: Record<string,string>; firma: string; firmaResp: string; accepted: boolean }`.
  - `flattenConsent(config, state): Record<string,string>` — mezcla `values` (que ya contiene tri-states, notas, condiciones y la tabla JSON como strings) con `firma`, `firmaResponsable` y `aceptaConsentimiento`.
  - `collectMissing(config, state): string[]` — labels de obligatorios vacíos.
  - `readableSummary(config, values): Record<string,string>` — subconjunto sin firmas (para el cuerpo del email).

- [ ] **Step 1: Crear `flattenConsent.ts`**

```ts
import {
  ACCEPT_FIELD_ID,
  SIGNATURE_FIELD_ID,
  SIGNATURE_RESP_FIELD_ID,
  type EntityConfig,
} from "./config";

export type ConsentState = {
  values: Record<string, string>;
  firma: string;
  firmaResp: string;
  accepted: boolean;
};

/** Todos los campos de datos con valor simple (para validación y resumen). */
function generalRequired(config: EntityConfig) {
  return config.datosGenerales.filter((f) => f.required);
}

export function collectMissing(config: EntityConfig, state: ConsentState): string[] {
  const missing: string[] = [];
  for (const f of generalRequired(config)) {
    if (!(state.values[f.id] ?? "").trim()) missing.push(f.label);
  }
  // Preguntas marcadas required (por defecto ninguna).
  for (const q of [...config.seccionB, ...config.virusVivos]) {
    if (q.required && !(state.values[q.id] ?? "").trim()) missing.push(q.text);
  }
  if (!state.accepted) missing.push("Aceptar el consentimiento informado");
  if (!state.firma) missing.push(config.firmas.firmaPaciente.label);
  if (!state.firmaResp) missing.push(config.firmas.firmaResponsable.label);
  return missing;
}

export function flattenConsent(config: EntityConfig, state: ConsentState): Record<string, string> {
  return {
    ...state.values,
    [SIGNATURE_FIELD_ID]: state.firma,
    [SIGNATURE_RESP_FIELD_ID]: state.firmaResp,
    [ACCEPT_FIELD_ID]: state.accepted ? "Sí" : "No",
  };
}

/** Datos legibles (sin firmas) para el cuerpo del correo. */
export function readableSummary(
  config: EntityConfig,
  values: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of config.datosGenerales) out[f.id] = values[f.id] ?? "";
  return out;
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/consents/flattenConsent.ts
git commit -m "consents: helper de aplanado y validacion multi-entidad

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Componentes de sección

**Files:**
- Create: `src/components/consents/sections/GeneralDataSection.tsx`
- Create: `src/components/consents/sections/SectionA.tsx`
- Create: `src/components/consents/sections/SectionB.tsx`
- Create: `src/components/consents/sections/LiveVaccinesSection.tsx`
- Create: `src/components/consents/sections/SectionC.tsx`
- Create: `src/components/consents/sections/LegalSection.tsx`

**Interfaces:**
- Consumes: `EntityConfig`, componentes de Task 4, `SignaturePad`.
- Produces: cada sección recibe props controladas del orquestador (Task 7). Firmas:
  - `GeneralDataSection({ config, values, setValue })`
  - `SectionA({ config, values, setValue })`
  - `SectionB({ config, values, setValue })`
  - `LiveVaccinesSection({ config, values, setValue })`
  - `SectionC({ config, onTableChange, resetKey })`
  - `LegalSection({ config, accepted, setAccepted, onFirma, onFirmaResp, resetKey })`
  - Tipo compartido: `setValue = (id: string, v: string) => void`.

- [ ] **Step 1: Crear un módulo de estilos compartido `sections/sharedUi.tsx`**

```tsx
import type { ConsentField } from "../config/entityConfig";

export const labelCls =
  "mb-1.5 block text-[13px] font-semibold text-slate-700 dark:text-slate-200";
export const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-[#00c2a8] focus:ring-2 focus:ring-[#00c2a8]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
export const cardCls =
  "mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900";
export const sectionTitleCls =
  "m-0 mb-4 text-sm font-bold text-[#0f766e] dark:text-[#2dd4bf]";

export function FieldControl({
  field,
  value,
  onChange,
}: {
  field: ConsentField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === "select") {
    return (
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecciona…</option>
        {field.options?.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={field.type === "number" ? "number" : field.type}
      className={inputCls}
      placeholder={field.placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function FieldGrid({
  fields,
  values,
  setValue,
}: {
  fields: ConsentField[];
  values: Record<string, string>;
  setValue: (id: string, v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.id} className={f.half ? "" : "sm:col-span-2"}>
          <label className={labelCls}>
            {f.label}
            {f.required && <span className="ml-0.5 text-red-500">*</span>}
          </label>
          <FieldControl field={f} value={values[f.id] ?? ""} onChange={(v) => setValue(f.id, v)} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `GeneralDataSection.tsx`**

```tsx
import type { EntityConfig } from "../config/entityConfig";
import { FieldGrid, cardCls, sectionTitleCls } from "./sharedUi";

type Props = {
  config: EntityConfig;
  values: Record<string, string>;
  setValue: (id: string, v: string) => void;
};

export default function GeneralDataSection({ config, values, setValue }: Props) {
  return (
    <section className={cardCls}>
      <h2 className={sectionTitleCls}>Datos generales</h2>
      <FieldGrid fields={config.datosGenerales} values={values} setValue={setValue} />
    </section>
  );
}
```

- [ ] **Step 3: `SectionA.tsx`**

```tsx
import type { EntityConfig } from "../config/entityConfig";
import CheckboxGroupField from "../fields/CheckboxGroupField";
import TriStateQuestion from "../fields/TriStateQuestion";
import { FieldControl, cardCls, labelCls, sectionTitleCls } from "./sharedUi";

type Props = {
  config: EntityConfig;
  values: Record<string, string>;
  setValue: (id: string, v: string) => void;
};

export default function SectionA({ config, values, setValue }: Props) {
  const a = config.seccionA;
  return (
    <section className={cardCls}>
      <h2 className={sectionTitleCls}>Sección A · Historial de vacunas</h2>

      {a.tetanosAnios && (
        <div className="mb-4">
          <label className={labelCls}>{a.tetanosAnios.label}</label>
          <FieldControl field={a.tetanosAnios} value={values[a.tetanosAnios.id] ?? ""} onChange={(v) => setValue(a.tetanosAnios!.id, v)} />
        </div>
      )}

      <div className="mb-4">
        <CheckboxGroupField group={a.condiciones} value={values[a.condiciones.id] ?? ""} onChange={(v) => setValue(a.condiciones.id, v)} />
      </div>

      <TriStateQuestion
        q={a.antineumococica}
        value={values[a.antineumococica.id] ?? ""}
        note=""
        onChange={(v) => setValue(a.antineumococica.id, v)}
        onNoteChange={() => {}}
      />
      <div className="my-3">
        <label className={labelCls}>{a.antineumococicaFecha.label}</label>
        <FieldControl field={a.antineumococicaFecha} value={values[a.antineumococicaFecha.id] ?? ""} onChange={(v) => setValue(a.antineumococicaFecha.id, v)} />
      </div>

      <TriStateQuestion
        q={a.herpesZoster}
        value={values[a.herpesZoster.id] ?? ""}
        note=""
        onChange={(v) => setValue(a.herpesZoster.id, v)}
        onNoteChange={() => {}}
      />
    </section>
  );
}
```

- [ ] **Step 4: `SectionB.tsx` y `LiveVaccinesSection.tsx` (mismo patrón, distinto array y título)**

`SectionB.tsx`:
```tsx
import type { EntityConfig } from "../config/entityConfig";
import TriStateQuestion from "../fields/TriStateQuestion";
import { cardCls, sectionTitleCls } from "./sharedUi";

type Props = {
  config: EntityConfig;
  values: Record<string, string>;
  setValue: (id: string, v: string) => void;
};

export default function SectionB({ config, values, setValue }: Props) {
  return (
    <section className={cardCls}>
      <h2 className={sectionTitleCls}>Sección B · Cuestionario sobre salud</h2>
      {config.seccionB.map((q) => (
        <TriStateQuestion
          key={q.id}
          q={q}
          value={values[q.id] ?? ""}
          note={q.note ? values[q.note.id] ?? "" : ""}
          onChange={(v) => setValue(q.id, v)}
          onNoteChange={(v) => q.note && setValue(q.note.id, v)}
        />
      ))}
    </section>
  );
}
```

`LiveVaccinesSection.tsx`:
```tsx
import type { EntityConfig } from "../config/entityConfig";
import TriStateQuestion from "../fields/TriStateQuestion";
import { cardCls, sectionTitleCls } from "./sharedUi";

type Props = {
  config: EntityConfig;
  values: Record<string, string>;
  setValue: (id: string, v: string) => void;
};

export default function LiveVaccinesSection({ config, values, setValue }: Props) {
  return (
    <section className={cardCls}>
      <h2 className={sectionTitleCls}>Vacunas de virus vivos · Preguntas adicionales</h2>
      <p className="m-0 mb-3 text-[12px] italic text-slate-500 dark:text-slate-400">
        (Varicela, MMR® II, tifoidea oral, herpes, fiebre amarilla, cólera)
      </p>
      {config.virusVivos.map((q) => (
        <TriStateQuestion
          key={q.id}
          q={q}
          value={values[q.id] ?? ""}
          note={q.note ? values[q.note.id] ?? "" : ""}
          onChange={(v) => setValue(q.id, v)}
          onNoteChange={(v) => q.note && setValue(q.note.id, v)}
        />
      ))}
    </section>
  );
}
```

- [ ] **Step 5: `SectionC.tsx`**

```tsx
import type { EntityConfig } from "../config/entityConfig";
import VaccineTable from "../fields/VaccineTable";
import { cardCls, sectionTitleCls } from "./sharedUi";

type Props = {
  config: EntityConfig;
  onTableChange: (json: string) => void;
  resetKey: number;
};

export default function SectionC({ config, onTableChange, resetKey }: Props) {
  return (
    <section className={cardCls}>
      <h2 className={sectionTitleCls}>Sección C · Datos de la(s) vacuna(s)</h2>
      <VaccineTable columns={config.seccionC.columns} onChange={onTableChange} resetKey={resetKey} />
    </section>
  );
}
```

- [ ] **Step 6: `LegalSection.tsx` (efectos adversos SAI + legal + habeas + 2 firmas)**

```tsx
import type { EntityConfig } from "../config/entityConfig";
import SignaturePad from "../SignaturePad";
import { cardCls, labelCls, sectionTitleCls } from "./sharedUi";

type Props = {
  config: EntityConfig;
  accepted: boolean;
  setAccepted: (v: boolean) => void;
  onFirma: (dataUrl: string) => void;
  onFirmaResp: (dataUrl: string) => void;
  resetKey: number;
};

const textBoxCls =
  "mb-4 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";

export default function LegalSection({ config, accepted, setAccepted, onFirma, onFirmaResp, resetKey }: Props) {
  return (
    <section className={cardCls}>
      {config.efectosAdversos && (
        <>
          <h2 className={sectionTitleCls}>Posibles efectos adversos esperados</h2>
          <ul className="mb-5 list-disc space-y-1.5 pl-5 text-[13px] text-slate-700 dark:text-slate-200">
            {config.efectosAdversos.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </>
      )}

      <h2 className={sectionTitleCls}>Consentimiento informado</h2>
      <div className={textBoxCls}>
        {config.legalText.split("\n\n").map((p, i) => (
          <p key={i} className="mb-2.5 text-justify last:mb-0">{p}</p>
        ))}
      </div>

      <h2 className={sectionTitleCls}>Habeas Data</h2>
      <div className={textBoxCls}>
        {config.habeasData.split("\n\n").map((p, i) => (
          <p key={i} className="mb-2.5 text-justify last:mb-0">{p}</p>
        ))}
      </div>

      <label className="mb-5 flex cursor-pointer items-start gap-2.5 text-[13px] text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#00c2a8]"
        />
        <span>
          He leído y acepto el consentimiento informado y la autorización de tratamiento de datos.
          <span className="ml-0.5 text-red-500">*</span>
        </span>
      </label>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className={labelCls}>
            {config.firmas.firmaPaciente.label}
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <SignaturePad onChange={onFirma} resetKey={resetKey} />
        </div>
        <div>
          <label className={labelCls}>
            {config.firmas.firmaResponsable.label}
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <SignaturePad onChange={onFirmaResp} resetKey={resetKey} />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Verificar typecheck + lint**

Run: `npm run build && npm run lint`
Expected: PASS sin errores nuevos.

- [ ] **Step 8: Commit**

```bash
git add src/components/consents/sections/
git commit -m "consents: componentes de seccion (generales, A, B, virus vivos, C, legal)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Refactor de `useVaccinationConsent` (recibe formId)

**Files:**
- Modify: `src/components/consents/useVaccinationConsent.ts`

**Interfaces:**
- Consumes: `EntityConfig`, `flattenConsent`/`readableSummary` (Task 5), `buildVaccinationConsentHtml` (Task 8, misma firma nueva).
- Produces: `submitConsent(config: EntityConfig, flat: Record<string,string>)` — antes recibía solo values; ahora recibe el config activo (para formId, nombre de PDF, resumen). El resto del API (`submitting`, `emailStatus`, `emailError`, `done`, `reset`) sin cambios.

- [ ] **Step 1: Reemplazar imports y firma de `submitConsent`**

Cambiar el bloque de imports superior:
```ts
import { useState } from "react";
import { useSubmissionsStore } from "../../store/useSubmissionsStore";
import { useAuthStore } from "../../store/useAuthStore";
import { sendFormEmail, type EmailAttachment } from "../../services/emailService";
import { htmlToPdfBase64 } from "../../utils/pdfExporter";
import type { EmailTemplate } from "../../types/email-template.types";
import type { EmailStatus } from "../form/SuccessModal";
import { CLINIC_EMAIL, CONSENT_FOLDER_ID, type EntityConfig } from "./config";
import { readableSummary } from "./flattenConsent";
import { buildVaccinationConsentHtml } from "./vaccinationConsentPdf";
```

- [ ] **Step 2: Parametrizar la plantilla de email y el envío por config**

Reemplazar `buildEmailTemplate()` para aceptar el config y usar su `displayName`:
```ts
function buildEmailTemplate(config: EntityConfig): EmailTemplate {
  return {
    enabled: true,
    subject: `Consentimiento de vacunación ${config.meta.displayName} firmado - \${pacienteNombre}`,
    senderName: `${config.meta.displayName} - Consentimientos`,
    to: "",
    toRecipients: [
      { id: "clinic", type: "static", email: CLINIC_EMAIL },
      { id: "patient", type: "group", group: "current_user", groupLabel: "Paciente" },
    ],
    emailBody: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#374151;">
        <h2 style="color:#0f766e;margin:0 0 12px;">Consentimiento de vacunación · ${config.meta.displayName}</h2>
        <p>Se ha registrado y firmado el consentimiento de vacunación de
        <strong>\${pacienteNombre}</strong> (documento \${pacienteNumDoc}).</p>
        <p>Adjuntamos el consentimiento firmado en formato PDF.</p>
        <p style="color:#9ca3af;font-size:12px;">${config.meta.entidadNombre}</p>
      </div>`,
    attachPDF: true,
    pdfTemplate: "",
    pdfFilename: `consentimiento-vacunacion-${config.meta.key}.pdf`,
  };
}
```

- [ ] **Step 3: Actualizar `submitConsent` para usar el config**

```ts
  async function submitConsent(config: EntityConfig, flat: Record<string, string>) {
    if (submitting) return;
    setSubmitting(true);
    setEmailStatus("idle");
    setEmailError(null);

    await addSubmission({
      formId: config.meta.formId,
      folderId: CONSENT_FOLDER_ID,
      data: flat,
    });

    setEmailStatus("sending");
    try {
      const html = buildVaccinationConsentHtml(config, flat);
      const base64 = await htmlToPdfBase64(html);
      const attachments: EmailAttachment[] = [
        { name: `consentimiento-vacunacion-${config.meta.key}.pdf`, contentType: "application/pdf", contentBytes: base64 },
      ];
      await sendFormEmail({
        template: buildEmailTemplate(config),
        formData: readableSummary(config, flat),
        users: [],
        currentUser: currentUser ?? undefined,
        attachments,
      });
      setEmailStatus("sent");
    } catch (err) {
      console.error("Error enviando el consentimiento por email:", err);
      setEmailStatus("error");
      setEmailError(err instanceof Error ? err.message : String(err));
    }

    setSubmitting(false);
    setDone(true);
  }
```

Eliminar la constante `PDF_FILENAME` (ya no se usa) y el import de `CONSENT_FORM_ID` (ya no existe).

- [ ] **Step 4: Verificar typecheck (fallará hasta Task 8 por firma de `buildVaccinationConsentHtml`)**

Run: `npm run build`
Expected: FALLA con desajuste de argumentos en `buildVaccinationConsentHtml`. Se resuelve en Task 8. **No commit** — continuar a Task 8.

---

### Task 8: Refactor del generador de PDF (`vaccinationConsentPdf.ts`)

**Files:**
- Modify (reescritura completa): `src/components/consents/vaccinationConsentPdf.ts`

**Interfaces:**
- Consumes: `EntityConfig`, IDs especiales.
- Produces: `buildVaccinationConsentHtml(config: EntityConfig, values: Record<string,string>): string`. (Se elimina `buildEmailSummary`; su rol lo cubre `readableSummary` de Task 5.)

- [ ] **Step 1: Reescribir `vaccinationConsentPdf.ts` data-driven**

```ts
// Construye el HTML del Consentimiento de Vacunación (por entidad) para el PDF
// adjunto al correo. Renderiza datos generales, secciones A/B/virus vivos,
// tabla de vacunas, textos legales y ambas firmas incrustadas como <img>.

import {
  SIGNATURE_FIELD_ID,
  SIGNATURE_RESP_FIELD_ID,
  PATIENT_DOC_FIELD_ID,
  type EntityConfig,
  type TriStateQ,
} from "./config";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function kvRows(pairs: Array<[string, string]>): string {
  return pairs
    .filter(([, v]) => (v ?? "").trim() !== "")
    .map(
      ([label, v]) => `
        <tr>
          <td style="padding:6px 9px;border:1px solid #d7dee8;background:#f5f8fc;font-weight:600;width:42%;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:6px 9px;border:1px solid #d7dee8;">${escapeHtml(v)}</td>
        </tr>`,
    )
    .join("");
}

function questionRows(questions: TriStateQ[], values: Record<string, string>): string {
  return questions
    .map((q) => {
      const ans = values[q.id] ?? "";
      const note = q.note ? values[q.note.id] ?? "" : "";
      if (!ans && !note) return "";
      const noteHtml = note ? ` <em>(${escapeHtml(note)})</em>` : "";
      return `
        <tr>
          <td style="padding:6px 9px;border:1px solid #d7dee8;width:80%;">${q.num}. ${escapeHtml(q.text)}</td>
          <td style="padding:6px 9px;border:1px solid #d7dee8;font-weight:600;">${escapeHtml(ans)}${noteHtml}</td>
        </tr>`;
    })
    .join("");
}

function vaccineTableHtml(config: EntityConfig, raw: string): string {
  if (!raw) return "";
  let rows: Array<Record<string, string>> = [];
  try {
    rows = JSON.parse(raw);
  } catch {
    return "";
  }
  if (!rows.length) return "";
  const head = config.seccionC.columns
    .map((c) => `<th style="padding:5px 7px;border:1px solid #d7dee8;background:#f5f8fc;font-size:11px;">${escapeHtml(c.label)}</th>`)
    .join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${config.seccionC.columns
          .map((c) => `<td style="padding:5px 7px;border:1px solid #d7dee8;font-size:11px;">${escapeHtml(r[c.id] ?? "")}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function signatureCell(dataUrl: string, label: string): string {
  const img = dataUrl.startsWith("data:image/")
    ? `<img src="${dataUrl}" alt="Firma" style="max-height:80px;max-width:100%;object-fit:contain;display:block;margin-bottom:6px;" />`
    : `<div style="height:80px;"></div>`;
  return `<td style="width:50%;vertical-align:bottom;padding-right:16px;">${img}<div style="border-top:1px solid #1f2937;padding-top:4px;font-size:11px;">${escapeHtml(label)}</div></td>`;
}

export function buildVaccinationConsentHtml(config: EntityConfig, values: Record<string, string>): string {
  const generalPairs: Array<[string, string]> = config.datosGenerales.map((f) => [f.label, values[f.id] ?? ""]);

  const a = config.seccionA;
  const seccionAPairs: Array<[string, string]> = [];
  if (a.tetanosAnios) seccionAPairs.push([a.tetanosAnios.label, values[a.tetanosAnios.id] ?? ""]);
  seccionAPairs.push([a.condiciones.label, values[a.condiciones.id] ?? ""]);
  const seccionAQuestions = questionRows([a.antineumococica, a.herpesZoster], values);
  const antFecha = (values[a.antineumococicaFecha.id] ?? "").trim();

  const legalParagraphs = config.legalText
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 10px;text-align:justify;line-height:1.5;">${escapeHtml(p)}</p>`)
    .join("");
  const habeasParagraphs = config.habeasData
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 10px;text-align:justify;line-height:1.5;">${escapeHtml(p)}</p>`)
    .join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:12px;padding:22px 26px;">
    <div style="text-align:center;border-bottom:3px solid #00c2a8;padding-bottom:12px;margin-bottom:16px;">
      <img src="${config.meta.logo}" alt="${escapeHtml(config.meta.displayName)}" style="max-height:56px;margin-bottom:8px;" />
      <h1 style="margin:0;font-size:18px;color:#0f766e;">Consentimiento Informado para Vacunación</h1>
      <div style="font-size:11px;color:#6b7280;margin-top:4px;">${escapeHtml(config.meta.entidadNombre)} · Código ${escapeHtml(config.meta.codigo)} · Versión ${escapeHtml(config.meta.version)}</div>
    </div>

    <h2 style="font-size:13px;color:#0f766e;margin:0 0 6px;">Datos generales</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">${kvRows(generalPairs)}</table>

    <h2 style="font-size:13px;color:#0f766e;margin:0 0 6px;">Sección A · Historial de vacunas</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">${kvRows(seccionAPairs)}${seccionAQuestions}</table>
    ${antFecha ? `<div style="margin-bottom:16px;font-size:11px;"><strong>Antineumocócica ¿cuándo?:</strong> ${escapeHtml(antFecha)}</div>` : ""}

    <h2 style="font-size:13px;color:#0f766e;margin:0 0 6px;">Sección B · Cuestionario sobre salud</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">${questionRows(config.seccionB, values)}</table>

    <h2 style="font-size:13px;color:#0f766e;margin:0 0 6px;">Vacunas de virus vivos</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">${questionRows(config.virusVivos, values)}</table>

    <h2 style="font-size:13px;color:#0f766e;margin:0 0 6px;">Sección C · Datos de la(s) vacuna(s)</h2>
    ${vaccineTableHtml(config, values["seccionC"] ?? "")}

    <h2 style="font-size:13px;color:#0f766e;margin:0 0 6px;">Consentimiento informado</h2>
    <div style="font-size:11px;margin-bottom:14px;">${legalParagraphs}</div>
    <h2 style="font-size:13px;color:#0f766e;margin:0 0 6px;">Habeas Data</h2>
    <div style="font-size:11px;margin-bottom:18px;">${habeasParagraphs}</div>

    <table style="width:100%;border-collapse:collapse;margin-top:20px;">
      <tr>
        ${signatureCell(values[SIGNATURE_FIELD_ID] ?? "", config.firmas.firmaPaciente.label)}
        ${signatureCell(values[SIGNATURE_RESP_FIELD_ID] ?? "", config.firmas.firmaResponsable.label)}
      </tr>
    </table>
    <div style="margin-top:10px;font-size:11px;color:#374151;"><strong>Documento:</strong> ${escapeHtml(values[PATIENT_DOC_FIELD_ID] ?? "")}</div>
  </div>`;
}
```

Nota: `values["seccionC"]` es el JSON de la tabla; el orquestador (Task 9) guarda la tabla bajo el id `"seccionC"`.

- [ ] **Step 2: Verificar typecheck (junto con Task 7 ya cuadra)**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit (cierra Tasks 7-8)**

```bash
git add src/components/consents/useVaccinationConsent.ts src/components/consents/vaccinationConsentPdf.ts
git commit -m "consents: hook y generador de PDF data-driven por entidad

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Orquestador `VaccinationConsentForm` (dropdown + secciones + envío)

**Files:**
- Modify (reescritura completa): `src/components/consents/VaccinationConsentForm.tsx`

**Interfaces:**
- Consumes: `ENTITIES`, `ENTITY_ORDER`, `getEntityConfig`, `EntityKey` (Task 1); todas las secciones (Task 6); `useVaccinationConsent` (Task 7); `flattenConsent`, `collectMissing` (Task 5); `ConfirmModal`, `MissingFieldsModal`, `SuccessModal`.
- Produces: componente por defecto con la misma prop `{ onBack?: () => void }` (sin cambios para `ConsentimientosPage`).

- [ ] **Step 1: Reescribir `VaccinationConsentForm.tsx`**

```tsx
import { useMemo, useState } from "react";
import { getEntityConfig, ENTITY_ORDER, ENTITIES, type EntityKey } from "./config";
import { useVaccinationConsent } from "./useVaccinationConsent";
import { collectMissing, flattenConsent } from "./flattenConsent";
import GeneralDataSection from "./sections/GeneralDataSection";
import SectionA from "./sections/SectionA";
import SectionB from "./sections/SectionB";
import LiveVaccinesSection from "./sections/LiveVaccinesSection";
import SectionC from "./sections/SectionC";
import LegalSection from "./sections/LegalSection";
import MissingFieldsModal from "../form/MissingFieldsModal";
import SuccessModal from "../form/SuccessModal";
import ConfirmModal from "../common/ConfirmModal";

type Props = { onBack?: () => void };

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function VaccinationConsentForm({ onBack }: Props) {
  const { submitConsent, submitting, emailStatus, emailError, done, reset } = useVaccinationConsent();

  const [entityKey, setEntityKey] = useState<EntityKey>("soul");
  const config = useMemo(() => getEntityConfig(entityKey), [entityKey]);

  const [values, setValues] = useState<Record<string, string>>({ fecha: todayISO() });
  const [firma, setFirma] = useState("");
  const [firmaResp, setFirmaResp] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [missing, setMissing] = useState<string[]>([]);
  const [pendingEntity, setPendingEntity] = useState<EntityKey | null>(null);

  const setValue = (id: string, v: string) => setValues((prev) => ({ ...prev, [id]: v }));

  const hasData = useMemo(
    () => Object.entries(values).some(([k, v]) => k !== "fecha" && v.trim() !== "") || !!firma || !!firmaResp,
    [values, firma, firmaResp],
  );

  const doResetForm = () => {
    setValues({ fecha: todayISO() });
    setFirma("");
    setFirmaResp("");
    setAccepted(false);
    setResetKey((k) => k + 1);
    reset();
  };

  const requestEntityChange = (next: EntityKey) => {
    if (next === entityKey) return;
    if (hasData) {
      setPendingEntity(next);
      return;
    }
    setEntityKey(next);
    doResetForm();
  };

  const confirmEntityChange = () => {
    if (!pendingEntity) return;
    setEntityKey(pendingEntity);
    setPendingEntity(null);
    doResetForm();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const miss = collectMissing(config, { values, firma, firmaResp, accepted });
    if (miss.length > 0) {
      setMissing(miss);
      return;
    }
    const flat = flattenConsent(config, { values, firma, firmaResp, accepted });
    submitConsent(config, flat);
  };

  const handleNew = () => doResetForm();

  return (
    <div className="min-h-screen bg-[#f0f4f8] font-sans dark:bg-slate-950">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-5 py-3.5">
          {onBack && (
            <button
              onClick={onBack}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              ← Volver
            </button>
          )}
          <img src={config.meta.logo} alt={config.meta.displayName} className="h-9 w-auto" />
          <div className="mr-auto">
            <h1 className="m-0 text-base font-bold text-slate-900 dark:text-slate-100">
              Consentimiento de Vacunación
            </h1>
            <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
              {config.meta.entidadNombre} · {config.meta.codigo} v{config.meta.version}
            </p>
          </div>
          <label className="flex items-center gap-2 text-[13px] font-medium text-slate-600 dark:text-slate-300">
            Entidad:
            <select
              value={entityKey}
              onChange={(e) => requestEntityChange(e.target.value as EntityKey)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-[#00c2a8] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {ENTITY_ORDER.map((k) => (
                <option key={k} value={k}>
                  {ENTITIES[k].meta.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl px-5 py-6">
        <GeneralDataSection config={config} values={values} setValue={setValue} />
        <SectionA config={config} values={values} setValue={setValue} />
        <SectionB config={config} values={values} setValue={setValue} />
        <LiveVaccinesSection config={config} values={values} setValue={setValue} />
        <SectionC config={config} onTableChange={(json) => setValue("seccionC", json)} resetKey={resetKey} />
        <LegalSection
          config={config}
          accepted={accepted}
          setAccepted={setAccepted}
          onFirma={setFirma}
          onFirmaResp={setFirmaResp}
          resetKey={resetKey}
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-[#00c2a8] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(0,194,168,0.3)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Procesando…" : "Firmar y enviar consentimiento"}
        </button>
      </form>

      {missing.length > 0 && <MissingFieldsModal fields={missing} onClose={() => setMissing([])} />}

      {pendingEntity && (
        <ConfirmModal
          title="Cambiar de entidad"
          message="Cambiar entre SOUL y SAI reiniciará el formulario y perderás lo diligenciado. ¿Continuar?"
          confirmLabel="Cambiar y reiniciar"
          confirmColor="#00c2a8"
          onCancel={() => setPendingEntity(null)}
          onConfirm={confirmEntityChange}
        />
      )}

      {done && (
        <SuccessModal
          emailStatus={emailStatus}
          emailError={emailError}
          onNewRegistration={handleNew}
          onClose={onBack}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck + lint**

Run: `npm run build && npm run lint`
Expected: PASS sin errores nuevos.

- [ ] **Step 3: Verificación visual con la skill `run`**

Levantar la app, entrar a Consientify → Consentimientos. Verificar:
1. Aparece el dropdown de entidad con SOUL y SAI; el logo cambia al cambiar la selección.
2. SOUL muestra la pregunta de tétanos; SAI no la muestra pero sí el campo Edad y Entidad que lo remite.
3. Con datos escritos, cambiar de entidad abre el `ConfirmModal`; cancelar mantiene, confirmar reinicia.
4. Se pueden marcar condiciones (checkbox), responder tri-estados, agregar/quitar filas de vacunas y firmar en ambos pads.
5. Enviar sin firmas/aceptación muestra `MissingFieldsModal` con los labels correctos.

- [ ] **Step 4: Commit**

```bash
git add src/components/consents/VaccinationConsentForm.tsx
git commit -m "consents: orquestador con dropdown de entidad, confirmacion y envio

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Backend — sembrar dos formularios

**Files:**
- Modify: `backend/src/consents/consents.seeder.ts`

**Interfaces:**
- Consumes: `Form`/`FormDocument` model (sin cambios).
- Produces: al arrancar, upsert de `consent-vaccination-soul` y `consent-vaccination-sai` con sus widgets. Los IDs de widget = espejo de los configs del frontend.

**Constraint de espejo:** cada `id` de widget debe coincidir con: `datosGenerales[].id`, `condiciones`, `antineumococica`, `antineumococicaFecha`, `herpesZoster`, `tetanosAnios` (solo SOUL), `b1..b6`, `b2Indique`, `v7..v13`, `v7Indique`, `seccionC`, `aceptaConsentimiento`, `firma`, `firmaResponsable`.

- [ ] **Step 1: Reescribir el seeder con un builder de widgets por entidad**

```ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Form, FormDocument } from '../forms/form.schema';

const CONSENT_FOLDER_ID = 'consent-system-folder';

type Widget = { id: string; type: string; label: string; required: boolean; config: Record<string, unknown> };

// Widgets comunes a ambas entidades. tetanosAnios se agrega solo a SOUL.
function buildWidgets(includeTetanos: boolean): Widget[] {
  const w = (id: string, type: string, label: string, required = false): Widget => ({ id, type, label, required, config: {} });
  const list: Widget[] = [
    w('fecha', 'date', 'Fecha', true),
    w('ciudad', 'text', 'Ciudad'),
    w('pacienteNombre', 'text', 'Nombre y Apellidos', true),
    w('pacienteTipoDoc', 'select', 'Tipo de documento', true),
    w('pacienteNumDoc', 'text', 'Documento', true),
    w('pacienteFechaNac', 'date', 'Fecha de nacimiento'),
    w('edad', 'number', 'Edad'),
    w('rh', 'text', 'RH'),
    w('entidad', 'text', 'Entidad'),
    w('entidadRemite', 'text', 'Entidad que lo remite'),
    w('eps', 'text', 'EPS'),
    w('direccion', 'text', 'Dirección del domicilio'),
    w('pacienteTelefono', 'phone', 'Teléfono'),
    w('pacienteEmail', 'email', 'Correo electrónico', true),
  ];
  if (includeTetanos) list.push(w('tetanosAnios', 'number', 'Años desde última vacuna de tétanos'));
  list.push(
    w('condiciones', 'text', 'Condiciones (Sección A)'),
    w('antineumococica', 'text', '¿Ha recibido antineumocócica?'),
    w('antineumococicaFecha', 'text', 'Antineumocócica ¿cuándo?'),
    w('herpesZoster', 'text', '¿Ha recibido herpes zóster?'),
    // Sección B
    w('b1', 'text', '¿Se siente enfermo hoy?'),
    w('b2', 'text', '¿Alergia seria a medicamento o alimento?'),
    w('b2Indique', 'text', 'Alergia — indique'),
    w('b3', 'text', '¿Reacción seria o desmayo tras vacuna?'),
    w('b4', 'text', '¿Sensibilidad al látex?'),
    w('b5', 'text', '¿Trastorno de convulsiones o cerebral? (Tdap)'),
    w('b6', 'text', '¿Embarazo o considera embarazo próximo mes?'),
    // Virus vivos
    w('v7', 'text', '¿Vacuna en últimas cuatro semanas?'),
    w('v7Indique', 'text', 'Vacuna reciente — indique'),
    w('v8', 'text', '¿Cáncer, leucemia, VIH u otro problema inmune?'),
    w('v9', 'text', '¿Prednisona/esteroides/antivirales/inmunosupresores?'),
    w('v10', 'text', '¿Transfusión, inmunoglobulina o radioterapia (último año)?'),
    w('v11', 'text', '¿Problemas del timo? (fiebre amarilla)'),
    w('v12', 'text', '¿Antibiótico o antimaláricos? (tifoidea oral)'),
    w('v13', 'text', '¿Historial de trombocitopenia o púrpura?'),
    // Sección C + firmas
    w('seccionC', 'text', 'Datos de vacunas (Sección C)'),
    w('aceptaConsentimiento', 'checkbox', 'Acepta el consentimiento', true),
    w('firma', 'signature', 'Firma del paciente / acudiente', true),
    w('firmaResponsable', 'signature', 'Firma responsable de vacunación', true),
  );
  return list;
}

const FORMS = [
  { id: 'consent-vaccination-soul', name: 'Consentimiento de Vacunación · SOUL', widgets: buildWidgets(true) },
  { id: 'consent-vaccination-sai', name: 'Consentimiento de Vacunación · SAI', widgets: buildWidgets(false) },
];

@Injectable()
export class ConsentsSeeder implements OnModuleInit {
  private readonly logger = new Logger(ConsentsSeeder.name);

  constructor(@InjectModel(Form.name) private readonly formModel: Model<FormDocument>) {}

  async onModuleInit(): Promise<void> {
    for (const f of FORMS) {
      try {
        await this.formModel.updateOne(
          { _id: f.id } as Record<string, unknown>,
          {
            $set: {
              name: f.name,
              folderId: CONSENT_FOLDER_ID,
              schema: { widgets: f.widgets, rules: [] },
              isActive: true,
            },
            $setOnInsert: {
              createdById: 0,
              version: 1,
              emailTemplate: null,
              isPublic: false,
              sendConfirmationEmail: false,
            },
          },
          { upsert: true },
        );
        this.logger.log(`Formulario "${f.name}" sembrado/actualizado`);
      } catch (err) {
        this.logger.error(`No se pudo sembrar ${f.id}`, err as Error);
      }
    }
  }
}
```

Nota: el formulario antiguo `consent-vaccination` queda huérfano pero inofensivo (no se borra para preservar envíos históricos). Documentarlo en el commit.

- [ ] **Step 2: Verificar build del backend**

Run: `cd backend && npm run build`
Expected: PASS (compila TS del backend). Volver a la raíz: `cd ..`.

- [ ] **Step 3: Verificación de arranque (seeder)**

Reiniciar el backend según la memoria de deploy (Tarea Programada SYSTEM, no pm2) y revisar logs: deben aparecer las dos líneas "Formulario ... sembrado/actualizado". Confirmar en Mongo que existen `consent-vaccination-soul` y `consent-vaccination-sai`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/consents/consents.seeder.ts
git commit -m "consents(backend): sembrar formularios separados SOUL y SAI con widgets completos

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Limpieza de `consentConfig.ts` y verificación end-to-end

**Files:**
- Modify: `src/components/consents/consentConfig.ts`
- Verify: flujo completo de envío por entidad.

**Interfaces:**
- Produces: `consentConfig.ts` reducido a re-exportar desde `./config` (compatibilidad) o eliminado si no quedan importadores. Confirmar con grep antes de tocar.

- [ ] **Step 1: Buscar importadores restantes de `consentConfig`**

Run: `grep -rn "consents/consentConfig\|from \"./consentConfig\"" src/`
Expected: idealmente solo referencias ya migradas. Si algún archivo aún importa símbolos viejos (`CONSENT_FORM_ID`, `PATIENT_FIELDS`, etc.), migrarlo a `./config` o a los nuevos configs.

- [ ] **Step 2: Reemplazar `consentConfig.ts` por re-exports de compatibilidad**

```ts
// Compatibilidad: la configuración del consentimiento se movió a ./config
// (multi-entidad SOUL/SAI). Este archivo re-exporta los símbolos aún usados.
export {
  ACCEPT_FIELD_ID,
  SIGNATURE_FIELD_ID,
  PATIENT_EMAIL_FIELD_ID,
  CONSENT_FOLDER_ID,
  CLINIC_EMAIL,
} from "./config";
```

Si el grep del Step 1 no arroja ningún importador, eliminar el archivo en su lugar:
`git rm src/components/consents/consentConfig.ts`.

- [ ] **Step 3: Verificar typecheck + lint**

Run: `npm run build && npm run lint`
Expected: PASS sin errores nuevos.

- [ ] **Step 4: Verificación end-to-end con la skill `run`**

Diligenciar y enviar un consentimiento **SOUL** completo (con firmas). Verificar:
1. `SuccessModal` aparece con estado de email.
2. El envío se persiste contra `consent-vaccination-soul` (revisar en la vista de envíos / Mongo).
3. Las dos firmas quedan en GridFS (según memoria de GridFS binarios).
4. El PDF adjunto al correo contiene logo SOUL, todas las secciones y ambas firmas.
Repetir con **SAI** y confirmar que persiste en `consent-vaccination-sai` y el PDF muestra el bloque de efectos adversos.

- [ ] **Step 5: Commit final**

```bash
git add src/components/consents/consentConfig.ts
git commit -m "consents: limpieza de consentConfig legacy tras migracion a config/

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (autor del plan)

**Cobertura del spec:**
- Selector de entidad (dropdown) → Task 9. ✔
- Dos formularios sembrados separados → Task 10. ✔
- Secciones fieles (A, B, virus vivos, C, legal, habeas; SAI efectos adversos) → Tasks 2-3 (datos) + Task 6 (render) + Task 8 (PDF). ✔
- Logos por entidad → Tasks 2-3 (import) + Tasks 8-9 (render). ✔
- Tri-estado con "indique", checkbox group, tabla repetible → Task 4. ✔
- Dos firmas → Task 6 (LegalSection) + Task 8 (PDF) + Task 10 (widgets). ✔
- Confirmación al cambiar de entidad con datos → Task 9. ✔
- Persistencia legible para Power BI (valores string, condiciones "; ", tabla JSON) → Tasks 4-5 + Task 10 labels. ✔
- Textos legales verbatim → Tasks 2-3. ✔
- Sin cambios en SignaturePad/MissingFieldsModal/SuccessModal/entrada Consientify/correo → respetado. ✔

**Consistencia de tipos:** IDs de campo usados en configs (Tasks 2-3), flatten (Task 5), PDF (Task 8) y seeder (Task 10) coinciden: `seccionC` (tabla), `firma`/`firmaResponsable`, `b2Indique`/`v7Indique`, `condiciones`. `submitConsent(config, flat)` — firma consistente entre Task 7 (definición) y Task 9 (uso). `buildVaccinationConsentHtml(config, values)` — consistente entre Task 8 (def) y Task 7 (uso).

**Placeholder scan:** los "placeholder" mencionados son archivos de logo temporales (decisión operativa explícita), no huecos de plan. Sin TODOs de lógica.

**Nota operativa:** el usuario debe entregar `soul-logo.png` y `sai-logo.png`; el plan incluye fallback temporal para no bloquear el build (Task 3, Step 2).
