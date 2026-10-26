# Historial de paciente y esquemas de vacunación en Consientify

Fecha: 2026-10-24
Estado: aprobado para planificar

## Intención y por qué

Hoy cada consentimiento se diligencia desde cero. Un paciente frecuente, o alguien
que vuelve por su segunda dosis, obliga al profesional a reescribir los mismos
datos de identidad que ya firmó la vez anterior. Y para decidir qué dosis le
corresponde, el profesional depende de lo que recuerde el paciente o de buscar a
mano consentimientos viejos.

El número de documento ya identifica unívocamente a la persona en todos los
consentimientos guardados. Este trabajo lo convierte en la llave que trae lo que
ya se sabe de ella: sus datos generales, y —en vacunación— qué vacunas lleva
puestas y cuál le toca.

## Objetivos

1. Al escribir el número de documento en un consentimiento, rellenar solo los
   campos de datos generales a partir del último consentimiento de esa persona.
2. En la Sección C de los consentimientos de vacunación, elegir la vacuna de un
   catálogo y calcular sola la "Fecha próxima vacuna" según el esquema de dosis.
3. Mostrar al profesional, dentro del formulario, qué vacunas tiene ya el
   paciente y cuál está vencida, para que pueda contradecir la sugerencia.
4. Reemplazar el campo libre de ciudad por un desplegable de ciudades de Colombia.

## No objetivos

- **No** hay pantalla aparte de "historial de pacientes". El usuario lo decidió
  explícitamente: todo vive dentro del formulario de consentimiento.
- **No** se crea una entidad "paciente" ni un maestro de pacientes. La fuente es
  la colección `consent_records` que ya existe.
- **No** se copian respuestas del cuestionario de salud entre visitas.
- **No** se integra con ninguna base externa (laboratorio, Excel, otro sistema).
- **No** se añade un permiso nuevo. El acceso al módulo ya restringe a personal
  médico y el usuario consideró eso suficiente.

## Anti-objetivos

Esto fracasa, aunque funcione técnicamente, si:

- Se mezclan datos de dos pacientes distintos sin que nadie lo note. El
  autorrelleno es silencioso por decisión del usuario, así que la trazabilidad y
  el deshacer son la única red.
- La fecha próxima calculada resulta ser clínicamente incorrecta. La tabla de
  esquemas es un dato clínico: si se transcribe mal, el daño es real.
- Se copian respuestas de salud de una visita a otra. La salud cambia entre
  visitas; arrastrarlas sería peligroso.
- El formulario se vuelve más lento de diligenciar que antes.

## Restricciones del terreno

Verificadas sobre el código al escribir este documento:

- `consent_records` (Mongo) ya guarda `tipo`, `entidad`, `tipoDoc`, `numDoc`
  (indexado), `nombres`, `apellidos`, `ciudad`, `profesional`, `estado`,
  `respuestas` (objeto libre), `createdAt`. Los datos generales que no son de
  identidad viven dentro de `respuestas`.
- `consents.controller.ts` ya está bajo `JwtAuthGuard, PermissionsGuard` y expone
  `POST /consents`, `GET /consents` (con `search`), `GET /consents/:id`,
  `PATCH /consents/:id`, `POST /consents/:id/anular`, `GET /consents/:id/verificar`,
  `GET /consents/:id/pdf`.
- `EstadoConsentimiento` incluye anulado; el historial debe excluirlos.
- Las columnas de la Sección C son `nombre`, `dosis`, `lote`, `vencimiento`,
  `proxima`, `fabricante`. Las filas se guardan como JSON en `respuestas.seccionC`.
  **No hay columna de fecha de aplicación.**
- `VaccineTable.tsx` es un componente **no controlado**: mantiene las filas en
  estado interno y se reinicia remontándolo con otra `key`. Añadirle
  comportamiento derivado (dosis y fecha calculadas) obliga a revisar ese
  contrato.
- `ConsentField` ya soporta `type: "select"` con `options`, y `sharedUi.tsx` lo
  renderiza. El desplegable de ciudades no necesita un tipo nuevo.
- **Acoplamiento con el seeder**: `entityConfig.ts` dice que el `id` de cada
  campo debe existir como widget con el mismo id en
  `backend/src/consents/consents.seeder.ts`. Cambiar o añadir ids obliga a tocar
  ambos lados.
