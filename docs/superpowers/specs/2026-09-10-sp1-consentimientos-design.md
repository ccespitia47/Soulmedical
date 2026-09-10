# SP1 · Módulo Consentimientos (Consentify → SoulForms)

**Fecha:** 2026-09-10
**Estado:** Diseño aprobado (pendiente revisión del spec por el usuario)
**Proyecto padre:** Portar la app Consentify (PHP) al apartado "Consientify" de SoulForms, modernizada.

---

## 1. Contexto

Consentify es una app PHP/MySQL (CentOS) de gestión de consentimientos informados en salud.
Se va a reconstruir dentro de SoulForms (React + NestJS + TypeScript), en el apartado
"Consientify" que **ya existe** y donde ya funciona un consentimiento (Vacunación,
multi-entidad SAI/SOUL).

El trabajo total se descompuso en sub-proyectos (SP0..SP6). Este spec cubre **solo SP1:
el módulo de Consentimientos** — el núcleo. Los demás (kardex, finanzas, turnos, reportes
globales, RBAC granular) tienen su propio ciclo spec→plan→implementación.

## 2. Objetivo de SP1

Que el apartado Consientify permita **crear, firmar, guardar, descargar en PDF y enviar por
correo** los **6 tipos de consentimiento**, más **listar/buscar, ver y editar** registros,
con una interfaz moderna (estilo Vercel: minimalista, responsive, mobile-first, dark mode),
conservando el consentimiento de Vacunación que ya existe.

Los 6 tipos:
1. Vacunación (conservado; multi-entidad SAI/SOUL)
2. Vacunación-B
3. Tuberculina
4. Venopunción
5. VIH
6. Infectología (incluye captura de **foto**)

## 3. Decisiones tomadas (log)

| Tema | Decisión |
|------|----------|
| Lenguaje | TypeScript en todo: React 19 (front) + NestJS 11 (back). Sin PHP. |
| Arquitectura de formularios | **Motor config-driven** (Enfoque A): una definición por tipo, un renderer y un generador de PDF genéricos. |
| Fidelidad | Modernizar y depurar: se conserva todo el contenido clínico/legal, pero se reorganiza UX y se pueden fusionar campos redundantes (con validación clínica/legal posterior del usuario). |
| Multi-entidad (SAI/SOUL) | Solo Vacunación. El motor soporta variantes; los otros 5 son únicos con campo `ciudad`. |
| Almacenamiento | **Esquema dedicado de Consentify** como colección propia de MongoDB `consent_records` (Mongoose), aislada del `form_submissions` genérico, en la misma base del dominio. Binarios (firmas/fotos) en GridFS (`gridfs:<id>`). *(Revisado 2026-09-10: originalmente PostgreSQL; el dominio forms/submissions vive en Mongo, así que el esquema dedicado va en Mongo para encajar con el código y reutilizar los servicios de records/pdf.)* |
| Vacunación existente | **Migrar** sus submissions (+ firmas en GridFS) al esquema dedicado mediante migración única, reversible y verificada. |
| Permisos | En SP1 el gate es "estar logueado en Consientify". El RBAC granular (roles, ciudades, secciones, kardex, finanzas) es SP0; se dejan puntos de enganche. |
| Auditoría / turnos | El log de auditoría de Consentify se mapea a `admin-audit` de SoulForms. La creación de turno al guardar queda para SP4 (hook preparado, desactivado). |

## 4. Stack confirmado

- **Frontend:** React 19, TypeScript estricto, Vite 7, Tailwind 4, Zustand 5, React Router 7.
  Reglas del proyecto: Atomic Design, hooks reutilizables, componentes pequeños, evitar
  archivos gigantes, mobile-first, dark mode.
- **Backend:** NestJS 11, TypeORM 0.3 sobre **PostgreSQL** (`soulformsdb`), Mongoose 9 sobre
  **MongoDB** con **GridFS** para binarios.

## 5. Arquitectura del motor config-driven

Generaliza el patrón actual de Vacunación en piezas reutilizables (front):

