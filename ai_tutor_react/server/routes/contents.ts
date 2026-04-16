import { Hono } from 'hono';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CONTENT_DIR } from '../lib/paths.ts';

const app = new Hono();

// GET /api/contents — list all content files (id, language, title).
app.get('/', async (c) => {
  try {
    const files = await readdir(CONTENT_DIR);
    const items = await Promise.all(
      files
        .filter((f) => f.endsWith('.json'))
        .map(async (f) => {
          const raw = JSON.parse(await readFile(resolve(CONTENT_DIR, f), 'utf-8'));
          return { id: raw.id, language: raw.language, title: raw.title };
        }),
    );
    return c.json(items);
  } catch {
    return c.json([]);
  }
});

// GET /api/contents/:id — load a single content file.
app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const filePath = resolve(CONTENT_DIR, `${id}.json`);
  try {
    const data = await readFile(filePath, 'utf-8');
    return c.json(JSON.parse(data));
  } catch {
    return c.json({ error: 'not found' }, 404);
  }
});

export default app;