- El PDF se genera en el navegador (`buildConsentPdf` + `pdfExporter`). Nada de
  esto cambia el PDF salvo que cambien los valores de los campos.

## Cómo funciona

### 1. Autorrelleno por documento

Decidido por el usuario: **se rellena solo, sin preguntar** (opción A frente a una
tarjeta de confirmación).

Al terminar de escribir el número de documento en cualquiera de los seis tipos de
consentimiento, el formulario consulta el último consentimiento no anulado de esa
persona y rellena los campos de datos generales. Aparece un aviso discreto que
dice de qué consentimiento y qué fecha salieron los datos, con un enlace para
deshacer que devuelve los campos a como estaban.

- Solo se rellenan campos **vacíos**… *decisión del builder*: lo contrario
  (sobrescribir lo ya tecleado) contradice el enlace de deshacer y sorprende al
  profesional a mitad de captura.
- Se rellenan identidad y datos generales: nombres, apellidos, tipo de documento,
  ciudad, fecha de nacimiento, EPS, teléfono, email, RH, dirección, género y
  equivalentes según el tipo. **Nunca** respuestas del cuestionario, firmas ni foto.
- **`fecha` y `profesional` quedan excluidos** — *decisión del builder*. Son la
  fecha de aplicación/firma y quién atiende: traerlos del consentimiento
  anterior metería datos falsos en un documento que se va a firmar, y al ser el
  relleno silencioso nadie lo notaría.
- **No se parten ni se concatenan nombres entre tipos** — *decisión del
  builder*. Vacunación tiene un único campo "Nombre y Apellidos"; los otros
  cuatro tipos tienen `nombres` y `apellidos` separados. Partir "JUAN PÉREZ DE
  LA ROSA" por heurística se equivoca con apellidos compuestos. Se rellena lo
  que encaje por id y el profesional completa el resto.
- Si hay varios consentimientos de la misma cédula, manda **el más reciente**.
- Los anulados no cuentan.
- **La llave es `numDoc` con coincidencia exacta** — *decisión del builder*. El
  `search` que ya existe usa regex parcial, lo que podría traer a otra persona
  con un documento más largo que contenga al tecleado; con relleno silencioso
  eso es el anti-objetivo nº 1. La consulta se dispara con rebote (debounce) y
  longitud mínima, no en cada tecla.
- **La procedencia no se guarda en el registro** — *decisión del builder*.
  `respuestas` entra en el cálculo de `hashVerificacion`, así que añadir ahí un
  campo de procedencia cambiaría el hash de verificación del consentimiento. La
  trazabilidad se resuelve solo con la auditoría de la consulta (ver §5).
- **No hay consentimientos migrados**: verificado contra Mongo al escribir esto
  (1 registro total, 0 con `origenSubmissionId`), así que no hace falta parsear
  Secciones C legadas en texto libre.

### 2. Catálogo de vacunas y cálculo de la próxima fecha

Decidido por el usuario: **la dosis va dentro del nombre** (opción A). El
desplegable lista entradas como `HEPATITIS B D1`, `HEPATITIS B D2`,
`NEUMOCOCO 13 D1`, y las vacunas de dosis única aparecen en la misma lista
marcadas como tales.

Al elegir una entrada, `N° Dosis` se rellena sola y `Fecha próxima vacuna` se
calcula. La fecha calculada **queda editable**.

#### Cómo se cuenta el intervalo

**La columna "Próxima aplicación" se cuenta desde la dosis 1, no desde la dosis
que se está aplicando.** Confirmado por el usuario tras detectarse que las dos
convenciones daban resultados distintos:

- Antirrábica POS (D1→3 días, D2→7, D3→14) son los días 0‑3‑7‑14 del esquema
  Essen contados desde la primera dosis. Leídos como relativos darían día 3, 10
  y 24, que no corresponde a ningún esquema reconocido.
- El intervalo de la fila N es, por tanto, **el desplazamiento desde la dosis 1
  al que ocurre la dosis N+1**.

