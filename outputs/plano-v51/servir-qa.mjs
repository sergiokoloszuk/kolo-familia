import { createServer } from 'vite';
import path from 'node:path';
// Apenas loopback e código local. Sem env de produção, banco ou cliente de IA.
const root = process.cwd();
for (const key of Object.keys(process.env)) if (/SECRET|TOKEN|API_KEY|SUPABASE|STRIPE|DATABASE|POSTGRES/i.test(key)) delete process.env[key];
const server = await createServer({
  configFile: false, envFile: false, root: path.join(root,'outputs/plano-v51/browser'),
  resolve: {alias: {'@':path.join(root,'apps/web/src')}},
  oxc: { jsx: { runtime: 'automatic' } },
  server: { host: '127.0.0.1', port: 4178, strictPort: true, fs: {allow:[root]} },
});
await server.listen();
console.log('QA V5.1 somente em http://127.0.0.1:4178');
