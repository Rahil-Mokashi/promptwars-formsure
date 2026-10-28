import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: 'server', environment: 'node', include: ['functions/src/**/*.test.ts'] },
      },
      {
        plugins: [react()],
        test: {
          name: 'web',
          environment: 'jsdom',
          globals: true,
          include: ['web/src/**/*.test.tsx'],
          setupFiles: ['web/src/test-setup.ts'],
        },
      },
    ],
  },
});
