// Package boundaries (docs/02 §7, docs/03), security rules (docs/11) and style rules (docs/14 §1).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const relativeOnly = '^(?!\\.{1,2}/)';
const boundary = (message, patterns) => ({ 'no-restricted-imports': ['error', { patterns: patterns.map((p) => ({ ...p, message: p.message ?? message })) }] });

const securitySyntax = [
  { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'dangerouslySetInnerHTML is forbidden (docs/11 A05).' },
  { selector: "MemberExpression[property.name='innerHTML']", message: 'innerHTML is forbidden (docs/11 A05).' },
  { selector: "MemberExpression[object.name='sql'][property.name='raw']", message: 'sql.raw is forbidden: SQL must be parameterized (docs/11 A05).' },
  { selector: "CallExpression[callee.property.name='unsafe']", message: 'unsafe SQL is forbidden (docs/11 A05).' },
  { selector: "CallExpression[callee.property.name=/^(query|exec|execute)$/] > TemplateLiteral[expressions.length>0]", message: 'SQL built by concatenation is forbidden (docs/11 A05).' },
  { selector: "CallExpression[callee.property.name=/^(query|exec|execute)$/] > BinaryExpression[operator='+']", message: 'SQL built by concatenation is forbidden (docs/11 A05).' },
  { selector: 'ExportDefaultDeclaration', message: 'No default exports (docs/14 §1).' },
];
const noModeBranch = { selector: "BinaryExpression[operator=/^[!=]==?$/] > Literal[value='cloud']", message: "No if (mode === 'cloud') in rules or use cases (CLAUDE.md rule 7)." };
const noSpanishInJsx = [
  { selector: 'JSXText[value=/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡]/]', message: 'User-facing text lives in i18n/es.ts (docs/13 §2).' },
  { selector: "JSXAttribute[name.name=/^(title|placeholder|alt|aria-label|label)$/] > Literal", message: 'User-facing text lives in i18n/es.ts (docs/13 §2).' },
];

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/out/**', '**/coverage/**', 'spikes/**', 'reference/**', 'assets/**', 'packages/db/migrations/**', '**/test/fixtures/**', 'test-results/**', 'playwright-report/**', '.data/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { console: 'readonly', process: 'readonly', URL: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' } },
    rules: {
      'no-console': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-syntax': ['error', ...securitySyntax],
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      ...boundary('packages/core imports nothing: pure functions only (docs/03).', [{ regex: relativeOnly }]),
      'no-restricted-syntax': ['error', ...securitySyntax, noModeBranch,
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: 'core does not read the clock: "today" is a parameter (docs/14 §1).' },
        { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']", message: 'core does not read the clock (docs/14 §1).' },
        { selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']", message: 'core has no randomness (docs/14 §1).' }],
    },
  },
    { files: ['packages/contract/src/**/*.ts'], rules: boundary('packages/contract imports only zod (docs/03).', [{ regex: '^(?!(\\.{1,2}/|zod$|zod/))' }]) },
  { files: ['packages/db/src/**/*.ts'], rules: boundary('packages/db imports nothing from the monorepo (docs/03).', [{ regex: '^@app/' }]) },
  {
    files: ['packages/server/src/**/*.ts'],
    rules: {
      ...boundary('packages/server: SQL only in packages/db; never web, desktop or cloud (docs/02 §7).', [
        { regex: '^@app/(web|desktop|cloud)' }, { regex: '^(drizzle-orm|@electric-sql/pglite|postgres)(/|$)' }, { regex: '^electron' }]),
      'no-restricted-syntax': ['error', ...securitySyntax, noModeBranch],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { window: 'readonly', document: 'readonly', navigator: 'readonly', fetch: 'readonly', localStorage: 'readonly', HTMLElement: 'readonly', KeyboardEvent: 'readonly', Blob: 'readonly', AbortController: 'readonly' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...boundary('apps/web imports only contract and core (docs/03).', [
        { regex: '^@app/(db|server|desktop|cloud)' }, { regex: '^node:' }, { regex: '^(fs|path|os|child_process|crypto)$' }, { regex: '^electron' }, { regex: '^(drizzle-orm|@electric-sql/pglite|postgres|hono)(/|$)' }]),
    },
  },
  { files: ['apps/web/src/features/**/*.tsx', 'apps/web/src/components/**/*.tsx'], rules: { 'no-restricted-syntax': ['error', ...securitySyntax, ...noSpanishInJsx] } },
  { files: ['apps/desktop/src/**/*.ts'], rules: boundary('apps/desktop: only server, db and the web build (docs/03).', [{ regex: '^@app/(core|contract|web)' }]) },
  { files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs', globals: { module: 'writable', require: 'readonly' } } },
  { files: ['**/*.config.{js,ts}', 'eslint.config.js', '**/vite.config.ts', 'playwright.config.ts'], rules: { 'no-restricted-syntax': 'off' } },
  { files: ['scripts/**/*.mjs', 'tools/**/*.{ts,mjs}', 'e2e/**/*.ts'], rules: { 'no-console': 'off', 'max-lines-per-function': 'off' } },
);
