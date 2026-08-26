# Bug movil iOS + PWA basico — Design Spec

**Fecha:** 2026-08-18
**Autor:** Claude (SDD) + Sara

## Contexto

Dos pedidos independientes que comparten superficie (misma app frontend Vite + React):

1. **Bug movil iOS**: usuarios en iPhone ven "Ocurrio un problema varias veces en 'https://soulforms.com.co/login'" — mensaje generico de WebKit cuando la pagina crashea repetidamente. Empezo despues de un deploy reciente y no hay diagnostico posible desde la UI actual. Sin ErrorBoundary global la app queda en pantalla blanca y iOS marca como page-failure.

2. **PWA basico**: hacer que la app sea instalable como aplicacion (Add to Home Screen en iOS, Install en Android/Chrome/Edge). Ícono, splash, meta tags. Sin offline en esta iteracion.

## Objetivos

- Que Sara pueda ver QUE esta rompiendo la app en iOS (mensaje real del error) en vez de "Ocurrio un problema".
- Prevenir que un crash de un componente aislado tire el DOM entero.
- Que la app se pueda instalar como icono en el home screen y arranque en modo standalone (sin barra del browser).

## Alcance

**In scope:**
- `ErrorBoundary` global montado en `main.tsx` que atrapa errores de render y muestra fallback UI con boton "Reintentar" + mensaje del error visible.
- Listeners `window.addEventListener('error', ...)` y `unhandledrejection` que loguean a `console.error` + opcional POST a un endpoint del backend (fuera de scope si complica).
- Sourcemaps `hidden` en el build de produccion (`sourcemap: 'hidden'`) para poder debug offline.
- Bajar target de compilacion de `es2018` a `es2016` (mayor compat con iOS Safari 12-15).
- `vite-plugin-pwa` con manifest + icons + meta tags basicos.
- Iconos generados o placeholder desde `soulforms-logo-dark.png` (192×192, 512×512, 180×180 para iOS).
- Meta tags en `index.html`: `apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `theme-color`.

**Out of scope:**
- Service Worker con caching offline (feature pesado, requeriria propia iteracion).
- Sync offline de submissions pendientes.
- Splash screens iOS especificos por tamano de dispositivo (una docena de resoluciones distintas, complejo).
- Analytics de crashes remotos (Sentry, LogRocket, etc.) — solo `console.error` local.

## Item 1 — Diagnostico bug movil iOS

### ErrorBoundary global

**Ubicacion**: nuevo file `src/components/common/GlobalErrorBoundary.tsx`, envolviendo `<App />` en `main.tsx`.

**Comportamiento**:
- Class component con `componentDidCatch(error, errorInfo)` y `getDerivedStateFromError(error)`.
- Estado `{hasError: boolean, error: Error | null}`.
- Al render: si `hasError`, muestra fallback UI. Sino, `{children}`.
- Fallback UI (mobile-first, ~200px min alto):
  - Icono de alerta (svg inline, no depender de Icon component que puede ser el que rompe).
  - Titulo: "Algo salio mal"
  - Mensaje del error (`{error.message}` — visible para Sara/user).
  - Boton "Reintentar" (recarga la pagina con `location.reload()`).
  - Boton "Volver al inicio" (`location.href = '/'`).
  - Toda inline sin dependencia de Tailwind por si el CSS es el que rompio — usar `style={{}}` inline.
- Log a `console.error` con `error.stack + errorInfo.componentStack`.

### Listeners de errores globales

**En `main.tsx`**, antes del `createRoot`:

```ts
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    console.error('[global error]', e.message, e.filename, e.lineno, e.colno, e.error);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[unhandled rejection]', e.reason);
  });
}
```

No dispatch a backend en esta iteracion — solo console local. Sara puede usar Safari devtools remotos.

### Vite target + sourcemaps

**`vite.config.ts`**:
- `build.target: 'es2016'` (baja de `es2018` — Safari iOS 12+ soporta es2016 completamente; algunos iPhones viejos aun corren iOS 12/13).
- `build.sourcemap: 'hidden'` (genera .map pero no los referencia con `//# sourceMappingURL=`, no aumenta bytes visibles ni expone a users normales).
- Mantener `esbuild.drop: ['console', 'debugger']` — pero renombrar los `console.error` del ErrorBoundary a algo que sobreviva la deleccion (o usar `console.error` explicitamente que NO esta en la lista de drop — `drop: ['console', 'debugger']` elimina TODOS los console incluyendo error. **Cambiar a `['console.log', 'debugger']`** para mantener console.error/console.warn).

## Item 2 — PWA basico

### Dependencias

- `vite-plugin-pwa@1.x` (dev dep).

### `vite.config.ts`

