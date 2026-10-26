# Rediseño visual de la UI — Sesión 2026-08

Registro de la sesión de rediseño de la apariencia visual de Soulmedical / SoulForms.
**Regla transversal de toda la sesión:** solo cambios de **diseño visual**. No se tocó lógica, rutas, componentes (contratos/props), datos ni funcionalidad. Todos los cambios pasaron `tsc --noEmit` (exit 0) y se recompilaron/desplegaron.

---

## 1. Cómo se sirve y se despliega el frontend (clave)

El sitio **no** corre con `vite dev` en producción. Caddy (`C:\caddy\Caddyfile`, sitio `soulforms.com.co`):

- `/api/*` → `reverse_proxy localhost:3001` (backend)
- todo lo demás → `reverse_proxy localhost:5173`, donde un **servidor estático sirve el build `dist/`** (assets con hash, `index.html` con `Cache-Control: no-store`).

**Implicación:** editar el código fuente NO cambia nada hasta **recompilar**:

1. `npm run build` (regenera `dist/` con nuevos hashes).
2. El servidor estático sirve el `dist/` en vivo (sin reinicio).
3. El usuario hace **hard-refresh** (`Ctrl+Shift+R`).

Verificar despliegue: `curl -s http://localhost:5173/index.html | grep -oE 'assets/index-[A-Za-z0-9._-]+\.js'` debe coincidir con el hash en `dist/index.html`.

> Relacionado: backend por Tarea Programada SYSTEM en :3001.

---

## 2. Sistema de diseño (la "línea" que se repitió)

- **Paleta corporativa (logo Grupo Soul):** teal `#16A6C0`, magenta `#A62E8A`, dorado `#F3B01C`, verde oliva `#8FAE3A`.
- **Teal de marca del app:** `#00c2a8` (usado en ~94 archivos: builder, formularios, widgets, consentimientos…). **Decisión del usuario:** conservarlo como base y solo enriquecer con la paleta del logo donde aplique (no rebrand global).
- **Degradado corporativo (auth / SoulForms):** `linear-gradient(135deg, #1CB4CE 0%, #127E96 100%)`.
- **Degradado teal del app (admin):** `linear-gradient(135deg, #00c2a8 0%, #0891b2 100%)`.
- **Tarjetas tipo SaaS:** fondo blanco con transparencia (`bg-white/70`–`/80`), glassmorphism sutil (`backdrop-blur-xl/sm`), **bordes 20px** (`rounded-[20px]`), `ring` fino, sombra suave que se **eleva en hover** (`hover:-translate-y-0.5` + escala ligera + sombra dinámica).
- **Botones:** degradado, esquinas redondeadas, hover con elevación + sombra dinámica, transición `duration-200 ease-out`, spinner en loading.
- **Tipografía:** título principal grande (`text-2xl/3xl font-extrabold tracking-tight`), subtítulo discreto (`text-slate-400/500`), buen contraste.
- **Animaciones:** aparición suave al cargar con `animate-fade-up` (stagger vía `animationDelay`), hover en tarjetas, escalado muy ligero, sombras dinámicas.

### Utilidad de animación
`src/index.css` — keyframe `fade-up` + utilidad `animate-fade-up` (ease-out exponencial). Se ajustó a `fill-mode: backwards` para **no dejar `transform` residual** (evita crear stacking contexts que tapaban menús).

---

## 3. Sistema de iconos SVG

### `src/components/common/Icon.tsx`
Sistema de iconos SVG por nombre (stroke `currentColor`, grosor 1.75). Se **ampliaron** los iconos a lo largo de la sesión:

- Base ya existente: search, plus, more, caretDown, edit, trash, copy, users, settings, clock, star, pin, grid, list, x.
- Añadidos: clipboard, checkCircle, send, logout, smartphone, templates, chart, eye, folder, building, chevronRight, sun, moon, moonStars, inbox, link, wallet, health, package, target, fileText, user, mail, lock, eyeOff, alert, tag, power.
- Helper exportado `hasIcon(name)`.

### `src/components/common/EntityIcon.tsx` (nuevo)
Resuelve el icono guardado de **proyectos/carpetas/plantillas** (retrocompatible):
- emoji antiguo → nombre SVG equivalente (mapa `LEGACY_EMOJI`),
- clave nueva → se usa tal cual,
- fallback `folder`.

