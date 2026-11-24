import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('./renderer', import.meta.url));

// The Content-Security-Policy in index.html allows the dev server's WebSocket only while developing.
const csp = {
  name: 'fishtank-csp',
  transformIndexHtml(html, ctx) {
    const connect = ctx.server ? "'self' ws://localhost:5173 http://localhost:5173" : "'self'";
    return html.replace('__CONNECT_SRC__', connect);
  },
};

export default defineConfig({
  root,
  base: './',
  plugins: [csp],
  build: { outDir: '../dist/renderer', emptyOutDir: true, target: 'esnext' },
  server: { port: 5173, strictPort: true, fs: { allow: [project] } },
});
