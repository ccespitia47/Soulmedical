module.exports = {
  apps: [
    {
      name: 'soulforms-frontend',
      cwd: 'c:\\proyectos\\Soulmedical',
      // SEGURIDAD: en producción servimos el bundle minificado de dist/
      // con `vite preview`, NO el código fuente con `vite` (dev server).
      // Vite dev expone los archivos .tsx originales en DevTools/Sources.
      // `vite preview` solo sirve dist/ ya minificado (sin sourcemaps,
      // con console/debugger removidos por esbuild — ver vite.config.ts).
      //
      // Antes de arrancar este proceso debes hacer `npm run build` para
      // que dist/ exista. Si haces cambios al código fuente, otro build.
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview --host --port 5173 --strictPort',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'soulforms-backend',
      cwd: 'c:\\proyectos\\Soulmedical\\backend',
      script: 'dist/main.js',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
    },
  ],
};
