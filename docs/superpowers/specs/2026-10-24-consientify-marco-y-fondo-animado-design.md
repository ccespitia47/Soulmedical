# Marco de Consientify: panel lateral, fondo animado y tema

Fecha: 2026-10-24
Estado: aprobado para planificar

## Intención y por qué

Consientify se usa a diario para diligenciar y consultar consentimientos. Hoy su
pantalla de entrada es una portada con tres fichas: se elige una, el módulo ocupa
toda la ventana y se vuelve con un "← Volver". Navegar entre Consentimientos y
Registros obliga a pasar por la portada cada vez.

El usuario quiere convertirlo en una aplicación con marco permanente, tomando
como referencia un panel de reportes que ya usa: un riel estrecho de iconos a la
izquierda, siempre visible, y un fondo animado detrás de todo. En su caso el
fondo serían virus y bacterias, acordes al dominio.

## Objetivos

1. Un **riel de iconos** a la izquierda, visible en toda la sección: Consentimientos
   y Registros arriba; abajo, el conmutador de tema y el usuario conectado.
2. El riel **no desaparece al entrar en un formulario**. Sustituye al "← Volver".
3. **Cerrar sesión** desde el usuario del riel.
4. Un **fondo animado** de virus y bacterias, detrás de todo el contenido.
5. El **conmutador de tema** del riel debe afectar de verdad al formulario de
   consentimientos, que hoy no obedece.

## No objetivos

- **No** se rediseñan los formularios ni la vista de registros por dentro. Solo
  cambia el marco que los rodea.
- **No** se crea un sistema de temas: `ThemeContext` ya existe y se reutiliza.
- **No** entra "Firmas digitales" en el riel: hoy es una ficha deshabilitada.
- **No** se tocan las otras secciones de la aplicación (Home, Admin, Builder).

## Anti-objetivos

Esto fracasa, aunque funcione, si:

- **El fondo estorba.** Es una pantalla de trabajo diario: si distrae al leer un
  consentimiento, o cansa al mes, el fondo sobra. El usuario eligió
  deliberadamente la intensidad intermedia sobre la más vistosa por este motivo.
- **El fondo cuesta batería o fluidez.** Se diligencia en portátiles y tabletas.
- **Alguna parte de la interfaz queda ilegible** al cambiar de tema. Conectar el
  conmutador cambia el comportamiento de 15 componentes a la vez (ver abajo).
- Alguien con sensibilidad al movimiento no puede usar la aplicación.

## Lo que ya existe y se reutiliza

Verificado sobre el código:

- `src/context/ThemeContext.tsx` expone `useTheme()` → `{ theme, density, T,
  setTheme, setDensity }` con tres temas: `"light" | "dark" | "midnight"`.
  `ThemeProvider` envuelve toda la aplicación desde `main.tsx`, así que
  Consientify ya está dentro.
- Los colores viven como variables CSS en `src/index.css`, bajo bloques
  `[data-theme="light"|"dark"|"midnight"]`.
- `src/components/home/HomeSidebar.tsx` (289 líneas) es un panel **ancho con
  etiquetas**, con selector de tema y densidad. Sirve de referencia de
  comportamiento, no de código: el riel pedido es estrecho y de iconos.
- `src/components/common/Icon.tsx` ya trae `clipboard`, `table`, `sun`, `moon`,
  `moonStars`, `user` y `users`.
- `src/pages/Consientify.tsx` mantiene el estado `view: "home" | "consentimientos"
  | "registros"` y recibe `onLogout`. `ConsientifyRoute` ya implementa el cierre
  de sesión (`clearSession` + `clearUser` + navegación).

### El hallazgo que condiciona el trabajo

`src/index.css` **no define** `@custom-variant dark`. En Tailwind v4 eso significa
que las clases `dark:` siguen `prefers-color-scheme`, es decir el ajuste del
**sistema operativo**, mientras que el resto de la aplicación se pinta con los
tokens de `data-theme`. Son dos mecanismos distintos conviviendo.

