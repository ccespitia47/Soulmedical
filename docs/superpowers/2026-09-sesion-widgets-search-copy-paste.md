# Sesión SoulForms — Sept 3-7, 2026

Bitácora completa de la sesión: 2 SDDs ejecutados, 1 diagnóstico de infra, artefactos generados y decisiones tomadas.

---

## 0. Diagnóstico de infra — `NET::ERR_CERT_AUTHORITY_INVALID`

**Reporte:** Sara no podía entrar a `https://soulforms.com.co` — error de certificado.

**Investigación:**

| Chequeo | Resultado |
|---|---|
| Caddy corriendo (PID 5440) | ✅ Sí |
| DNS público → `201.245.173.244` | ✅ OK |
| Cert Let's Encrypt válido hasta 2026-10-27 | ✅ Renovación ACME cada ~6h sin errores |
| Cert que llegaba al navegador | ❌ `CN=Fortiguard SDNS Blocked Page, O=Fortinet` |

**Causa raíz:** un firewall **FortiGuard (Fortinet)** en la red de Sara intercepta la conexión a `soulforms.com.co` y devuelve una página de bloqueo con cert auto-generado. Nada del servidor tenía problema.

**Solución para el usuario:**
- Probar desde datos móviles → confirma que el sitio funciona fuera de esa red.
- Contactar IT para whitelist `soulforms.com.co` en FortiGate.
- Solicitar recategorización en https://fortiguard.com/webfilter (usualmente etiqueta dominios `.co` nuevos como "Newly Observed Domain / Blocked").

---

## 1. SDD 1 — Ajustes de widgets (Texto / Párrafo / Teléfono / Cédula)

**Fecha spec/plan:** 2026-09-03
**Fecha ejecución:** 2026-09-03 → 2026-09-04
**Spec:** [docs/superpowers/specs/2026-09-03-widget-adjustments-design.md](specs/2026-09-03-widget-adjustments-design.md)
**Plan:** [docs/superpowers/plans/2026-09-03-widget-adjustments.md](plans/2026-09-03-widget-adjustments.md)

### 1.1 Solicitud original de Sara

> Ajustes en widgets:
> - **Texto**: en propiedades (permitir caracteres especiales), que se pueda hacer salto de línea.
> - **Párrafo**: se pueda hacer salto de línea.
> - **Teléfono**: en el prefijo poder colocar manualmente el prefijo, y opción de flecha al lado que abra modal con listado de países y prefijos — como propiedad para habilitar. Validación: si se selecciona Estados Unidos pero van a colocar un número de Colombia, mensaje "número no pertenece al país".
> - **Cédula**: más preciso en la captura de datos (a veces no capta datos completos, solo a medias).
>
> Constraint: "solo revisa estos cambios que te pedí sin desconfigurar algo más".

### 1.2 Decisiones tomadas durante brainstorming

| Widget | Decisión |
|---|---|
| Texto | Nueva prop separada `allowLineBreaks` (independiente de `allowSpecialChars`). Cuando ON, renderiza `<textarea>` en vez de `<input>`. |
| Párrafo | El textarea nativo YA aceptaba Enter — el problema estaba aguas abajo: PDF colapsaba `\n`, Excel también. Fix en `pdf-interpolator.ts` (`\n → <br/>`) y `reports.service.ts` (ExcelJS `wrapText: true` en columnas textarea). |
| Teléfono — alcance países | LATAM + España + USA (~22 países). Colombia primero, resto alfabético. |
| Teléfono — validación | Bloqueante (error rojo + `setCustomValidity` que impide submit). |
| Cédula | Preprocesamiento imagen (grayscale + autolevel + binarización + upscale) + Tesseract PSM 6 + regex por tipo doc (auto/cc/ce/ti/passport) + validación post-OCR marcando campos sospechosos en amarillo. |

### 1.3 Ejecución del SDD

**4 tasks + fix loops + review final:**

