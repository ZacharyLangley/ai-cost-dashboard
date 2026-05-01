export default {
  apps: [
    {
      name: 'api',
      script: 'src/api/index.ts',
      interpreter: 'tsx',
      env: {
        NODE_ENV: 'production',
      },
      max_restarts: 10,
      restart_delay: 2000,
    },
    {
      name: 'worker',
      script: 'src/jobs/worker.ts',
      interpreter: 'tsx',
      env: {
        NODE_ENV: 'production',
      },
      max_restarts: 10,
      restart_delay: 2000,
    },
  ],
};
