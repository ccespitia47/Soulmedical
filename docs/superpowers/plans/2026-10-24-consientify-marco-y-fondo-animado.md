# Marco de Consientify — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Consientify viva dentro de un marco con riel de iconos permanente, fondo animado de virus y bacterias, y un conmutador de tema que gobierne de verdad los formularios.

**Architecture:** Un componente de marco envuelve las dos vistas y las mantiene **ambas montadas**, alternando visibilidad con CSS según la URL — así el formulario a medio diligenciar sobrevive a un salto a Registros. El fondo es un componente sin estado detrás de todo. El tema reutiliza el `ThemeContext` que ya existe; solo se le añade persistencia y se engancha la variante `dark:` de Tailwind a `data-theme`.

**Tech Stack:** React 19, TypeScript estricto, Tailwind v4, React Router, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-24-consientify-marco-y-fondo-animado-design.md`

## Global Constraints

- Fondo, parámetros exactos de la opción B: **16 formas**, ancho **18–30 px** (bacteria y jeringa: alto = ancho × 0,5), opacidad **0,42**, ciclo **20–34 s** aleatorio, desfase inicial negativo hasta **−20 s**, recorrido `translate(0,0)` → `translate(18px,-26px) rotate(180deg)` → vuelta, `linear infinite`. Paleta `#2dd4bf`, `#38bdf8`, `#a78bfa`, `#34d399`. Prototipo aprobado: `docs/superpowers/specs/assets/2026-10-24-fondo-animado-prototipo.html`.
- El fondo **respeta `prefers-reduced-motion`**: con esa preferencia queda estático.
- El fondo va detrás de todo y **nunca intercepta clics**.
- La variante `dark:` mapea a **`[data-theme="dark"]` y `[data-theme="midnight"]`**, apuntando al **div de `ThemeProvider`** (`ThemeContext.tsx:88`), no a `html`.
- **El estado del formulario se conserva** al cambiar de módulo con el riel: ambos subárboles permanecen montados.
- Las tarjetas y paneles siguen **opacos**; solo los lienzos a pantalla completa pasan a transparentes.
- Color de acento del proyecto: `#00c2a8`.
- El riel solo alterna claro/oscuro; `midnight` sigue siendo elegible desde Home.

## Review Focus

- `prefers-reduced-motion: reduce` activo: el fondo debe quedar quieto, no solo más lento (Task 2).
- Tema `midnight` activo: los formularios deben verse oscuros, no claros sobre fondo casi negro (Task 1).
- Recargar el navegador en Registros: debe volver a Registros, no a Consentimientos (Task 4).
- Saltar a Registros y volver con un consentimiento a medio diligenciar: no se pierde nada (Task 4).
- Un usuario que solo tiene `consientify_access`: debe poder abrir su doble verificación desde el avatar, que es el único sitio que le queda (Task 3).

---

### Task 1: Tema que persiste y variante `dark:` enganchada

