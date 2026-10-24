import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'autoUpdate': cuando desplegamos version nueva, el SW la detecta y
      // recarga automaticamente al proximo visit (no queda cache stale).
      registerType: 'autoUpdate',
      // 'auto' inyecta el <script> de registro en index.html. Necesario para
      // que Chrome/Edge desktop y Android muestren el prompt "Instalar app"
      // — sin SW registrado, la PWA no se considera "installable".
      // iOS Safari no requiere SW (Apple usa manifest + meta tags iOS igual).
      injectRegister: 'auto',
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
      // Sin precache/SW real por ahora: solo queremos el manifest.
      // `workbox: undefined` deja los defaults de `generateSW`, que intentan
      // precachear el bundle principal y fallan si supera 2 MiB. Con
      // globPatterns vacio no se genera manifest de precache del bundle.
      //
      // OJO: el SW SI se registra (injectRegister:'auto' inyecta
      // /registerSW.js en index.html). Por eso `navigateFallback: null` es
      // obligatorio: con el default, generateSW emite
      //   registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))
      // que intercepta TODA navegacion y la responde desde la cache de
      // Workbox en vez de pedirsela a Caddy — el usuario se queda con el
      // index.html (y por tanto el bundle) de un deploy anterior. Ademas
      // index.html no esta en el manifest de precache, asi que
      // createHandlerBoundToURL lanza al instalar y el SW nuevo ni siquiera
      // reemplaza al viejo. Con null el SW solo precachea los iconos y nunca
      // toca las navegaciones: cada `npm run build` se ve al instante.
      //
      // sourcemap:false evita generar sw.js.map/workbox-*.js.map (que Caddy
      // serviria por URL directa aunque el JS no los referencie).
      workbox: {
        globPatterns: [],
        navigateFallback: null,
        sourcemap: false,
      },
      // Necesario porque en producción soulforms.com.co corre `npm run dev`
      // detras de Caddy (reverse_proxy a localhost:5173), no un build
      // estatico. Sin devOptions.enabled=true, Vite dev NO inyecta el
      // <link rel="manifest"> ni el <script src="/registerSW.js"> — la
      // PWA queda invisible para el browser. Con esto el manifest tambien
      // se sirve en dev, y Chrome/Edge muestran el prompt de instalar.
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    // Sin sourcemaps en prod. 'hidden' evita el comentario
    // //# sourceMappingURL en el JS pero los .map se sirven igual por URL
    // directa (bundle.js.map). Un atacante puede reconstruir la logica
    // de negocio (endpoints, widgets, permisos). Preferimos no exponerlos
    // y usar Safari devtools remoto + console.error del ErrorBoundary para
    // debug movil.
    sourcemap: false,
    minify: 'esbuild',
    brotliSize: false,
    target: 'es2016',
  },
  esbuild: {
    // Solo dropea 'debugger'; console.error/warn/log se preservan en prod
    // para poder depurar remotamente (ej. Safari devtools por cable).
    drop: ['debugger'],
  },
  server: {
    allowedHosts: ['soulforms.com.co', 'localhost', '10.10.20.15'],
  },
  preview: {
    allowedHosts: ['soulforms.com.co', 'localhost', '10.10.20.15'],
  },
});
