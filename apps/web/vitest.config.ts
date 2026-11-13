import react from '@vitejs/plugin-react';
import { defineProject } from 'vitest/config';

export default defineProject({ plugins: [react()], test: { name: 'web', include: ['src/**/*.test.{ts,tsx}'], environment: 'jsdom',
  // Stylesheets read as text (?raw) keep their content; tokens.test.ts checks them.
  css: { include: [/\.css\?raw$/] } } });
