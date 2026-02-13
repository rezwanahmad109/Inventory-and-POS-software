module.exports = {
  apps: [
    {
      name: 'inventory-pos-backend',
      cwd: __dirname,
      script: 'dist/main.js',
      exec_mode: process.env.PM2_EXEC_MODE || 'cluster',
      instances: process.env.PM2_INSTANCES || 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      time: true,
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
