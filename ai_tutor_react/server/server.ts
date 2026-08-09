import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import contents from './routes/contents.ts';
import histories from './routes/histories.ts';
import drafts from './routes/drafts.ts';
import generate from './routes/generate.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const app = new Hono();

app.use('*', cors());

// API routes
app.route('/api/contents', contents);
app.route('/api/histories', histories);
app.route('/api/drafts', drafts);
app.route('/api/generate-content', generate);

// Serve built frontend in production mode (when dist/ exists)
const distDir = resolve(ROOT, 'dist');
if (existsSync(distDir)) {
  // Static assets (JS, CSS, images)
  app.use('*', serveStatic({ root: './dist' }));

  // SPA fallback — any non-API route that didn't match a file gets index.html
  const indexHtml = readFileSync(resolve(distDir, 'index.html'), 'utf-8');
  app.get('*', (c) => c.html(indexHtml));

  console.log(`Serving built frontend from ${distDir}`);
}

const port = 5174;
console.log(`Server listening on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