---

## 4. Cambios por superficie

### 4.1 Fondo compartido de autenticación — `src/components/auth/AuthLayout.tsx`
- Nueva variante `variant="light"` (retrocompatible; `photo` sigue para pantallas no migradas).
- Fondo claro: degradado + **malla de color en las 4 esquinas** con los colores del logo + halo blanco detrás del contenido.
- `LogoBackdrop`: los **4 símbolos del logo** dibujados como línea, en sus colores, baja opacidad, repartidos alrededor del contenido:
  - **Engranaje + bombilla + cruz** (dorado)
  - **Estrella / hexagrama** (verde oliva)
  - **Molécula / célula** (teal, círculo central + 8 satélites + puntos)
  - **Dos manos sosteniendo un corazón** (magenta)
  - Repeticiones pequeñas (mini estrella, mini molécula) + puntitos de acento.
- Última iteración: los 4 motivos se **redibujaron fieles** a las imágenes reales del logo.

### 4.2 Login — `src/pages/Login.tsx`
- Fondo claro (variante light) con motivos del logo.
- Logo Grupo Soul a color, título grande, subtítulo discreto.
- Tarjetas de app (SoulForms / Consientify) glass 20px, hover con elevación + escala + sombra dinámica, `fade-up` escalonado.
- Iconos SVG por app (`src/components/auth/AppIcon.tsx`, nuevo): SoulForms → clipboard con pulso; Consientify → escudo con check.
- Colores por app derivados del logo (teal / magenta). Responsive (apila en móvil).

### 4.3 Modal de Login / 2FA — `src/components/auth/LoginModal.tsx`
- Iconos SVG de campos (correo, candado, ojo/ojo-tachado, alerta) reemplazando emoji.

### 4.4 Register — `src/pages/Register.tsx`
- Envuelto en `AuthLayout variant="light"`; tarjeta glass 20px; tile de cabecera con icono clipboard; campos con iconos SVG (user, mail, lock, eye/eyeOff); botón con degradado corporativo + hover; estados éxito/error con check/alerta; animaciones.

### 4.5 ResetPassword — `src/pages/ResetPassword.tsx`
- Misma línea: fondo del login, tarjeta glass, tile con candado, campos con iconos SVG, botón degradado corporativo, animaciones.

### 4.6 ForgotPassword — `src/pages/ForgotPassword.tsx`
- Misma línea: tile con icono de correo, campo con icono SVG, botón degradado corporativo, animaciones.

### 4.7 Home / Panel admin (`/admin`)
- **`src/components/admin/AdminSidebar.tsx`**: nav con iconos SVG (clipboard, templates, users, eye, chart, smartphone, logout); activo con realce teal.
- **`src/components/home/HomeSidebar.tsx`**: iconos SVG (search, pin, sun/moon/moonStars); acentos del logo — **Favoritos en dorado**, tile del workspace "S" con **degradado teal→magenta**; teal de marca conservado.
- **`src/components/home/ProjectRow.tsx`**: iconos de proyecto/carpeta vía `EntityIcon`; se eliminó el **borde lateral grueso** (side-tab) y se reemplazó por **fondo tintado** con el color del proyecto/carpeta.
- **`src/components/home/FormsView.tsx`**: tarjetas de formulario glass/rounded con hover elevado + escala + sombra dinámica + `fade-up`; botones con degradado; iconos SVG (clipboard, inbox); estados vacíos modernos.

### 4.8 App de usuario (`/userapp`)
- **`src/pages/UserAppPage.tsx`**: sidebar oscuro modernizado (activo con degradado teal, iconos SVG), tarjetas/filas con hover + `fade-up`, botones con degradado, tipografía jerarquizada, estados vacíos con icono en tile; icono de carpeta vía `EntityIcon`; select de proyecto sin emoji (los `<option>` nativos no renderizan SVG).
- Listas modernizadas: `MyTasksList.tsx`, `MyDraftsList.tsx`, `MySubmissionsList.tsx` (emoji→SVG, botones con degradado+elevación, tarjetas con hover/animación).

