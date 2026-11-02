import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { es } from './src/i18n/es';

// In development the API runs on its own port; the proxy adds the launch secret so the interface never sees it
// (docs/07 › Cómo hablar con el servidor).
const api = process.env.API_URL ?? 'http://127.0.0.1:8787';
const secret = process.env.APP_SECRET;

const page = (name: string) => decodeURIComponent(new URL(`./${name}`, import.meta.url).pathname);

// The desktop shell may only use the build of web (docs/03): its menu and dialog labels come from es.ts as a JSON file.
const desktopTexts = (): Plugin => ({
  name: 'desktop-texts',
  apply: 'build',
  // fatal.html is opened from disk (loadFile), so its script and style URLs are relative.
  transformIndexHtml: { order: 'post', handler: (html, ctx) => (ctx.filename.endsWith('fatal.html') ? html.replace(/(src|href)="\/assets\//g, '$1="./assets/') : html) },
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'desktop-texts.json', source: JSON.stringify({ desktop: es.screens.desktop, fatal: es.screens.fatal }) });
  },
});

export default defineConfig({
  plugins: [react(), tailwind(), desktopTexts()],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.WEB_PORT ?? 5173),
    strictPort: true,
    proxy: {
      '/api': {
        target: api,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (req) => {
            if (secret) req.setHeader('authorization', `Bearer ${secret}`);
            req.removeHeader('origin');
          });
        },
      },
    },
  },
  build: {
    target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 600,
    // fatal.html: the desktop fatal page (docs/15 §5), opened from disk by apps/desktop when the server is not there.
    rollupOptions: { input: { main: page('index.html'), fatal: page('fatal.html') } },
  },
  experimental: {
    // CSS URLs point next to their fonts (works from disk and from the server alike).
    renderBuiltUrl: (_file, { hostType }) => (hostType === 'css' ? { relative: true } : undefined),
  },
});