Consecuencia de diseño, importante: calcular la próxima fecha de una dosis N>1
necesita **la fecha en que se aplicó la dosis 1**, que sale del historial del
paciente. Si no hay registro de la dosis 1, no se puede calcular y el campo
queda vacío para diligenciar a mano. Al aplicar la dosis 1, la fecha base es la
del propio consentimiento.

#### Final de cada esquema

**La última fila de cada vacuna no agenda nada.** Confirmado por el usuario: su
intervalo es informativo y, al aplicar la última dosis que figura en la lista,
`Fecha próxima vacuna` queda vacío. Encaja con la convención anterior: el
intervalo de la última fila apunta a una dosis N+1 que no existe en el catálogo.

Lo mismo vale para las vacunas de dosis única y para las que solo tienen una
fila (Dengue, DPT‑a, Hepatitis A, Herpes Zóster, Meningococo B, Meningococo
AYW 135, Neumococo 23, Varicela, Antirrábica PRE): **ninguna agenda próxima
fecha**. Son 9 de las 20 vacunas del esquema. Queda dicho explícitamente porque
reduce el alcance real del cálculo automático.

El catálogo, confirmado por el usuario contra su hoja de cálculo:

| Vacuna | Dosis | Próxima aplicación |
|---|---|---|
| ANTIRRABICA POS | 1 | 3 días |
| ANTIRRABICA POS | 2 | 7 días |
| ANTIRRABICA POS | 3 | 14 días |
| ANTIRRABICA PRE | 1 | 7 días |
| DENGUE | 1 | 3 meses |
| DPT-a | 1 | 10 años |
| DPT-a + POLIO | 1 | 2 meses |
| DPT-a + POLIO | 2 | 6 meses |
| HEPATITIS A | 1 | 6 meses |
| HEPATITIS A + B | 1 | 1 mes |
| HEPATITIS A + B | 2 | 5 meses |
| HEPATITIS B | 1 | 1 mes |
| HEPATITIS B | 2 | 5 meses |
| HERPES ZOSTER | 1 | 2 meses |
| HEXAVALENTE | 1 | 2 meses |
| HEXAVALENTE | 2 | 4 meses |
| MENINGOCOCO AYW 135 | 1 | 2 meses |
| MENINGOCOCO B | 1 | 2 meses |
| NEUMOCOCO 13 | 1 | 2 meses |
| NEUMOCOCO 13 | 2 | 4 meses |
| NEUMOCOCO 15 | 1 | 2 meses |
| NEUMOCOCO 15 | 2 | 4 meses |
| NEUMOCOCO 23 | 1 | 5 años |
| PENTAVALENTE | 1 | 2 meses |
| PENTAVALENTE | 2 | 4 meses |
| ROTAVIRUS | 1 | 2 meses |
| ROTAVIRUS | 2 | 1 mes |
| TETANO | 1 | 1 mes |
| TETANO | 2 | 5 meses |
| TETANO | 3 | 1 año |
| TETANO | 4 | 1 año |
| VARICELA | 1 | 2 meses |
| VPH | 1 | 2 meses |
| VPH | 2 | 4 meses |

Vacunas de dosis única: Triple Viral, Fiebre Amarilla, Neumococo 13,
Pentavalente, Hexavalente, Meningococo, Fiebre Tifoidea, Influenza.

Nótese que Neumococo 13, Pentavalente, Hexavalente y Meningococo aparecen en
ambas listas. **Es intencional**: el usuario pidió conservar las dos variantes y
distinguirlas en el nombre. En el desplegable conviven `NEUMOCOCO 13 D1`,
`NEUMOCOCO 13 D2` y `NEUMOCOCO 13 · dosis única`.

`ROTAVIRUS` dosis 2 tiene un intervalo (1 mes) menor que el de la dosis 1
(2 meses). Se transcribe tal cual de la hoja del usuario; no se corrige.

El desplegable incluye una opción **"Otra"** que habilita texto libre, para una
vacuna que no esté en la tabla. *Decisión del builder*: sin ella, el catálogo
cerrado impediría registrar algo legítimo y bloquearía al profesional.

**Fecha base del cálculo** — *decisión del builder*: la Sección C no tiene
columna de fecha de aplicación, así que se usa la "Fecha" del consentimiento. Si
está vacía, se usa la fecha de hoy.