- **`ConsentDefinition`** — evolución de `EntityConfig`. Describe cualquier consentimiento:
  metadatos (tipo, entidad opcional, código, versión, logo, textos) + **secciones ordenadas**,
  cada una con **campos tipados**:
  - `text` | `email` | `tel` | `date` | `number` | `select`
  - `checkbox-group` (condiciones; se guarda como lista)
  - `tri-state` (pregunta numerada Sí / No / tercera opción, con "indique" opcional)
  - `table` (p. ej. tabla de vacunas)
  - `photo` (captura/carga, usada por Infectología)
  - `legal-text` y `habeas-data` (bloques verbatim)
  - `signature` (paciente / responsable)
  Cada campo tiene `id` estable.
- **`ConsentRenderer`** — un solo componente que recorre la definición y pinta cada campo con
  **primitivas pequeñas**: se reutilizan `TriStateQuestion`, `CheckboxGroupField`,
  `VaccineTable`, `SignaturePad`; se añaden `PhotoField` y `LegalBlock`. Una primitiva por
  tipo de campo (nada de archivos gigantes).
- **`useConsentSubmission(definition)`** — generaliza `useVaccinationConsent`: aplana estado,
  valida (`collectMissing` genérico), **envía a la API dedicada de consentimientos**, genera el
  PDF y dispara el correo (clínica + paciente) con el servicio de email existente.
- **`buildConsentPdf(definition, data)`** — generaliza `vaccinationConsentPdf` recorriendo la
  definición para producir el HTML → PDF.
- **Definición por tipo** — cada consentimiento es un archivo de definición (+ variantes de
  entidad solo en Vacunación). Añadir un tipo = escribir una definición.

Vacunación se reexpresa como `ConsentDefinition` sobre el motor **sin cambiar su
comportamiento**, protegido por tests de caracterización.

## 6. Modelo de datos (esquema dedicado)

**MongoDB, vía Mongoose.** Colección propia `consent_records` (aislada del
`form_submissions` genérico). Schema tipado (mismo estilo que `form-submission.schema.ts`):

`consent_records`
- `_id` (string uuid, `crypto.randomUUID()`)
- `tipo` (enum string: vacunacion | vacunacion_b | tuberculina | venopuncion | vih | infectologia), indexado
- `entidad` (enum SAI | SOUL, null; solo Vacunación)
- Identidad del paciente: `tipoDoc`, `numDoc` (indexado), `nombres`, `apellidos`
- `ciudad`, `profesional`
- `estado` (enum: borrador | firmado | anulado)
- `respuestas` (**Object/JSON**, `Record<string, unknown>`): campos clínicos variables por
  tipo (validados contra la definición). Equivalente al `data` de las submissions.
- Binarios como referencia `gridfs:<id>`: `firmaPaciente`, `firmaResponsable`, `foto` (null)
- `hashVerificacion` (sha-256 del contenido canónico del registro; permite verificar el PDF)
- `createdById` (number, id de usuario), `createdAt` (indexado), `updatedAt`, `pdfGeneradoEn`

Índices: `tipo`, `numDoc`, `createdAt: -1`, e índice compuesto `{ tipo: 1, createdAt: -1 }`.
Los binarios siguen en **GridFS**; el registro guarda su referencia `gridfs:<id>` (mismo
convenio que las submissions actuales). No hay migración de esquema TypeORM: al ser Mongo,
la colección se crea sola; sí hay un **script de backfill** para migrar Vacunación (Sección 8).

## 7. API backend (NestJS, módulo `consents`)

Nuevo recurso `ConsentRecord` (entity + controller + service):
- `POST   /consents` — crear registro (valida contra la definición del tipo; persiste; devuelve id + hash)
- `GET    /consents` — listar/buscar con filtros (tipo, num_doc, nombre, ciudad, rango de fechas), paginado
- `GET    /consents/:id` — obtener uno (para ver/editar)
- `PATCH  /consents/:id` — editar
- `POST   /consents/:id/anular` — anular (soft, cambia estado; no borra)
- `GET    /consents/:id/pdf` — regenerar/descargar PDF desde el registro + binarios
- `GET    /consents/:id/verificar` — comprobar `hash_verificacion`

