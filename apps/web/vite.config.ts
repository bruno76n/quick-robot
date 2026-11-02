import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// In development the API runs on its own port; the proxy adds the launch secret so the interface never sees it
// (docs/07 › Cómo hablar con el servidor).
const api = process.env.API_URL ?? 'http://127.0.0.1:8787';
const secret = process.env.APP_SECRET;

export default defineConfig({
  plugins: [react(), tailwind()],
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
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 600 },
});