| Task | Commit(s) | Notas |
|---|---|---|
| 1 — Texto | `1f612d3` | Clean pass, review approved |
| 2 — Párrafo (PDF+Excel) | `6787f73` | 2 tests nuevos en `pdf-interpolator.spec.ts`; suite completa 101/101 |
| 3 — Teléfono | `e8e779a` + fix `5013bc1` | Review encontró 2 Critical: `inferredMaxLength` off-by-one (Colombia queda inutilizable) + prefill dropped (`useState("")` no leía `config.defaultValue`). Fix: hardcodear `maxLength` por país + `useState` con lazy init. |
| 4 — Cédula | `5fab3c9` | Split helpers a `IdScanner.ocr.ts` (~199 líneas) + component ~252 líneas (bajo el cap <300). Review clean. |

**Final whole-branch review (opus):** `READY TO MERGE`. 4 nuevos findings Minor, todos OK_TO_DEFER. Sin security concerns.

### 1.4 Bug del brief del Task 3 (mi responsabilidad)

Ambos Criticals eran errores en MI plan (transcritos verbatim por el implementer):

**Bug 1 — `inferredMaxLength` off-by-one:**
```
Pattern CO: /^3\d{9}$/ → 10 dígitos totales
Helper extraía `{9}` y devolvía 9
<input maxLength={9}> → usuario no puede escribir el 10º dígito
Colombia (default) inutilizable
```
Afectaba 8/22 países con leading digit fijo.

**Bug 2 — prefill dropped:**
```
ANTES: <input defaultValue={config.defaultValue} />  (uncontrolled)
MI CÓDIGO: const [value, setValue] = useState("")  (controlled, hardcoded "")
Task-prefill (TaskPage.tsx) inyecta valores en config.defaultValue
Resultado: números prefilled desaparecen
```

**Fix:** `useState(() => (widget.config.defaultValue as string) || "")` lazy init.

**Lección:** brief con código verbatim → implementer transcribe → bugs del brief son bugs shipped. Necesito review adversarial más agresivo antes de dispatchar.

### 1.5 Adjudicaciones de Sara

- **Trabajo en `main` directo, no worktree** (patrón previo, ~80 archivos locales sin commitear se dejan intactos).
- **Commit bundling** (Task 2 `reports.service.ts` bundleó ~300 líneas pre-existentes de subform): "dejar como está".
- **Impeccable hook findings** en `tasks.service.ts`: aplicar ignores permanentes vía slash command:
  - `hooks ignore-value side-tab "*" --file "backend/src/tasks/tasks.service.ts"` (border-left callout en emails transaccionales — patrón industrial)
  - `hooks ignore-value overused-font Arial --shared` (Arial es universal en clientes de email)

---

## 2. SDD 2 — Search visible + Copy/Paste widgets

**Fecha spec/plan:** 2026-09-04
**Fecha ejecución:** 2026-09-04 → 2026-09-07
**Spec:** [docs/superpowers/specs/2026-09-04-search-visible-and-widget-copy-paste-design.md](specs/2026-09-04-search-visible-and-widget-copy-paste-design.md)
**Plan:** [docs/superpowers/plans/2026-09-04-search-visible-and-widget-copy-paste.md](plans/2026-09-04-search-visible-and-widget-copy-paste.md)

### 2.1 Solicitud original de Sara

> - **Widget Search**: contenido inicialmente oculto, solo aparece al escribir. Quiero que sea visible para poder verlo y seleccionarlo.
> - **Copy/Paste en el builder**: poder copiar y pegar un widget que ya se haya usado, con las configuraciones (reglas y demás) o sin ellas.

### 2.2 Decisiones tomadas

| Ajuste | Decisión |
|---|---|
| Search — comportamiento al abrir | Cargar primeros **50 registros** automáticamente. Constante `PREVIEW_LIMIT = 50`. |
| Search — sources sin preview | `excel_web` y `sql` no soportan preview (endpoints no tienen contrato para q vacío) — mantienen "sin resultados" hasta que el usuario escriba. |
| Copy/Paste modelo | AMBOS — Duplicar (mismo form, click único) + Copiar/Pegar (entre forms, vía localStorage). |
| Reglas al duplicar/pegar | Menú desplegable con 2 opciones: "solo widget" / "con reglas". |
| Reglas cross-form | Al pegar en otro form, reglas que referencien widgets inexistentes se descartan silenciosamente (toast con contador). |

