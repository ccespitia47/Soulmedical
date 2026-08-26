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
      registerType: 'autoUpdate',
      injectRegister: null, // Sin SW por ahora
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
      workbox: {
        globPatterns: [],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    sourcemap: false,
    minify: 'esbuild',
    brotliSize: false,
    target: 'es2018',
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
  server: {
    allowedHosts: ['soulforms.com.co', 'localhost', '10.10.20.15'],
  },
  preview: {
    allowedHosts: ['soulforms.com.co', 'localhost', '10.10.20.15'],
  },
});
