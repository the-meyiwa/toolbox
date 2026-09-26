import { defineConfig, loadEnv } from 'vite';
import { handleApiRequest } from './server-handler.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) {
    if (!process.env[k]) process.env[k] = v;
  }

  return {
    root: '.',
    server: {
      port: 3000,
      open: false,
    },
    plugins: [
      {
        // onnxruntime-web makes Vite emit its ~26 MB .wasm, which is over the
        // 25 MiB per-file limit for Cloudflare Workers static assets and fails
        // the deploy. The watermark remover loads the runtime from jsDelivr
        // (ort.env.wasm.wasmPaths), so the bundled copy is never used.
        name: 'toolbox-drop-ort-wasm',
        apply: 'build',
        generateBundle(_options, bundle) {
          for (const fileName of Object.keys(bundle)) {
            if (/(^|\/)ort-wasm[^/]*\.wasm$/.test(fileName)) delete bundle[fileName];
          }
        }
      },
      {
        name: 'toolbox-api-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const path = req.url?.split('?')[0] || '';
            if (path.startsWith('/api/')) {
              try {
                const handled = await handleApiRequest(req, res);
                if (handled) return;
              } catch (err) {
                console.error('[API Middleware Error]:', err);
                if (!res.headersSent) {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: false, error: err.message }));
                }
                return;
              }
            }
            next();
          });
        }
      }
    ]
  };
});
