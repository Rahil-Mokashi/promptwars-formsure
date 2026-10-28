import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    testTimeout: 15000,
    globals: true,
    // Tests never use a developer's real .env: live reading is mocked or absent.
    env: {
      VITE_FIREBASE_API_KEY: '',
      VITE_FIREBASE_PROJECT_ID: '',
      VITE_FIREBASE_APP_ID: '',
      VITE_FIREBASE_AUTH_DOMAIN: '',
      VITE_GEMINI_MODEL: '',
      VITE_RECAPTCHA_SITE_KEY: '',
    },
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test-setup.ts',
        'src/vite-env.d.ts',
        'src/main.tsx',
        'src/core/types.ts',
      ],
      // The rules engine and extraction logic are the product: hold them to a high bar.
      thresholds: { 'src/core/**': { lines: 90, functions: 90, statements: 90, branches: 85 } },
    },
  },
});
