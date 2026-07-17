# Consentimiento de Vacunación multi-entidad (SAI / SOUL)

Fecha: 2026-07-17

## Objetivo

Reemplazar el consentimiento de vacunación simplificado actual por un formulario
fiel a los PDFs oficiales de **SOUL** (código SV-FT-B01, versión 01) y **SAI**
(código SV-FT-01, versión 02), con un selector que permita elegir la entidad y
diligenciar el formulario correspondiente. Cada entidad persiste sus envíos por
separado para reportería/auditoría independientes.

## Decisiones tomadas (brainstorming)

- **Alcance:** fidelidad completa a los PDFs (todas las secciones).
- **Persistencia:** dos formularios sembrados separados —
  `consent-vaccination-soul` y `consent-vaccination-sai`.
- **Selector:** desplegable (dropdown) de entidad arriba del formulario; cambia
  contenido, textos y campos en vivo.
- **Marca/correo:** mismo correo de clínica para ambas; sin logos (solo texto).

## Arquitectura

Diseño **data-driven**: un único renderizador lee la configuración de la entidad
activa. Cumple reglas del repo (Atomic Design, componentes pequeños, TS estricto,
Tailwind mobile-first, dark mode, Zustand donde aplique estado global — aquí el
estado es local del formulario).

### Frontend — estructura de archivos

```
src/components/consents/
  config/
    entityConfig.ts     # tipos compartidos + IDs de campo (fuente de verdad)
    soulConfig.ts       # config SOUL (SV-FT-B01 v01)
    saiConfig.ts        # config SAI  (SV-FT-01 v02)
    index.ts            # ENTITIES = { soul, sai }
  fields/
    CheckboxGroupField.tsx  # condiciones Sección A (multi-select)
    TriStateQuestion.tsx    # SI / No / (No aplica|No está seguro) + "indique" opcional
    VaccineTable.tsx        # Sección C: filas repetibles
  sections/
    GeneralDataSection.tsx
    SectionA.tsx            # historial de vacunas
    SectionB.tsx            # cuestionario de salud (preguntas 1-6)
    LiveVaccinesSection.tsx # preguntas virus vivos 7-13
    SectionC.tsx            # tabla de vacunas aplicadas
    LegalSection.tsx        # efectos adversos (SAI) + legal + habeas data + firmas
  VaccinationConsentForm.tsx  # orquesta: dropdown + secciones desde config
  SignaturePad.tsx            # SIN CAMBIOS
  useVaccinationConsent.ts    # ajustado para recibir formId por entidad
  consentConfig.ts            # se conserva IDs especiales; migra a config/
```

Se reutilizan sin cambios: `SignaturePad`, `MissingFieldsModal`, `SuccessModal`,
la entrada desde `Consientify.tsx` y el flujo de email.

## Modelo de datos

### Tipos compartidos (`entityConfig.ts`)

```ts
type ConsentFieldType = "text" | "email" | "tel" | "date" | "select" | "number";

type ConsentField = {
  id: string;
  label: string;
  type: ConsentFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  half?: boolean;
};

type ThirdLabel = "No aplica" | "No está seguro";

type TriStateQuestion = {
  id: string;
  text: string;
  thirdLabel: ThirdLabel;
  note?: { id: string; label: string };  // campo "indique" opcional
  required?: boolean;                     // por defecto false
};

type ConditionsGroup = {
  id: string;                 // se guarda como lista "A; B; C"
  label: string;
  options: string[];          // Asma/Epoc, Diabetes, ...
};

type VaccineTableColumn = { id: string; label: string };

type EntityConfig = {
  meta: {
    key: "soul" | "sai";
    formId: string;           // consent-vaccination-soul | -sai
    entidadNombre: string;    // "Soulmedical Ltda" | "Servicios y Asesorías en Infectología SAI"
    displayName: string;      // "SOUL" | "SAI" (para el dropdown y encabezado)
    codigo: string;           // SV-FT-B01 | SV-FT-01
    version: string;          // 01 | 02
  };
  datosGenerales: ConsentField[];
  seccionA: {
    tetanosAnios?: ConsentField;     // solo SOUL
    condiciones: ConditionsGroup;
    antineumococica: TriStateQuestion;
    antineumococicaFecha: ConsentField;  // "¿cuándo?"
    herpesZoster: TriStateQuestion;
  };
  seccionB: TriStateQuestion[];        // preguntas 1-6
  virusVivos: TriStateQuestion[];      // preguntas 7-13
  seccionC: { columns: VaccineTableColumn[] };
  efectosAdversos?: string;            // solo SAI (texto informativo)
  legalText: string;
  habeasData: string;
  firmas: {
    firmaPaciente: { id: string; label: string };      // "firma"
    firmaResponsable: { id: string; label: string };   // "firmaResponsable"
  };
};
```