### 2.3 Ejecución del SDD

| Task | Commit(s) | Notas |
|---|---|---|
| 1 — Search visible (50) | `36fad58` (amended) | ⚠️ Commit inicial `ca12a66` **rompía build** — bundleó cambios locales del backend que importaban `./excel-template` (archivo untracked en git). Sara adjudicó amend con `git add` del archivo faltante. |
| 2 — Copy/Paste widgets | `7016208` + fix `f6e9be5` | Review flag: BuilderLayout=358 líneas (viola <300). Fix: extract `PasteButton.tsx`. Post-fix: BuilderLayout=283, PasteButton=102. |
| Fix wave final | `8922346` | 3 IMPORTANTs del final review: (a) validar `widgetRegistry` al pegar (spec lo pedía), (b) limpiar clipboard en logout (security — datos cross-user en localStorage), (c) `searchFromShare` backend soportar q="" para preview. |

### 2.4 Bugs graves detectados

**Bug 1 — Commit no compilaba en checkout limpio (Task 1):**
```
submissions.service.ts importa `./excel-template`
excel-template.ts está en el working tree de Sara pero UNTRACKED
git add del service → import queda en el commit
excel-template.ts NO entra al commit
Cualquier clone / CI limpio: "Cannot find module './excel-template'"
```
**Fix:** Sara aprobó `git add backend/src/submissions/excel-template.ts && git commit --amend`. Resultado: `ca12a66` → `36fad58`. Ahora compila auto-contenido.

**Bug 2 — Clipboard leaks cross-user (final review):**
```
localStorage.setItem("soulforms-widget-clipboard", ...)
Sin scope por user
Admin A copia widget con SQL endpoint / Google Sheets URL (con key en la URL)
Admin A logout → Admin B login en la misma máquina
Admin B ve botón "Pegar" → hereda credenciales
```
**Fix:** `useAuthStore.clearUser()` ahora hace `localStorage.removeItem("soulforms-widget-clipboard")` antes de limpiar el user.

**Bug 3 — Share link mostraba mensaje engañoso:**
```
Frontend enviaba q="" al backend (path share)
searchFromShare backend: if (!query) return { results: [] }
Modal: "Mostrando primeros 50 — escribe para filtrar" (mentira)
```
**Fix:** `searchFromShare` ahora acepta q vacío y devuelve preview de 50 (con `assertShareFormOpen` gate preservado).

### 2.5 Adjudicaciones de Sara

- **Mismo patrón bundling** (Task 2 `BuilderLayout.tsx` + `BuilderCanvas.tsx` bundlearon redesign UI pre-existente): "dejar como está".
- **PasteButton extract**: aplicar fix (recomendado — mantiene constraint <300 sin refactor grande).
- **3 IMPORTANTs del final review**: aplicar los 3 en fix wave único.

---

## 3. Commits finales en `origin/main`

**Todos pusheados a GitHub.**

### SDD 1 — Widget adjustments
```
1f612d3 feat(widget-text): nueva prop allowLineBreaks (input -> textarea)
6787f73 fix(reports): preservar saltos de linea en textarea (PDF <br/>, Excel wrapText)
e8e779a feat(widget-phone): selector de pais opcional (LATAM+ES+US) con validacion bloqueante
5013bc1 fix(widget-phone): maxLength por pais + init value desde config.defaultValue (prefill)
5fab3c9 feat(widget-cedula): preprocesamiento imagen + PSM 6 + regex por tipo de documento
```

### SDD 2 — Search + Copy/Paste
```
36fad58 feat(widget-search): mostrar 50 registros al abrir modal (preview sin filtro)
7016208 feat(builder): duplicar/copiar/pegar widgets con opcion de traer reglas
f6e9be5 refactor(builder): extraer PasteButton para respetar constraint <300 lineas
8922346 fix(builder+search): validar widgetRegistry en paste + limpiar clipboard en logout + share-link preview q=empty
```

