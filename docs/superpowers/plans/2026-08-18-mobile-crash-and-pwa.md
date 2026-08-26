# Bug movil iOS + PWA basico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** (1) Reemplazar la pantalla blanca crash de iOS por un ErrorBoundary global con mensaje visible + listeners de errores + sourcemaps hidden + target ES2016. (2) Hacer la app instalable como PWA basica con manifest + icons + meta tags iOS.

**Architecture:** Frontend-only. `main.tsx` envuelve `<App />` con nuevo `GlobalErrorBoundary`. `vite.config.ts` agrega `VitePWA` plugin. `index.html` gana meta tags iOS. Iconos en `public/` generados o placeholder.

**Tech Stack:** React 19 + Vite 7 + TypeScript estricto + Tailwind. Nueva dev dep: `vite-plugin-pwa@^1`.

## Global Constraints

- **NO tocar backend** — plan es frontend puro.
- **NO usar `git add -A`** — commit explicito por archivo.
- **NO commits con emojis** salvo los ya existentes.
- **Copy espanol** en toda UI nueva.
- **ErrorBoundary fallback sin dependencia de otros components** — usar inline styles y svg inline, para no fallar si el problema es Tailwind/Icon component.
- **`sourcemap: 'hidden'`** — no exponer con `//# sourceMappingURL=`, pero generarlos.
- **`esbuild.drop`**: cambiar `['console', 'debugger']` a `['console.log', 'debugger']` para preservar `console.error`/`console.warn` en prod (necesarios para debug remoto).
- **Backward compat**: cambios en `vite.config.ts` (target, plugin PWA) deben permitir que `npm run build` y `npm run dev` sigan funcionando sin regresion.

---

### Task 1: PWA basico — manifest + plugin + meta tags iOS

**Files:**
- Modify: `package.json` (agregar dev dep `vite-plugin-pwa`)
- Modify: `vite.config.ts` (importar y configurar `VitePWA`)
- Modify: `index.html` (agregar 5 meta tags iOS + apple-touch-icon)
- Create: `public/pwa-icon-192.png`, `pwa-icon-512.png`, `pwa-icon-512-maskable.png`, `apple-touch-icon.png` (o placeholders)

**Interfaces:**
- Consumes: nada backend.
- Produces: app instalable — `/manifest.webmanifest` servido, meta tags iOS presentes, iconos accesibles.

- [ ] **Step 1: Instalar `vite-plugin-pwa`**

```bash
npm install --save-dev vite-plugin-pwa
```

Verificar que `package.json` gana la dep en `devDependencies`.

- [ ] **Step 2: Configurar VitePWA en `vite.config.ts`**

Al top, importar:
```ts
import { VitePWA } from 'vite-plugin-pwa';
```

Y en `plugins`, agregar tras `tailwindcss()`:

```ts
VitePWA({
  registerType: 'autoUpdate',
  injectRegister: null,   // Sin SW por ahora
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
  workbox: undefined,
}),
```

- [ ] **Step 3: Generar los 4 iconos**

**Opcion A** (preferida — automatica): usar `sharp` (dev dep de vite, deberia estar transitivamente) para redimensionar `public/soulforms-logo-dark.png` a 192, 512, 512 (maskable), 180.

Crear un script one-shot `scripts/generate-pwa-icons.mjs`:

```js
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const source = join(publicDir, 'soulforms-logo-dark.png');

const targets = [
  { out: 'pwa-icon-192.png', size: 192, background: '#ffffff' },
  { out: 'pwa-icon-512.png', size: 512, background: '#ffffff' },
  { out: 'pwa-icon-512-maskable.png', size: 512, background: '#00c2a8', padding: 0.15 },
  { out: 'apple-touch-icon.png', size: 180, background: '#ffffff' },
];

for (const t of targets) {
  const inner = t.padding ? Math.round(t.size * (1 - 2 * t.padding)) : t.size;
  await sharp(source)
    .resize(inner, inner, { fit: 'contain', background: t.background })
    .extend({
      top: Math.round((t.size - inner) / 2),
      bottom: Math.round((t.size - inner) / 2),
      left: Math.round((t.size - inner) / 2),
      right: Math.round((t.size - inner) / 2),
      background: t.background,
    })
    .png()
    .toFile(join(publicDir, t.out));
  console.log('generated', t.out);
}
```

Correr: `node scripts/generate-pwa-icons.mjs`. Verificar que los 4 archivos existen en `public/`.

Si `sharp` no esta instalado (`npm ls sharp` retorna nada), **Opcion B**: dejar los 4 archivos como copias renombradas de `soulforms-logo-dark.png` (browsers escalaran, ligero blur) y flag para Sara en concerns.

- [ ] **Step 4: Meta tags iOS en `index.html`**

Dentro del `<head>`, antes del `<title>`:

```html
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="SoulForms" />
<meta name="theme-color" content="#00c2a8" />
```

- [ ] **Step 5: Verificar build**

```bash
npm run build
```

Debe generar `dist/manifest.webmanifest` y los 4 iconos en `dist/`. Verificar tsc clean.

