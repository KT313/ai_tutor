import { Hono } from 'hono';
import { readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { HISTORIES_DIR } from '../lib/paths.ts';
import { atomicWrite } from '../lib/atomicWrite.ts';

const app = new Hono();

function draftPath(contentId: string, topicSlug: string): string {
  return resolve(HISTORIES_DIR, contentId, `${topicSlug}.draft.json`);
}

// GET /api/drafts/:contentId/:topicSlug
app.get('/:contentId/:topicSlug', async (c) => {
  const filePath = draftPath(c.req.param('contentId'), c.req.param('topicSlug'));
  try {
    const data = await readFile(filePath, 'utf-8');
    return c.json(JSON.parse(data));
  } catch {
    return c.json({ text: '' });
  }
});

// PUT /api/drafts/:contentId/:topicSlug
app.put('/:contentId/:topicSlug', async (c) => {
  const filePath = draftPath(c.req.param('contentId'), c.req.param('topicSlug'));
  const body = await c.req.json<{ text: string }>();

  if (!body.text) {
    // Empty draft — remove the file to avoid clutter.
    try {
      await unlink(filePath);
    } catch {
      /* already gone */
    }
    return c.json({ ok: true });
  }

  await atomicWrite(filePath, JSON.stringify({ text: body.text }));
  return c.json({ ok: true });
});

export default app;