**Estado:** `git rev-list --count origin/main..HEAD` = 0 (todo sincronizado).

---

## 4. Deferred debt (para follow-up)

Items adjudicados como Minor / OK_TO_DEFER en los final reviews. Ninguno bloquea funcionalidad; agrúpalos en una futura pasada de polish si quieres.

**Del SDD 1:**
- `onKeyPress` deprecated en widget Texto (pre-existente).
- Sibling `describe` en `pdf-interpolator.spec.ts` (cosmético, tests pasan).
- Subform inner-fields textarea no obtienen `wrapText` (spec-consistent).
- `\r\n` textarea deja `\r` residual antes de `<br/>` (harmless en HTML).
- Task 3 `useEffect` en Phone.render omite `validate` de deps (lint warning).
- Hidden `_country` input sin `readOnly` (cosmético).
- OCR helpers de Cédula sin unit tests (spec original los pedía).
- Phone.render cambió de `defaultValue` (uncontrolled) a controlled aún en modo legacy — funciona pero es subtle semantic drift.
- `extractPassport` calcula fechaNacimiento 2 veces (dead work).
- Phone `handleChange` + `useEffect[value]` ambos llaman validate (redundante).

**Del SDD 2:**
- `void saveFormRules` fire-and-forget en Duplicate-with-rules y Paste-with-rules (sin catch, toast dice "guardado" aunque falle el save).
- Sin unit tests para `widgetClone.ts` (140 líneas de lógica pura testeable).
- Preview + minChars UX: usuario escribe 1 char (<2), tabla muestra 50 preview pero hint dice "escribe al menos 2" (mensaje incoherente con tabla visible).
- Naming asymmetry: `WidgetActionMenu` usa "Duplicar" / "Copiar" (sin sufijo "solo widget"); `PasteMenu` usa "Pegar (solo widget)". Trivial polish.
- `insertWidget` no regenera id — hoy safe porque cloneWidgetWithNewId corre antes, fragile si futuro caller pasa raw widget.
- Group source: `.slice(0, 50)` sin sort criteria — asume grupos pequeños.
- `PREVIEW_LIMIT = 50` hardcoded en 5 archivos — extraer a const compartida.
- Paste toast `setTimeout(4000)` sin cleanup en unmount (leaked timer, harmless React 18).

---

## 5. Cómo validar los ajustes en el navegador

**Paso 1: Rebuild frontend + reinicio backend**

```powershell
# Frontend
cd C:\proyectos\Soulmedical
npm run build

# Backend (PowerShell COMO ADMINISTRADOR — Tarea Programada SYSTEM)
cd C:\proyectos\Soulmedical\backend\scripts
.\kill-zombies.ps1
.\start-backend.ps1
```

**Paso 2: Hard-refresh (Ctrl+Shift+R)** en `soulforms.com.co`.

**Paso 3: Escenarios E2E**

### Widget Texto
1. Builder → Texto → propiedades → activar "Permitir salto de línea" → publicar.
2. Llenar formulario → el campo se ve como `<textarea>`, Enter hace salto.
3. Desactivar → publicar → vuelve a `<input>` una línea.

### Widget Párrafo
1. Llenar con `"Línea 1\nLínea 2\nLínea 3"`.
2. Descargar PDF → verificar 3 líneas separadas.
3. Descargar Excel → celda muestra 3 líneas con wrap.

### Widget Teléfono
1. Sin activar selector → prefijo `+57` fijo (comportamiento previo).
2. Activar "Permitir al usuario cambiar país" → elegir México default.
3. Llenar: `5551234567` (México válido) → OK; `3001234567` (formato Colombia) → error rojo bloqueante.
4. Click en botón prefijo → modal → buscar "Col" → seleccionar → prefijo cambia → error desaparece.
5. Crear tarea con teléfono prefilleado → abrir link → número aparece pre-cargado (fix del prefill).

