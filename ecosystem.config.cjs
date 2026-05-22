module.exports = {
  apps: [
    {
      name: 'global-broker-ai-v2',
      script: 'server/app.js',
      cwd: __dirname,
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
      },
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 5000,
      out_file: './logs/api-v2.out.log',
      error_file: './logs/api-v2.err.log',
      time: true,
    },
  ],
}
