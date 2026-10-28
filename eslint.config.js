import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const appFiles = ['src/**/*.{ts,tsx}'];
const testFiles = ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/test-setup.ts', 'src/vitest-axe.d.ts'];
const forApp = (configs) => configs.map((config) => ({ ...config, files: appFiles }));

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  // Type-checked strict and stylistic rules for the application and its tests.
  ...forApp(tseslint.configs.strictTypeChecked),
  ...forApp(tseslint.configs.stylisticTypeChecked),
  {
    files: appFiles,
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks },
    extends: [jsxA11y.flatConfigs.recommended],
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }], // numbers are safe in template strings
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['error', 'warn'] }],
      complexity: ['error', 10],
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: testFiles,
    rules: { complexity: 'off', 'max-lines': 'off', 'max-lines-per-function': 'off' },
  },
  // Tooling files are plain scripts: no type information needed.
  {
    files: [
      'vitest.config.ts',
      'vite.config.ts',
      'playwright.config.ts',
      'eslint.config.js',
      'scripts/**/*.mjs',
      'e2e/**/*.ts',
    ],
    extends: [...tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: { eqeqeq: ['error', 'always'] },
  },
);
