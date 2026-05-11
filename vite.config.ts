import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
});