```ts
import { VitePWA } from 'vite-plugin-pwa';

plugins: [
  react(),
  tailwindcss(),
  VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'SoulForms',
      short_name: 'SoulForms',
      description: 'Plataforma de formularios digitales de Soul Medical',
      theme_color: '#00c2a8',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      scope: '/',
      icons: [
        { src: '/pwa-icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/pwa-icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    // Sin workbox — no offline por ahora.
    workbox: undefined,
    injectRegister: null,   // No auto-registrar SW (evita cache bugs). El manifest se sirve igual.
  }),
]
```

**Nota**: `injectRegister: null` evita que se registre un Service Worker automaticamente. El plugin sirve el `manifest.webmanifest` desde `/manifest.webmanifest`. Sin SW, la app es "instalable" en Android/desktop pero iOS necesita `apple-touch-icon` y meta tags para el mismo comportamiento (agregados abajo en index.html).

### Iconos

**Assets necesarios** (en `public/`):
- `pwa-icon-192.png` — 192×192.
- `pwa-icon-512.png` — 512×512.
- `pwa-icon-512-maskable.png` — 512×512 con safe-zone (para Android adaptive icons).
- `apple-touch-icon.png` — 180×180 (iOS Home Screen).

**Origen**: partir de `public/soulforms-logo-dark.png`. En esta iteracion, generamos los 4 con `sharp` (via script Node one-shot) o Sara los sube manualmente. Decidir en el plan.

### `index.html` — meta tags nuevos

```html
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="SoulForms" />
<meta name="theme-color" content="#00c2a8" />
```

El `<link rel="manifest">` lo inyecta `vite-plugin-pwa` automaticamente.

### Comportamiento esperado post-deploy

- **Android Chrome/Edge**: banner "Add to Home Screen" aparece automatico al segundo visit (heuristica del browser). Instalado, la app arranca standalone sin barra.
- **iOS Safari**: user debe abrir Compartir → "Add to Home Screen" manualmente (no hay banner auto — Apple restringe). Una vez instalada, arranca standalone con el splash del icono.
- **Desktop Chrome/Edge**: icono de instalar en la barra de direcciones.

## Casos edge

| Caso | Comportamiento |
|---|---|
| ErrorBoundary atrapa un error → user presiona "Reintentar" → mismo error | Ciclo posible. El fallback UI se mantiene tras reload (React monta, error se lanza otra vez, ErrorBoundary atrapa). No hay loop DOM crash — al menos hay mensaje visible. |
| iOS Safari con la app ya crashed pre-fix | Users afectados deben limpiar cache Safari (Settings → Safari → Clear History). Documentar en el commit. |
| Deploy nuevo mientras user tiene la app instalada como PWA | `registerType: 'autoUpdate'` de vite-plugin-pwa no se usa (SW deshabilitado). El HTML base se recarga fresh cada visit (no hay SW cache). Sin problema de version stale. |
| Sourcemaps hidden, curioso los descarga | Los .map estan en el bundle pero sin referencia. Un atacante puede intentar `bundle.js.map` en el URL — accesible. Aceptable para MVP (no hay secretos en el JS). Considerar removerlos de dist en el deploy si es preocupacion. |

## Testing

**Backend**: N/A (frontend only).

**Frontend / manual**:
- Item 1: forzar un error en un componente (throw en un event handler o en render), verificar que ErrorBoundary lo atrapa y muestra el mensaje (no pantalla blanca).
- Item 2:
  - Chrome Desktop → DevTools → Application → Manifest: valida que aparece el manifest con icons y theme.
  - Chrome Android → visitar el sitio 2 veces → banner "Add to Home Screen" debe aparecer.
  - iOS Safari → Compartir → "Add to Home Screen" → verificar icono correcto + arranca standalone.

## Riesgos

- **Cambio de target ES**: bajar a `es2016` puede aumentar el bundle ~5-10% por polyfills implicitos. Aceptable dado 2.4MB actual.
- **`console.log` no drop**: cambio de `['console', 'debugger']` a `['console.log', 'debugger']` deja console.error/warn en prod (visible en devtools remotos). Es lo que queremos para debug, pero verificar que no se logee info sensible en errors — auditoria rapida del codebase.
- **iOS PWA sin SW**: los users pueden ver "sin conexion" en algunos casos donde Android SI cachea. Aceptable — el offline es explicitamente out of scope.
- **Iconos**: si Sara no aprueba el auto-generado desde soulforms-logo-dark.png, tendra que reemplazar los 4 archivos en `public/` manualmente.

## Preguntas resueltas

- Q: Nivel de PWA (basico vs offline vs sync)? → **Basico** (manifest + icons + meta tags).
- Q: Cuando empezo el crash iOS? → **Despues del ultimo deploy** — pero sin diagnostico visible; primero desbloqueamos vision del error via ErrorBoundary.
- Q: Auto-generar iconos o Sara los sube? → **Definir en plan**: intentar `sharp` primero, si falla dejar placeholders + tarea manual para Sara.
