// Allowed arrows between packages (docs/03 › Reglas de dependencia). Anything else fails `pnpm lint`.
const pkg = (name) => `^(packages|apps)/${name}/`;
module.exports = {
  forbidden: [
    { name: 'core-imports-nothing', severity: 'error', from: { path: pkg('core') }, to: { pathNot: pkg('core') } },
    { name: 'contract-only-zod', severity: 'error', from: { path: pkg('contract') }, to: { pathNot: [pkg('contract'), '/zod/'] } },
    { name: 'db-no-monorepo', severity: 'error', from: { path: pkg('db') }, to: { path: '^(packages|apps)/', pathNot: pkg('db') } },
    { name: 'server-allowed', severity: 'error', from: { path: pkg('server') }, to: { path: '^(packages|apps)/', pathNot: [pkg('server'), pkg('contract'), pkg('core'), pkg('db')] } },
    { name: 'web-allowed', severity: 'error', from: { path: pkg('web') }, to: { path: '^(packages|apps)/', pathNot: [pkg('web'), pkg('contract'), pkg('core')] } },
    { name: 'desktop-allowed', severity: 'error', from: { path: pkg('desktop') }, to: { path: '^(packages|apps)/', pathNot: [pkg('desktop'), pkg('server'), pkg('db')] } },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['node_modules', '/test/fixtures/', 'dist/', '\\.test\\.', '/test/', 'vite\\.config', 'vitest\\.config'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    combinedDependencies: true,
  },
};
