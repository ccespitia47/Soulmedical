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
      // globPatterns vacio no se genera manifest de precache (el SW resultante
      // queda inerte y de todas formas no se registra, ver injectRegister).
      // sourcemap:false evita generar sw.js.map/workbox-*.js.map (que Caddy
      // serviria por URL directa aunque el JS no los referencie).
      workbox: {
        globPatterns: [],
        sourcemap: false,
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
