import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import contents from './routes/contents.ts';
import histories from './routes/histories.ts';
import drafts from './routes/drafts.ts';

const app = new Hono();

app.use('*', cors());

app.route('/api/contents', contents);
app.route('/api/histories', histories);
app.route('/api/drafts', drafts);

const port = 5174;
console.log(`Hono server listening on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