### 4.9 Gestión de Usuarios (`/admin → Usuarios`)
- **`src/pages/UsersPage.tsx`**: tabs con iconos SVG (users/tag), cabecera con jerarquía, botón "Nuevo usuario" con degradado + hover, buscador con icono SVG + foco teal, estado vacío moderno, `fade-up` con stagger.
- **`src/components/users/UserListItem.tsx`**: tarjeta glass 20px con hover elevado + escala + sombra dinámica; avatar con icono SVG teñido por rol; badges de rol y de 2FA (candado); botones de acción con iconos SVG (edit / power / trash); usuario inactivo atenuado.

### 4.10 Catálogo de iconos de proyectos/carpetas (rediseño de datos con retrocompat)
- **`src/types/folder.types.ts`**: `PROJECT_ICONS` y `FOLDER_ICONS` pasan de emoji a **claves SVG** (building, wallet, chart, health, users, settings, package, target; folder, clipboard, users, health, chart, settings, target, fileText).
- **`src/components/common/Pickers.tsx`**: `IconPicker` renderiza SVG (con hover) y resalta el seleccionado (compatible con emoji legado).
- **Render actualizado a `EntityIcon`** en: ProjectRow, FormsView, UserAppPage, AssignmentTree, TemplateCard, TemplateFoldersList, UseTemplateModal. En `<select>` (ReportsPage, UseTemplateModal, UserAppPage) se quitó el icono (solo texto).
- **Retrocompatibilidad:** proyectos/carpetas ya creados (emoji guardado) siguen mostrando su equivalente SVG; los nuevos guardan la clave.
- **No tocado:** iconos de **grupos** (`GROUP_ICONS`, catálogo propio) y los iconos de **widgets/email/consentimientos** (dominios distintos).

### 4.11 Menú de tres puntos — `src/components/common/PopoverMenu.tsx`
- **Bug corregido:** el desplegable quedaba **detrás** de las tarjetas (stacking contexts por `transform` + `overflow-hidden`). Solución: renderizado en **portal a `document.body`** con posición fija; escapa de todos los contextos y del overflow. Estilo modernizado (rounded, sombra, animación) y se añadió el icono `link` que faltaba (Compartir). Cierra por clic-fuera / scroll / resize.

---

## 5. Archivos creados

- `src/components/auth/AppIcon.tsx`
- `src/components/common/EntityIcon.tsx`
- (memoria de proyecto) `frontend-deploy.md`

## 6. Archivos modificados (principales)

- `src/index.css`
- `src/components/common/Icon.tsx`, `Pickers.tsx`, `PopoverMenu.tsx`
- `src/components/auth/AuthLayout.tsx`, `LoginModal.tsx`
- `src/pages/Login.tsx`, `Register.tsx`, `ResetPassword.tsx`, `ForgotPassword.tsx`, `HomePage.tsx`, `UsersPage.tsx`, `ReportsPage.tsx`
- `src/components/admin/AdminSidebar.tsx`
- `src/components/home/HomeSidebar.tsx`, `ProjectRow.tsx`, `FormsView.tsx`
- `src/components/users/UserListItem.tsx`
- `src/pages/UserAppPage.tsx`, `src/components/userapp/MyTasksList.tsx`, `MyDraftsList.tsx`, `MySubmissionsList.tsx`
- `src/components/common/assignmentTree/AssignmentTree.tsx`, `src/components/templates/TemplateCard.tsx`, `TemplateFoldersList.tsx`, `UseTemplateModal.tsx`
- `src/types/folder.types.ts`

---

## 7. Verificación

- `tsc --noEmit -p tsconfig.json` → exit 0 en cada cambio.
- Capturas headless (CDP) en desktop y móvil de las páginas públicas (Login, Register, Reset, Forgot).
- Páginas tras auth (`/admin`, `/userapp`, Usuarios): capturadas inyectando sesión de prueba (JWT de expiración futura) + override de `fetch` a nivel de página para mockear datos (el build apunta la API al dominio real y desloguea sesiones sintéticas).
- Hallazgos del hook de diseño (side-tab) corregidos.

---

## 8. Pendientes / posibles siguientes pasos

- Modal **crear/editar usuario** (`UserFormModal`) y pestaña **Grupos**.
- Secciones admin: **Reportes**, **Plantillas**, **Reporte de acciones (auditoría)**.
- Iconos de **grupos** (si se quieren pasar a SVG).
- Ampliar el catálogo de iconos de proyecto/carpeta con más opciones.
- (Opcional, mayor) Rebrand del teal `#00c2a8` → teal exacto del logo `#16A6C0` en todo el app.