### Diferencias SOUL vs SAI a codificar

- **SOUL**: Sección A tiene 3 ítems (tétanos años + condiciones/antineumocócica +
  herpes zoster). Tercera columna "No está seguro" en todo. Sin bloque de efectos
  adversos. Entidad legal "SOULMEDICAL LTDA". Secciones D (consentimiento) + E
  (habeas data).
- **SAI**: Sección A tiene 2 ítems (sin pregunta de tétanos). Tercera columna
  "No aplica" en Sección A y virus vivos; "No está seguro" en preguntas 1-6.
  Incluye bloque "Posibles efectos adversos esperados". Entidad legal "SERVICIOS
  Y ASESORÍAS EN INFECTOLOGÍA SAI". Secciones D (efectos) + consentimiento +
  F (habeas data con dirección/teléfono).

### Persistencia legible (para export Power BI)

- Cada `TriStateQuestion` → un widget cuyo valor es `"Sí"` / `"No"` /
  `"No aplica"` / `"No está seguro"`. El "indique" es su propio widget de texto.
- `ConditionsGroup` → un widget de texto con las opciones marcadas unidas por
  `"; "`.
- `VaccineTable` → un widget de texto con las filas serializadas en JSON legible,
  label "Datos de vacunas (Sección C)".

## Envío, validación y persistencia

- **Estado:** local en `VaccinationConsentForm` (`values`, ambas firmas,
  aceptación, entidad seleccionada). Cambiar de entidad resetea el formulario;
  si ya hay datos escritos se pide confirmación (`ConfirmModal` existente) para
  no perder trabajo.
- **Validación:** se recorre el config activo. Obligatorios: campos generales
  con `required`, ambas firmas y el checkbox de aceptación. Las preguntas del
  cuestionario no son obligatorias salvo que el config lo indique. Faltantes →
  `MissingFieldsModal`.
- **Envío** (`useVaccinationConsent`): se aplana el estado a
  `Record<string, string>` (tri-state → valor legible, condiciones → lista,
  tabla → JSON) y se envía contra `config.meta.formId`. Ambas firmas van como
  widgets `signature` y el backend las baja a GridFS igual que hoy. Éxito →
  `SuccessModal`.

## Backend

`backend/src/consents/consents.seeder.ts` pasa de sembrar 1 formulario a
sembrar 2 (`consent-vaccination-soul`, `consent-vaccination-sai`) en un bucle,
cada uno con su array completo de widgets. Los IDs de widget son el espejo
exacto de los configs del frontend. Correo de clínica sin cambios.

Widgets por formulario: datos generales + cada pregunta del cuestionario (con
label legible) + notas "indique" + condiciones + tabla de vacunas +
`aceptaConsentimiento` (checkbox) + `firma` (signature) + `firmaResponsable`
(signature).

## Fuera de alcance / sin cambios

- `SignaturePad`, `MissingFieldsModal`, `SuccessModal`.
- Ruta y entrada desde `Consientify.tsx` (sigue abriendo Consentimientos).
- Flujo de email y correo de clínica.
- Logos/imágenes (solo texto por ahora).

## Criterios de éxito

1. Al abrir Consentimientos, un dropdown permite elegir SOUL o SAI.
2. Cada entidad muestra sus secciones fieles al PDF (A, B, virus vivos, C,
   legal, habeas data; SAI además efectos adversos).
3. Cambiar de entidad intercambia contenido; con datos escritos pide confirmar.
4. Se puede diligenciar todo, firmar (paciente + responsable) y enviar.
5. El envío persiste contra el formulario sembrado de la entidad y ambas firmas
   se guardan en GridFS.
6. Los envíos exportan a Power BI con labels legibles y separados por entidad.