**Files:**
- Modify: `src/context/ThemeContext.tsx:83-84`
- Modify: `src/index.css` (junto al bloque de tokens, línea ~51)
- Test: `src/context/ThemeContext.spec.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `useTheme()` sin cambios de firma; el tema elegido sobrevive a recargar. Clave de `localStorage`: `"soulforms-theme"`.

- [ ] **Step 1: Write the failing tests**

```tsx
it("arranca en el tema guardado", () => {
  localStorage.setItem("soulforms-theme", "dark");
  // render de un consumidor de useTheme → theme === "dark"
});
it("guarda el tema al cambiarlo", () => {
  // setTheme("midnight") → localStorage.getItem("soulforms-theme") === "midnight"
});
it("un valor guardado inválido no rompe: cae en light", () => {
  localStorage.setItem("soulforms-theme", "turquesa");
  // theme === "light"
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/context/ThemeContext.spec.tsx`
Expected: FAIL — hoy el estado arranca siempre en `"light"`.

- [ ] **Step 3: Persistir el tema en `ThemeContext.tsx`**

El `useState<Theme>("light")` de la línea 83 pasa a inicializarse desde `localStorage`, validando contra las claves de `THEMES`. `setTheme` escribe. La densidad no cambia en esta tarea.

- [ ] **Step 4: Enganchar la variante `dark:` en `index.css`**

Añadir, antes de los bloques de tokens:

```css
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *, [data-theme="midnight"], [data-theme="midnight"] *));
```

- [ ] **Step 5: Run the tests and verify the variant by hand**

Run: `npx vitest run src/context && npm run build`
Expected: tests PASS, build limpio. Después, con `npm run dev`, recorrer los **15 ficheros que usan `dark:`** en los tres temas y anotar en el informe cualquier combinación ilegible. Es verificación manual a propósito: Tailwind no se aplica en jsdom.

- [ ] **Step 6: Commit**

```bash
git add src/context src/index.css
git commit -m "feat(tema): el tema persiste y la variante dark: obedece a data-theme"
```

---

### Task 2: Fondo animado

**Files:**
- Create: `src/components/consents/shell/ConsientifyBackground.tsx`
- Test: `src/components/consents/shell/ConsientifyBackground.spec.tsx`

**Interfaces:**
- Consumes: `useTheme()` de `src/context/ThemeContext`.
- Produces: `export default function ConsientifyBackground(): JSX.Element` — sin props, se posiciona absoluto y se pinta solo.

Parámetros: los de Global Constraints, literales. Referencia visual y formas SVG (virus, bacteria, jeringa): el prototipo aprobado.

- [ ] **Step 1: Write the failing tests**

```tsx
it("pinta 16 formas", () => {
  render(<ConsientifyBackground />);
  expect(screen.getByTestId("fondo").querySelectorAll("[data-bicho]")).toHaveLength(16);
});
it("no intercepta clics y no lo anuncia el lector de pantalla", () => {
  // el contenedor tiene aria-hidden="true" y pointer-events: none
});
it("con prefers-reduced-motion queda quieto", () => {
  // matchMedia mockeado a matches:true → ninguna forma lleva animationName
});
it("usa la paleta del prototipo", () => {
  // los colores de relleno salen de ["#2dd4bf","#38bdf8","#a78bfa","#34d399"]
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/consents/shell/ConsientifyBackground.spec.tsx`
Expected: FAIL — el componente no existe.

- [ ] **Step 3: Implementar `ConsientifyBackground`**

Las posiciones, tamaños, duraciones y desfases se sortean **una sola vez** por montaje (`useMemo` sin dependencias): si se resortean en cada render, las formas saltan. Cada forma lleva `data-bicho`. El recoloreado por tema sale de `useTheme()`; en claro hay que bajar luminosidad o subir opacidad hasta que el texto siga mandando — el criterio es el anti-objetivo de no estorbar, no la fidelidad a la paleta.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/consents/shell && npx tsc -b --pretty false`
Expected: PASS, sin salida de tsc.

- [ ] **Step 5: Commit**

```bash
git add src/components/consents/shell
git commit -m "feat(consientify): fondo animado de virus y bacterias"
```

---

### Task 3: Riel de iconos

**Files:**
- Create: `src/components/consents/shell/ConsientifyRail.tsx`
- Test: `src/components/consents/shell/ConsientifyRail.spec.tsx`

**Interfaces:**
- Consumes: `Icon` de `src/components/common/Icon` (`name`, `size`); `useTheme()`; `MyTwoFactorButton` de `src/components/auth/MyTwoFactorButton`.
- Produces:
  ```ts
  type Vista = "consentimientos" | "registros";
  type Props = { vista: Vista; onVista: (v: Vista) => void; usuario: { name?: string } | null; onLogout: () => void };
  export default function ConsientifyRail(props: Props): JSX.Element
  ```

Iconos: `clipboard` (Consentimientos), `table` (Registros), `sun`/`moon` (tema). El activo se resalta con `#00c2a8`.

- [ ] **Step 1: Write the failing tests**

```tsx
it("marca como activa la vista en curso", () => { /* aria-current="page" en Registros */ });
it("avisa al cambiar de vista", () => { /* click en Consentimientos → onVista("consentimientos") */ });
it("alterna claro y oscuro", () => { /* click en el conmutador → setTheme recibe "dark" */ });
it("el avatar abre un menú, no cierra sesión de un clic", () => {
  // click en el avatar → onLogout NO se ha llamado; aparece el menú
});
it("desde el menú se cierra sesión", () => { /* click en «Cerrar sesión» → onLogout */ });
it("el menú ofrece la doble verificación", () => {
  // es el único acceso para un usuario solo-Consientify
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/consents/shell/ConsientifyRail.spec.tsx`
Expected: FAIL — el componente no existe.

- [ ] **Step 3: Implementar `ConsientifyRail`**

Riel estrecho, columna, con los dos destinos arriba y el conmutador más el avatar abajo. El avatar abre un menú que contiene el nombre del usuario, `MyTwoFactorButton` y «Cerrar sesión». El conmutador alterna entre `"light"` y `"dark"`; si el tema activo es `"midnight"`, el primer clic lleva a `"light"`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/consents/shell && npx tsc -b --pretty false && npx eslint src/components/consents/shell`
Expected: PASS y sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/components/consents/shell
git commit -m "feat(consientify): riel de iconos con tema, 2FA y cierre de sesión"
```

---

### Task 4: Marco, rutas y estado preservado

**Files:**
- Create: `src/components/consents/shell/ConsientifyShell.tsx`
- Modify: `src/pages/Consientify.tsx`, `src/router/AppRouter.tsx:60`, `src/router/routes/ConsientifyRoute.tsx`
- Test: `src/components/consents/shell/ConsientifyShell.spec.tsx`

**Interfaces:**
- Consumes: `ConsientifyRail` y `ConsientifyBackground` (Tasks 2 y 3).
- Produces: ruta `/consientify/:vista` con `vista` ∈ `consentimientos | registros`; `/consientify` redirige a `/consientify/consentimientos`.

**Lo esencial de esta tarea:** el marco renderiza **las dos vistas siempre montadas** y alterna cuál se ve con una clase (`hidden`), leyendo la vista activa de la URL. No se usa un `<Routes>` que desmonte la inactiva: desmontarla perdería el formulario a medias, que es justo lo que el usuario pidió conservar.

- [ ] **Step 1: Write the failing tests**

```tsx
it("entrar en /consientify lleva a consentimientos", () => { /* … */ });
it("/consientify/registros muestra registros", () => { /* sobrevive a recargar */ });
it("conserva el formulario al ir a registros y volver", () => {
  // elegir un tipo, escribir en un campo, ir a Registros, volver:
  // el formulario sigue abierto y el valor escrito sigue ahí
});
it("mantiene ambas vistas montadas", () => {
  // la inactiva existe en el DOM, oculta
});
it("el fondo y el riel están presentes en las dos vistas", () => { /* … */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/consents/shell/ConsientifyShell.spec.tsx`
Expected: FAIL — el marco no existe.

- [ ] **Step 3: Implementar el marco y cambiar la ruta**

`ConsientifyShell` monta fondo + riel + las dos vistas. La vista activa sale de `useParams`; cambiarla es `navigate`. `AppRouter.tsx:60` pasa a `path="/consientify/:vista?"`. `Consientify.tsx` pierde su estado `view` y su portada, y queda como el punto donde se monta el marco con el `onLogout` que ya recibe.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/consents && npx tsc -b --pretty false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/consents/shell src/pages/Consientify.tsx src/router
git commit -m "feat(consientify): marco con riel permanente y vistas con URL propia"
```

---

### Task 5: Lienzos transparentes y retirada del «← Volver»

**Files:**
- Modify: `src/components/consents/ConsentForm.tsx:161`, `src/pages/ConsentimientosPage.tsx:23`, `src/components/consents/records/ConsentRecordsPage.tsx:112`
- Test: `src/components/consents/shell/ConsientifyShell.fondo.spec.tsx`

**Interfaces:**
- Consumes: el marco de la Task 4.
- Produces: `ConsentimientosPage` y `ConsentRecordsPage` ya no aceptan `onBack`.

- [ ] **Step 1: Write the failing tests**

```tsx
it("las vistas no pintan un lienzo opaco que tape el fondo", () => {
  // ninguna raíz de vista lleva bg-[#f0f4f8] ni dark:bg-slate-950
});
it("ya no hay botón de volver", () => {
  // queryByText("← Volver") es null en las dos vistas
});
it("las tarjetas siguen opacas", () => {
  // cardCls conserva bg-white / dark:bg-slate-900
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/consents/shell/ConsientifyShell.fondo.spec.tsx`
Expected: FAIL.

- [ ] **Step 3: Quitar los lienzos opacos y los `onBack`**

En los tres ficheros, la raíz pierde su color de fondo y conserva el resto del espaciado. `ConsentForm` mantiene su `onBack` interno: es el que vuelve del formulario al selector de tipo, y no es el «← Volver» de Consientify.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run && npx tsc -b --pretty false && npx eslint src`
Expected: PASS salvo el fallo preexistente de `src/services/consentsApi.spec.ts`, ajeno a esta rama.

- [ ] **Step 5: Commit**

```bash
git add src/components/consents src/pages/ConsentimientosPage.tsx
git commit -m "feat(consientify): el fondo se ve a través de las vistas y desaparece el «← Volver»"
```
