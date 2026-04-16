import { Hono } from 'hono';
import { readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { HISTORIES_DIR } from '../lib/paths.ts';
import { atomicWrite } from '../lib/atomicWrite.ts';

const app = new Hono();

function historyPath(contentId: string, topicSlug: string): string {
  return resolve(HISTORIES_DIR, contentId, `${topicSlug}.json`);
}

// GET /api/histories/:contentId/:topicSlug
app.get('/:contentId/:topicSlug', async (c) => {
  const filePath = historyPath(c.req.param('contentId'), c.req.param('topicSlug'));
  try {
    const data = await readFile(filePath, 'utf-8');
    return c.json(JSON.parse(data));
  } catch {
    return c.json(null, 404);
  }
});

// PUT /api/histories/:contentId/:topicSlug
app.put('/:contentId/:topicSlug', async (c) => {
  const filePath = historyPath(c.req.param('contentId'), c.req.param('topicSlug'));
  const body = await c.req.json<{
    chatHistory: unknown[];
    conversation: unknown[];
    modalState: unknown;
    updatedAt: number | null;
  }>();

  // Conflict detection: if file exists and updatedAt doesn't match, 409.
  try {
    const existing = JSON.parse(await readFile(filePath, 'utf-8'));
    if (
      body.updatedAt !== null &&
      existing.updatedAt !== undefined &&
      body.updatedAt !== existing.updatedAt
    ) {
      return c.json({ error: 'conflict', serverUpdatedAt: existing.updatedAt }, 409);
    }
  } catch {
    // File doesn't exist yet — first write, no conflict.
  }

  const record = {
    chatHistory: body.chatHistory,
    conversation: body.conversation,
    modalState: body.modalState,
    updatedAt: Date.now(),
  };
  await atomicWrite(filePath, JSON.stringify(record, null, 2));
  return c.json({ updatedAt: record.updatedAt });
});

// DELETE /api/histories/:contentId/:topicSlug
app.delete('/:contentId/:topicSlug', async (c) => {
  const filePath = historyPath(c.req.param('contentId'), c.req.param('topicSlug'));
  try {
    await unlink(filePath);
  } catch {
    // Already gone — idempotent.
  }
  return c.json({ ok: true });
});

export default app;