Consecuencia: el conmutador del riel no afectará al formulario hasta que se
enganche la variante `dark:` a `data-theme`. Es una línea de CSS, pero cambia el
comportamiento de los **15 componentes** que usan `dark:`: quien hoy tenga el
sistema en oscuro dejará de ver el formulario oscuro automáticamente y pasará a
depender del botón. El usuario lo sabe y lo acepta.

## Cómo funciona

### 1. El marco

Un componente de marco envuelve las tres vistas de Consientify. A la izquierda,
un riel estrecho de iconos, de arriba abajo:

- **Consentimientos** (`clipboard`) y **Registros** (`table`), con el activo
  resaltado en el color de acento del proyecto (`#00c2a8`).
- Al fondo: el **conmutador de tema** (`sun`/`moon`) y el **avatar del usuario
  conectado**, que es por donde se cierra sesión.

El estado `view` de `Consientify.tsx` pasa a gobernarse desde el riel. Los
`onBack` de `ConsentimientosPage` y `ConsentRecordsPage` desaparecen, y con
ellos el "← Volver".

**La portada desaparece** — *decisión del builder*. Al entrar se cae directo en
Consentimientos. Sin "← Volver" y con el riel siempre visible, la portada no
aporta un camino que el riel no dé.

Pero arrastra dos cosas que el revisor detectó y que no pueden perderse con ella:

- **La doble verificación (2FA).** `Consientify.tsx:77` monta
  `MyTwoFactorButton`, y es **el único sitio** donde un usuario que solo tiene
  `consientify_access` puede gestionar su 2FA: los otros montajes viven en
  `AdminSidebar` y `UserAppPage`, inalcanzables para él. Quitar la portada sin
  más eliminaría una función de seguridad. *Decisión del builder*: el avatar del
  riel abre un menú con el nombre del usuario, la gestión de 2FA y cerrar
  sesión. Eso resuelve además la duda sobre si el avatar debía ser un clic suelto.
- **"Firmas digitales"**, la ficha deshabilitada con su "Próximamente",
  desaparece. Es señalización de una función inexistente, no capacidad perdida.

**El estado del formulario se conserva al cambiar de módulo** — decidido por el
usuario entre tres opciones. Si estás a medio diligenciar un consentimiento,
vas a Registros a consultar algo y vuelves, el formulario sigue como lo dejaste.
Sin diálogos de confirmación y sin pérdida. Implica que el marco mantenga ambos
subárboles montados en vez del `return` condicional de hoy.

**Las dos vistas tienen URL propia** — *decisión del builder*. Hoy `view` es
estado local y `ConsientifyRoute` monta una sola ruta: el botón Atrás del
navegador saca de Consientify y recargar devuelve a la portada. Al quitar el
"← Volver", el riel sería la única navegación. Con rutas anidadas, Atrás y
recargar funcionan y se puede enlazar directo. Retrofitearlo después es caro.

### 2. El fondo animado

Virus, bacterias y jeringas flotando despacio detrás del contenido, en la
intensidad intermedia que el usuario eligió entre tres opciones vistas en
movimiento: formas reconocibles, lentas y discretas, sin competir con el texto.

**El prototipo que el usuario aprobó está en el repositorio**:
`docs/superpowers/specs/assets/2026-10-24-fondo-animado-prototipo.html`. Muestra
las tres intensidades; la elegida es la **B**. Sus parámetros exactos, que son
lo que define "discreto" y por tanto el anti-objetivo de no estorbar:

| Parámetro | Valor |
|---|---|
| Número de formas | 16 |
| Tamaño | 18–30 px de ancho (bacteria y jeringa: alto = ancho × 0,5) |
| Opacidad | 0,42 |
| Duración del ciclo | 20–34 s por forma, aleatoria |
| Desfase inicial | negativo aleatorio hasta −20 s, para que no arranquen a la vez |
| Recorrido | `translate(0,0)` → `translate(18px, −26px) rotate(180deg)` → vuelta, `linear infinite` |
| Paleta | `#2dd4bf`, `#38bdf8`, `#a78bfa`, `#34d399` |
| Formas | virus (círculo con 8 espículas), bacteria (cápsula con flagelo), jeringa |

