module.exports = {
  apps: [
    {
      name: 'gamification-engine',
      script: 'dist/index.js',
      cwd: '/var/www/gamification-engine',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      error_file: '/var/log/pm2/gamification-engine-error.log',
      out_file: '/var/log/pm2/gamification-engine-out.log',
      log_file: '/var/log/pm2/gamification-engine-combined.log',
      time: true
    }
  ]
};

