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
    {
      name: 'global-broker-ai-mt5-bridge',
      script: 'mt5_bridge.py',
      cwd: `${__dirname}/mt5-bridge`,
      interpreter: 'python',
      env: {
        MT5_MODE: 'DEMO',
        MT5_READ_ONLY: 'true',
        MT5_ALLOW_ORDER_SEND: 'false',
        MT5_REAL_TRADING_ALLOWED: 'false',
      },
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 5000,
      out_file: './logs/mt5-bridge.out.log',
      error_file: './logs/mt5-bridge.err.log',
      time: true,
    },
  ],
}