### Widget Cédula
1. Widget Cédula → default "Detectar automáticamente" → subir foto → verificar extracción.
2. Cambiar tipo a "Cédula de Ciudadanía Colombia" → probar de nuevo → funciona igual o mejor.
3. Si algún campo sale con formato raro → aparece marcado ⚠️ amarillo.

### Widget Search
1. Abrir modal en formulario con widget Search → **ver 50 registros al instante** (sin escribir).
2. Escribir 2+ caracteres → filtra normal.
3. Borrar el input → vuelve a los 50 primeros.
4. Sources `excel_web` y `sql` mantienen "sin resultados" hasta escribir (deferido explícito).
5. Share link público → abrir modal → también ve preview (fix Task 3 backend).

### Copy/Paste widgets
1. En un widget del canvas → click `⋮` → menú aparece con 4 opciones.
2. **Duplicar** → aparece copia adyacente con `(copia)` en el label.
3. **Duplicar con reglas** → crea copia + clona reglas relacionadas.
4. **Copiar** en form A → cambiar a form B → aparece botón "📋 Pegar" en top-bar.
5. **Pegar con reglas** → toast: `"Widget pegado. N reglas agregadas, M descartadas (referencian widgets que no existen aquí)"`.
6. **Logout** → login como otro user → botón "Pegar" NO aparece (clipboard limpiado — security fix).
7. Intentar pegar un widget de tipo desconocido → toast rojo "No se puede pegar: tipo de widget desconocido".

---

## 6. Artefactos generados durante la sesión

**Committed a git** (persistentes):
- `docs/superpowers/specs/2026-09-03-widget-adjustments-design.md`
- `docs/superpowers/plans/2026-09-03-widget-adjustments.md`
- `docs/superpowers/specs/2026-09-04-search-visible-and-widget-copy-paste-design.md`
- `docs/superpowers/plans/2026-09-04-search-visible-and-widget-copy-paste.md`
- Este archivo: `docs/superpowers/2026-09-sesion-widgets-search-copy-paste.md`

**Workspaces SDD** (limpiados post-merge):
- `.superpowers/sdd/2026-09-03-widget-adjustments/` — briefs, reports, review packages, ledger. Borrado tras merge exitoso.
- `.superpowers/sdd/2026-09-04-search-visible-and-widget-copy-paste/` — igual. Borrado tras merge.

**Config de proyecto actualizada:**
- `.impeccable/config.json` — 2 nuevos ignore-value entries:
  - `side-tab: "*" scoped to backend/src/tasks/tasks.service.ts` (border-left callout industrial)
  - `overused-font: arial` (shared, Arial universal en email)

---

## 7. Lecciones aprendidas

**Sobre el proceso SDD:**
1. **Briefs con código verbatim propagan bugs del brief a producción.** El implementer transcribe fielmente. Los 2 Criticals del Task 3 (maxLength off-by-one + prefill dropped) eran errores de mi brief, no del implementer. → Revisar adversarialmente el código de los briefs antes de dispatchar.
2. **`git add <archivo>` bundlea todo el diff local del archivo.** Cuando el working tree tiene cambios locales pre-existentes, el commit del SDD los arrastra. Patrón visto 3 veces: `reports.service.ts` (SDD 1 Task 2), `submissions.service.ts` (SDD 2 Task 1), `BuilderLayout.tsx/BuilderCanvas.tsx` (SDD 2 Task 2). Sara adjudicó "dejar como está" cada vez.
3. **Un import untracked rompe el build en checkout limpio silenciosamente.** El implementer verifica compilación local (donde el archivo existe en disk) y ve verde. CI/otro dev falla. → Al final del task, verificar `git ls-files` incluye TODOS los imports del archivo commiteado.

**Sobre infra:**
4. El certificado que llega al navegador es evidencia diagnóstica más útil que los logs del servidor. Inspección con `X509Certificate2` de PowerShell resolvió el diagnóstico Fortinet en 5 segundos.

**Sobre YAGNI:**
5. Cuando Sara dice "solo estos cambios, sin desconfigurar algo más", el review debe flag inmediatamente cualquier archivo tocado fuera de la lista del brief. La revisión post-implementación catches esto tarde.
