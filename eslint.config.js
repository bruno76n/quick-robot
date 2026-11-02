// Lint config. The "boundaries" blocks enforce docs/03 (allowed package arrows) and docs/02 §7.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

const NODE_BUILTINS =
  '^(node:|(assert|async_hooks|buffer|child_process|cluster|crypto|dgram|dns|events|fs|http|http2|https|module|net|os|path|perf_hooks|process|readline|stream|string_decoder|timers|tls|tty|url|util|v8|vm|worker_threads|zlib)(/.*)?$)';

const restrict = (patterns) => ['error', { patterns }];
const ban = (regex, message) => ({ regex, message });

/** Comparisons against the runtime mode are forbidden in rules and use cases (docs/02 §7.6). */
const noModeBranching = [
  'error',
  { selector: "BinaryExpression[right.value='cloud'], BinaryExpression[right.value='local']", message: "No mode branching in rules or use cases; inject a dependency instead (docs/02 §7.6)." },
];

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', 'spikes/**', 'reference/**', 'tools/boundaries/fixtures/**', '**/migrations/**', 'coverage/**', 'playwright-report/**', 'test-results/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // ── Boundaries ────────────────────────────────────────────────────────────
  {
    // core → nothing. Pure TypeScript: only relative imports.
    files: ['packages/core/src/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': restrict([ban('^(?!\\.{1,2}/)', 'packages/core imports nothing: pure functions only (docs/03).')]),
      'no-restricted-syntax': noModeBranching,
      'no-restricted-globals': ['error', { name: 'Date', message: 'core does not read the clock; pass "today" in.' }, { name: 'crypto', message: 'core does not generate ids; pass them in.' }],
    },
  },
  {
    // contract → nothing from the monorepo (zod only).
    files: ['packages/contract/src/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict([ban('^(?!\\.{1,2}/|zod($|/))', 'packages/contract may import only zod (docs/03).')]),
    },
  },
  {
    // db → nothing from the monorepo.
    files: ['packages/db/{src,seed}/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict([
        ban('^@app/', 'packages/db imports nothing from the monorepo (docs/03).'),
        ban('^(react|electron|hono)($|/)', 'packages/db is data access only.'),
      ]),
    },
  },
  {
    // server → contract, core, db. Only db writes SQL.
    files: ['packages/server/src/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict([
        ban('^@app/(web|desktop|cloud)($|/)', 'packages/server may import only contract, core and db (docs/03).'),
        ban('^(drizzle-orm|pg|@electric-sql/.*)($|/)', 'Only packages/db writes SQL (docs/02 §7.4).'),
        ban('^(react|electron)($|/)', 'packages/server has no UI and no Electron.'),
      ]),
    },
  },
  {
    files: ['packages/server/src/usecases/**/*.ts'],
    rules: { 'no-restricted-syntax': noModeBranching },
  },
  {
    // web → contract, core. No Node, no db, no server, no Electron.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-imports': restrict([
        ban('^@app/(db|server|desktop|cloud)($|/)', 'apps/web may import only contract and core (docs/03).'),
        ban('^(electron|drizzle-orm|pg|@electric-sql/.*|hono)($|/)', 'apps/web talks to the API only.'),
        ban(NODE_BUILTINS, 'apps/web runs in the browser: no Node modules.'),
      ]),
    },
  },
  {
    // UI text lives only in i18n/es.ts (CLAUDE.md › Idioma).
    files: ['apps/web/src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': ['error', { selector: 'JSXText[value=/[A-Za-zÁÉÍÓÚáéíóúñÑ0-9]/]', message: 'UI text goes in apps/web/src/i18n/es.ts.' }],
    },
  },
  {
    files: ['**/*.config.{js,ts}', 'tools/**/*.{js,ts,mjs}', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
