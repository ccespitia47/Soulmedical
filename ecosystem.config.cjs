module.exports = {
  apps: [
    {
      name: 'soulforms-front',
      cwd: 'c:\\proyectos\\Soulmedical',
      script: 'node_modules/vite/bin/vite.js',
      args: '--host',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