### 3. Historial a la vista

Decidido por el usuario: **opción B**, con el historial visible.

Cuando el documento identifica al paciente, encima de la Sección C aparece un
panel plegable con sus vacunas previas, reconstruidas a partir de las filas de
Sección C de sus consentimientos de vacunación no anulados:

| Vacuna | Dosis | Aplicada | Próxima |
|---|---|---|---|

La fila cuya "próxima" ya pasó se destaca (ámbar) como vencida.

**No se preselecciona la vacuna** — *decisión del builder*, y es un cambio
respecto al boceto que el usuario aprobó, donde el desplegable venía con
`HEPATITIS B D2` puesto. Motivo: si el paciente tiene varias vacunas pendientes,
elegir por él cuál se aplica, combinado con un autorrelleno silencioso, es
exactamente el error que nadie notaría (anti-objetivo nº 1). En su lugar: el
profesional elige la vacuna, y **la dosis sí se sugiere** a partir de la mayor
dosis registrada de esa vacuna. El panel de historial queda como la pista
visible de qué está pendiente.

El panel solo aparece en los tipos que tienen Sección C (`vacunacion`,
`vacunacion_b`). El autorrelleno de datos generales, en cambio, aplica a los seis.

#### Alcance por entidad

**El historial y el autorrelleno NO cruzan SOUL y SAI.** Confirmado por el
usuario: el Habeas Data que firma el paciente es por entidad legal, así que un
consentimiento SAI solo trae datos y vacunas firmados ante SAI.

La consulta filtra por igualdad de `entidad`. Los tipos que no son multi-entidad
(VIH, Infectología, Tuberculina, Venopunción) guardan `entidad: null`, así que
forman su propio grupo y no se mezclan con los de vacunación SOUL/SAI.

### 4. Ciudades de Colombia

El campo `ciudad` pasa de `type: "text"` a `type: "select"` con buscador.

**El valor que se guarda y se imprime es "Municipio, Departamento"** — p. ej.
"Medellín, Antioquia". Confirmado por el usuario. Motivo: el DANE tiene
municipios homónimos en departamentos distintos (Albania, Santa Bárbara,
San Juan) y ese texto sale literal en el PDF. Efecto aceptado: los PDFs nuevos
se verán distintos de los ya firmados para el mismo municipio.

*Decisión del builder*: se conserva el valor ya guardado aunque no coincida
exactamente con la lista, para no romper consentimientos antiguos ni su PDF.

### 5. Trazabilidad

El usuario descartó un permiso aparte, pero pidió dejar registro: la consulta por
documento se engancha a la auditoría de acciones que ya existe
(`admin-audit`), registrando quién consultó qué documento y cuándo. Motivo: el
endpoint revela el nombre de una persona a partir de su cédula.

## Pendiente de dato, no de decisión

La lista completa de municipios del DANE (~1.100 con su departamento) **no está
disponible en el repositorio**. Transcribirla de memoria arriesga errores en un
campo que se imprime en un documento legal. El plan debe arrancar con una lista
acotada y verificable (los 32 departamentos y sus capitales más los municipios
de mayor población) y dejar el fichero preparado para sustituirlo por el CSV
oficial del DANE cuando el usuario lo aporte.

## Lo que queda al builder

- Forma exacta del endpoint de consulta por documento (uno nuevo bajo
  `/consents`, o extender el `search` que ya existe), su DTO de respuesta y su
  paginación.
- Dónde vive el catálogo de vacunas (constante del frontend, config de entidad,
  o colección en Mongo) y si el intervalo se modela como `{ cantidad, unidad }` o
  como días.
- Cómo se reconcilia el contrato no controlado de `VaccineTable.tsx` con celdas
  ahora derivadas.
- Si el desplegable de vacunas se modela como un `ConsentFieldType` nuevo o como
  comportamiento propio de la columna `nombre` de la Sección C.
- Qué ids nuevos exige el seeder y cómo se sincronizan ambos lados.
- Estrategia de pruebas, incluida una que fije la tabla de esquemas como dato
  clínico verificable, con casos explícitos para Antirrábica POS (0‑3‑7‑14 desde
  la dosis 1) y para las 9 vacunas que no agendan nada.