La validación de `respuestas` usa las definiciones (fuente de verdad compartida front/back;
se ubican en un paquete/carpeta compartida para evitar drift, o se replican con un test
anti-drift que las compara).

## 8. Migración de Vacunación existente

Migración única (script verificable, reversible):
1. Leer submissions del/los form(s) de Vacunación (SAI/SOUL) + sus firmas en GridFS.
2. Mapear cada submission a `consent_records` (tipo=vacunacion, entidad correspondiente,
   identidad, `respuestas` desde el flat actual, ids de firma).
3. Verificar conteos y una muestra de PDFs regenerados vs. los actuales.
4. Dejar las submissions originales intactas hasta confirmar (rollback = borrar los
   `consent_records` migrados).

## 9. Flujos secundarios (vista de registros)

Una sola vista moderna reutilizable para los 6 tipos:
- Tabla con búsqueda (documento/nombre/fecha), filtro por tipo y por fecha, paginada.
- Acciones por registro: **ver**, **descargar PDF**, **editar** (reabre el `ConsentRenderer`
  con los datos), **reenviar correo**, **anular**.

## 10. Navegación / UX

`Consientify` (landing) → tile **Consentimientos** → **selector de tipo** (6 tarjetas) →
**formulario** del tipo. Pasos claros dentro del formulario (datos → cuestionario → legal →
firma). Estado de envío/correo con el `SuccessModal` existente. Estilo Vercel: sidebar/heading
limpio, minimalista, responsive, mobile-first, dark mode. Los tiles "Firmas digitales" y
"Reportes" permanecen como "Próximamente" hasta sus SP.

## 11. Manejo de errores

- Envío: si el API falla, no se pierde el consentimiento (estado local / reintento); se informa.
- Validación: campos requeridos + aceptación + firmas obligatorias antes de enviar; se listan faltantes.
- Correo no bloqueante: el registro queda guardado aunque falle el email; el `SuccessModal`
  muestra estado/errores de correo.
- Firma/foto/PDF: errores de captura o de generación se muestran sin tumbar el formulario.

## 12. Pruebas (TDD)

- Motor: validación de la definición, `flatten`, `collectMissing` por tipo de campo.
- Anti-drift: test que verifica que cada `id` de cada definición existe/coincide con el esquema
  esperado (definición ↔ validación backend).
- Refactor seguro: caracterización de Vacunación (salida PDF y payload actuales) **antes** de moverla al motor.
- Migración: test que verifica mapeo submission → `consent_records` con datos de muestra.
- PDF: test de estructura/snapshot por definición.
- Backend: e2e de los endpoints (crear/listar/obtener/editar/pdf/verificar).
- Componentes: primitivas nuevas (`PhotoField`, `LegalBlock`) y el `ConsentRenderer`.

## 13. Orden interno de implementación (para el plan)

1. Schema Mongoose `consent_records` + módulo/wiring + DTOs (class-validator).
2. API backend (crear/listar/obtener/editar/pdf/verificar) + validación por definición + tests e2e.
3. Motor front: `ConsentDefinition` + flatten/validate + tests.
4. `ConsentRenderer` + primitivas (reusar + `PhotoField`/`LegalBlock`).
5. `buildConsentPdf` genérico + `useConsentSubmission` apuntando a la API.
6. Refactor de Vacunación al motor (protegido por tests) + migración de sus datos.
7. Vista de registros unificada (listar/buscar/ver/editar/pdf/reenviar/anular).
8. Definiciones tipo por tipo: **VIH** e **Infectología** (simples, validan foto), luego
   **Tuberculina** y **Venopunción** (más campos), y **Vacunación-B**.
9. Navegación/selector y pulido de UX (estilo Vercel, dark mode, mobile-first).

## 14. Fuera de alcance (otros SP)

Kardex (SP2), Finanzas (SP3), Turnos/Herramientas (SP4), Reportes/exportaciones globales (SP5),
Administración de usuarios y RBAC granular (SP0/SP6). En SP1 se dejan solo los puntos de
enganche necesarios (permisos, turno-al-guardar) sin implementarlos.
