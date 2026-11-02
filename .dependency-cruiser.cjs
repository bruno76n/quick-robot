/** Allowed arrows (docs/03): web → contract, core · server → contract, core, db · db, contract, core → nothing. */
module.exports = {
  forbidden: [
    {
      name: 'core-imports-nothing',
      comment: 'packages/core is pure: no monorepo packages, no Node modules, no npm packages.',
      severity: 'error',
      from: { path: '^packages/core/src' },
      to: { pathNot: '^packages/core/src' },
    },
    {
      name: 'contract-only-zod',
      severity: 'error',
      from: { path: '^packages/contract/src' },
      to: { pathNot: ['^packages/contract/src', 'node_modules/.*zod/'] },
    },
    {
      name: 'db-no-monorepo',
      severity: 'error',
      from: { path: '^packages/db/(src|seed)' },
      to: { path: '^(packages/(core|contract|server)|apps)/' },
    },
    {
      name: 'server-allowed',
      severity: 'error',
      from: { path: '^packages/server/src' },
      to: { path: '^apps/' },
    },
    {
      name: 'web-allowed',
      severity: 'error',
      from: { path: '^apps/web/src' },
      to: { path: '^(packages/(db|server)|apps/(desktop|cloud))/' },
    },
    {
      name: 'web-no-node',
      severity: 'error',
      from: { path: '^apps/web/src' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(node_modules|dist|test|migrations)/|\\.test\\.tsx?$|vite\\.config\\.ts$|vitest\\.config\\.ts$' },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.json'],
    },
  },
};
