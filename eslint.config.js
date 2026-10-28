import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'design', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['vitest.config.ts', 'vite.config.ts', 'playwright.config.ts', 'eslint.config.js', 'scripts/**/*.mjs', 'e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    extends: [jsxA11y.flatConfigs.recommended],
    rules: reactHooks.configs.recommended.rules,
  },
);
