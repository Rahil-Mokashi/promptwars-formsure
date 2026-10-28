import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'functions/lib', 'functions/web', 'design'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['functions/**/*.ts', 'shared/**/*.ts', 'vitest.config.ts', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    extends: [jsxA11y.flatConfigs.recommended],
    rules: reactHooks.configs.recommended.rules,
  },
);
