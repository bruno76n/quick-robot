// Local server for development and `pnpm start` (the same composition apps/desktop will use in phase 4).
// Usage: tsx scripts/local-server.ts [--data <dir>] [--port <n>] [--web <dist>] [--seed]
import { serve } from '@hono/node-server';
import { applyDevelopmentSeed, createApp, loadLocalConfig, localDeps, LOCAL_CTX, stdoutSink } from '@app/server';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { data: { type: 'string' }, port: { type: 'string', default: '8787' }, web: { type: 'string' }, seed: { type: 'boolean', default: false } } });
const cfg = loadLocalConfig({
  port: values.port, dataDir: values.data, webRoot: values.web, secret: process.env.APP_SECRET || undefined,
  allowedOrigins: process.env.WEB_ORIGIN ? [process.env.WEB_ORIGIN] : [],
});
const { deps, conn } = await localDeps(cfg, { version: process.env.npm_package_version ?? 'dev', sink: stdoutSink });
if (values.seed) {
  const created = await applyDevelopmentSeed(deps, LOCAL_CTX);
  deps.logger.info(created ? 'development seed loaded' : 'data present: seed skipped');
}
const app = createApp(deps, cfg.webRoot ? { webRoot: cfg.webRoot } : {});
const server = serve({ fetch: app.fetch, hostname: cfg.host, port: cfg.port }, (info) => {
  deps.logger.info('listening', { url: `http://${cfg.host}:${info.port}` });
});
// Timeouts (docs/15 §4): 15 s per request.
const http = server as unknown as { requestTimeout: number; headersTimeout: number };
http.requestTimeout = 15_000;
http.headersTimeout = 16_000;

process.on('unhandledRejection', (err) => deps.logger.error('unhandled rejection', { err }));
process.on('uncaughtException', (err) => { deps.logger.error('uncaught exception', { err }); process.exit(1); });
const stop = async () => { server.close(); await conn.close(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