El prototipo usa esa paleta sobre fondo oscuro. Debe **recolorearse según el
tema** para que se lea igual sobre claro — la referencia que aportó el usuario
hace exactamente eso. Cómo (bajar luminosidad, subir opacidad, o ambas) queda al
builder, con el criterio de que no compita con el texto en ninguno de los dos.

Va detrás de todo, nunca intercepta clics, y **respeta
`prefers-reduced-motion`**: con esa preferencia activa queda estático.

#### Para que el fondo sea visible

Hallazgo del revisor, verificado: **hoy el fondo sería invisible**. Cada vista de
Consientify pinta su propio lienzo opaco a pantalla completa —
`ConsentForm.tsx:161` (`min-h-screen bg-[#f0f4f8] dark:bg-slate-950`),
`ConsentimientosPage.tsx:23`, `ConsentRecordsPage.tsx:112` — así que taparía la
animación por completo.

*Decisión del builder*: esos tres lienzos pasan a ser transparentes y el fondo lo
pone el marco. **Las tarjetas y paneles siguen opacos**: son la superficie sobre
la que se lee el consentimiento y es lo que garantiza la legibilidad. Esto matiza
el no objetivo de "no tocar las vistas por dentro": se cambia su color de fondo,
nada más; ni la maqueta ni los componentes.

### 3. Tema

Se engancha la variante `dark:` de Tailwind a `data-theme` en `index.css`, para
que el conmutador del riel gobierne de verdad el formulario.

Dos precisiones del revisor, ambas verificadas y de obligado cumplimiento:

- La variante debe mapear a **`[data-theme="dark"]` y también a
  `[data-theme="midnight"]`**. El tema es global y `midnight` se puede elegir
  desde `HomeSidebar`; mapear solo `dark` dejaría a un usuario en midnight con
  formularios en claro sobre fondo casi negro — el anti-objetivo de "queda
  ilegible", alcanzable sin tocar el riel siquiera.
- La variante debe apuntar al **div que renderiza `ThemeProvider`**
  (`ThemeContext.tsx:88`), no a `html`: el atributo `data-theme` no está en el
  elemento raíz.

El riel solo alterna claro/oscuro; `midnight` sigue siendo elegible desde Home.

**El tema pasa a recordarse** — *decisión del builder*. Hoy `ThemeContext.tsx:82`
lo guarda en un `useState` que arranca en `"light"`, sin persistencia: el
conmutador se olvidaría en cada recarga, y eso en una pantalla de uso diario se
lee como que está roto. Se persiste en `localStorage`. Toca estado global
compartido, así que el plan debe incluir una comprobación de que Home, Admin y
Builder siguen bien.

### 4. Cerrar sesión

Desde el menú del avatar del riel (ver §1), reutilizando el `onLogout` que
`ConsientifyRoute` ya pasa a `Consientify`. No es un clic suelto: cerrar sesión
pierde el trabajo no guardado, y ahora además el formulario puede quedar abierto
en segundo plano mientras se mira Registros.

## Lo que queda al builder

- Técnica de animación: CSS puro, SVG animado o canvas. El criterio es el
  anti-objetivo de rendimiento, no la elegancia. El prototipo usa CSS + SVG
  inline, que basta para 16 formas, pero no es vinculante.
- Cómo se recolorea el fondo en tema claro para que no compita con el texto.
- Dónde vive el componente de marco y cómo se reparte con `Consientify.tsx` el
  estado de la vista, manteniendo ambos subárboles montados.
- Si el riel se colapsa o se oculta en pantallas estrechas, y cómo.
- Si el fondo se ve también en la vista de registros o solo en el formulario.
- Cómo se verifica que ningún componente queda ilegible tras enganchar `dark:`,
  en los 15 ficheros que usan esas clases y en los tres temas.