Si sale error de tipos por `VitePWA`, agregar los tipos: `import type { VitePWAOptions } from 'vite-plugin-pwa';` no es necesario, el plugin exporta VitePWA con tipos incluidos.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts index.html public/pwa-icon-192.png public/pwa-icon-512.png public/pwa-icon-512-maskable.png public/apple-touch-icon.png
# Y scripts/generate-pwa-icons.mjs si se creo
git commit -m "feat(pwa): manifest + iconos + meta tags iOS para instalacion como app"
```

---

### Task 2: ErrorBoundary global + listeners + sourcemaps + target ES2016

**Files:**
- Create: `src/components/common/GlobalErrorBoundary.tsx`
- Modify: `src/main.tsx` (envolver `<App />` con `<GlobalErrorBoundary>` + agregar listeners)
- Modify: `vite.config.ts` (target: es2016, sourcemap: hidden, esbuild.drop update)

**Interfaces:**
- Consumes: nada.
- Produces: crash de cualquier componente muestra mensaje visible en vez de pantalla blanca; errores JS globales quedan en console; sourcemaps disponibles para debug offline.

- [ ] **Step 1: Crear `GlobalErrorBoundary.tsx`**

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export default class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[GlobalErrorBoundary]', error, errorInfo.componentStack);
  }

  private handleRetry = (): void => {
    // Reload completo — descarta el estado corrupto de React/stores.
    window.location.reload();
  };

  private handleHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    // Fallback UI con inline styles + svg inline — no depende de Tailwind,
    // Icon component ni ningun otro modulo que pueda ser el que rompio.
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#fef2f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
          Algo salio mal
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px', maxWidth: 480 }}>
          La aplicacion tuvo un error inesperado y no se pudo mostrar la pantalla.
        </p>
        {this.state.error && (
          <pre
            style={{
              fontSize: 12,
              color: '#991b1b',
              background: '#fef2f2',
              padding: 12,
              borderRadius: 8,
              maxWidth: 480,
              overflowX: 'auto',
              margin: '0 0 20px',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.message}
          </pre>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '10px 20px',
              background: '#00c2a8',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
          <button
            onClick={this.handleHome}
            style={{
              padding: '10px 20px',
              background: '#fff',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }
}
```

- [ ] **Step 2: Envolver `<App />` en `main.tsx` + listeners globales**

Editar `src/main.tsx`. Antes de `createRoot`, agregar:

```ts
// Captura errores JS globales y promises rechazadas sin handler. Logea a
// console (visible en Safari devtools remotos) — no dispatch a backend.
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    console.error('[global error]', e.message, e.filename, e.lineno, e.colno, e.error);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[unhandled rejection]', e.reason);
  });
}
```

Importar el ErrorBoundary:
```ts
import GlobalErrorBoundary from './components/common/GlobalErrorBoundary';
```

Y envolver en el JSX del `createRoot`:

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </BrowserRouter>
    </GlobalErrorBoundary>
  </StrictMode>
);
```

**Importante**: `<GlobalErrorBoundary>` va POR FUERA del `<BrowserRouter>` para que si el router mismo rompe, aun se muestre el fallback.

- [ ] **Step 3: Ajustar `vite.config.ts`**

Cambios:
- `build.target: 'es2018'` → `build.target: 'es2016'` (mayor compat iOS Safari <15).
- `build.sourcemap: false` → `build.sourcemap: 'hidden'`.
- `esbuild.drop: ['console', 'debugger']` → `esbuild.drop: ['debugger']` (dropea solo debugger; console queda para que Sara vea errores en Safari devtools remotos en prod). **Nota**: alternativa mas conservadora es `esbuild.pure: ['console.log']` que solo dropea console.log preservando el resto — decidir en implementacion segun ergonomia del vite-plugin actual.

Verificar que los cambios NO rompen el build:
```bash
npm run build
```

Verificar que se generan .map files en `dist/assets/` pero el JS NO contiene `//# sourceMappingURL=` al final.

- [ ] **Step 4: Verificar tsc + build**

```bash
npx tsc --noEmit -p tsconfig.json
npm run build
```

Ambos clean.

- [ ] **Step 5: Test manual del ErrorBoundary**

Editar temporalmente algun componente para lanzar un error (`throw new Error('test crash')` en un useEffect), rebuild y verificar en el browser que aparece el fallback UI (no pantalla blanca). Revertir el throw antes del commit.

- [ ] **Step 6: Commit**

```bash
git add src/components/common/GlobalErrorBoundary.tsx src/main.tsx vite.config.ts
git commit -m "feat(app): ErrorBoundary global + sourcemaps hidden + target ES2016 para iOS Safari"
```

---

## Notas para el ejecutor SDD

- **Orden**: Task 1 → Task 2 (independientes pero por consistencia visual del commit history). Ambas son puramente frontend.
- **Tests**: no requeridos (frontend puro, sin infra de tests unit en el repo). Validacion manual visible en el browser.
- **Model selection**:
  - Task 1: sonnet (integracion vite plugin + iconos + config).
  - Task 2: sonnet (componente + config multi-file).
- **Whole-branch final review** al terminar: opus.
- **E2E manual** al final:
  - PWA: Chrome DevTools → Application → Manifest (valida icons, theme, name). En iPhone: Safari → Compartir → Add to Home Screen → verificar icono e install standalone.
  - ErrorBoundary: forzar un error temporal (o esperar el proximo crash real) — el fallback aparece con mensaje visible en vez de pantalla blanca.
  - Bug iOS: rebuild + deploy + probar el mismo iPhone. Si sigue rompiendo, ahora el mensaje del error debe aparecer via ErrorBoundary (o via Safari devtools remotos). Segundo iteration puede atacar el root cause con la info nueva.
