import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CONTENT_DIR, PROMPTS_DIR } from '../lib/paths.ts';
import { atomicWrite } from '../lib/atomicWrite.ts';
import { topicSlug } from '../lib/slug.ts';
import {
  uploadFile,
  waitForFile,
  generateContent,
  buildFilePromptTurn,
} from '../lib/geminiServer.ts';
import {
  generateContentOpenRouter,
  buildPdfPromptMessage,
  buildTextMessage,
} from '../lib/openrouterServer.ts';
import { parseContentData } from '../lib/parseContentData.ts';

const app = new Hono();

const DEFAULT_MODEL_GOOGLE = 'gemini-2.5-flash';
const DEFAULT_MODEL_OPENROUTER = 'google/gemini-2.5-flash';

/**
 * POST /api/generate-content
 *
 * Multipart form fields:
 *   - pdf      (File, one or more)
 *   - title    (string)
 *   - language (string: "de" | "en" | "ko")
 *   - model    (string, optional — defaults per provider)
 *
 * Headers:
 *   - X-API-Key:  API key (Gemini or OpenRouter)
 *   - X-Provider: "google" (default) or "openrouter"
 *
 * Streams SSE progress events, final event contains { step: "done", id }.
 */
app.post('/', async (c) => {
  const apiKey = c.req.header('X-API-Key') || '';
  if (!apiKey) return c.json({ error: 'Missing X-API-Key header' }, 400);

  const provider = (c.req.header('X-Provider') || 'google') as 'google' | 'openrouter';

  const body = await c.req.parseBody({ all: true });
  const title = body['title'] as string;
  const language = body['language'] as string;
  const defaultModel = provider === 'openrouter' ? DEFAULT_MODEL_OPENROUTER : DEFAULT_MODEL_GOOGLE;
  const model = (body['model'] as string) || defaultModel;

  if (!title || !language) {
    return c.json({ error: 'Missing title or language field' }, 400);
  }

  // Collect PDF files
  const rawPdfs = body['pdf'];
  const pdfFiles: File[] = [];
  if (rawPdfs instanceof File) {
    pdfFiles.push(rawPdfs);
  } else if (Array.isArray(rawPdfs)) {
    for (const f of rawPdfs) {
      if (f instanceof File) pdfFiles.push(f);
    }
  }
  if (pdfFiles.length === 0) {
    return c.json({ error: 'No PDF files uploaded' }, 400);
  }

  // Validate language and load prompts
  const supportedLangs = ['de', 'en', 'ja', 'ko'];
  if (!supportedLangs.includes(language)) {
    return c.json({ error: `Unsupported language: ${language}` }, 400);
  }

  return streamSSE(c, async (stream) => {
    const send = (step: string, message: string, extra?: Record<string, unknown>) => {
      return stream.writeSSE({
        data: JSON.stringify({ step, message, ...extra }),
      });
    };

    try {
      // Load prompts for the selected language
      const promptDir = resolve(PROMPTS_DIR, language);
      console.log(`[pipeline] Starting generation: title="${title}", lang=${language}, model=${model}, provider=${provider}, files=${pdfFiles.length}`);
      console.log(`[pipeline] Loading prompts from ${promptDir}`);
      const [prompt1a, prompt1b, prompt2a, prompt2b] = await Promise.all([
        readFile(resolve(promptDir, '1a.txt'), 'utf-8'),
        readFile(resolve(promptDir, '1b.txt'), 'utf-8'),
        readFile(resolve(promptDir, '2a.txt'), 'utf-8'),
        readFile(resolve(promptDir, '2b.txt'), 'utf-8'),
      ]);
      console.log(`[pipeline] Prompts loaded: 1a=${prompt1a.length}ch, 1b=${prompt1b.length}ch, 2a=${prompt2a.length}ch, 2b=${prompt2b.length}ch`);

      // Read all PDFs into buffers upfront (needed for both providers)
      const pdfBuffers: Array<{ buffer: Buffer; name: string }> = [];
      for (const pdf of pdfFiles) {
        const buf = Buffer.from(await pdf.arrayBuffer());
        pdfBuffers.push({ buffer: buf, name: pdf.name });
      }

      let response1a: string;
      let response1b: string;
      let response2a: string;
      let response2b: string;

      if (provider === 'openrouter') {
        // ---- OpenRouter pipeline: inline base64 PDFs, chat completions ----
        // Step 1: No upload needed, PDFs sent inline
        await send('uploading', `Preparing ${pdfFiles.length} file(s)...`);
        console.log(`[pipeline] OpenRouter mode: ${pdfBuffers.length} PDF(s) will be sent inline as base64`);

        // Step 2: Skip processing (no Gemini Files API)
        await send('processing', 'Files ready.');
        console.log(`[pipeline] OpenRouter: skipping file processing (inline base64)`);

        // Step 3: Chat 1, Turn 1 — prompt 1a + PDFs
        await send('generating', 'Running prompt 1a — initial content creation...');
        console.log(`[pipeline] Step 3: Running prompt 1a via OpenRouter (${prompt1a.length} chars + ${pdfBuffers.length} PDFs)`);
        const turn1 = buildPdfPromptMessage(pdfBuffers, prompt1a);
        const chat1 = [turn1];
        response1a = await generateContentOpenRouter(apiKey, model, chat1);
        console.log(`[pipeline] Step 3 done: response1a = ${response1a.length} chars`);

        // Step 4: Chat 1, Turn 2 — prompt 1b
        await send('generating', 'Running prompt 1b — checking for missing content...');
        console.log(`[pipeline] Step 4: Running prompt 1b via OpenRouter (${prompt1b.length} chars)`);
        chat1.push(buildTextMessage('assistant', response1a, true));
        chat1.push(buildTextMessage('user', prompt1b));
        response1b = await generateContentOpenRouter(apiKey, model, chat1);
        console.log(`[pipeline] Step 4 done: response1b = ${response1b.length} chars`);

        // Step 5: Chat 2, Turn 1 — prompt 2a with merged results
        await send('consolidating', 'Running prompt 2a — consolidating content...');
        const mergedResults = response1a + '\n\n' + response1b;
        const filled2a = prompt2a.replace('INSERT HERE', mergedResults);
        console.log(`[pipeline] Step 5: Running prompt 2a via OpenRouter (${filled2a.length} chars)`);
        const chat2 = [buildTextMessage('user', filled2a, true)];
        response2a = await generateContentOpenRouter(apiKey, model, chat2);
        console.log(`[pipeline] Step 5 done: response2a = ${response2a.length} chars`);

        // Step 6: Chat 2, Turn 2 — prompt 2b
        await send('finalizing', 'Running prompt 2b — final quality check...');
        console.log(`[pipeline] Step 6: Running prompt 2b via OpenRouter (${prompt2b.length} chars)`);
        chat2.push(buildTextMessage('assistant', response2a, true));
        chat2.push(buildTextMessage('user', prompt2b));
        response2b = await generateContentOpenRouter(apiKey, model, chat2);
        console.log(`[pipeline] Step 6 done: response2b = ${response2b.length} chars`);
      } else {
        // ---- Google Gemini pipeline: Files API + generateContent ----
        // Step 1: Upload PDFs to Gemini
        await send('uploading', `Uploading ${pdfFiles.length} file(s) to Gemini...`);
        console.log(`[pipeline] Step 1: Uploading ${pdfFiles.length} PDF(s)`);
        const uploadedFiles = [];
        for (const pdf of pdfBuffers) {
          console.log(`[pipeline]   Uploading "${pdf.name}" (${(pdf.buffer.length / 1024).toFixed(1)} KB)`);
          const uploaded = await uploadFile(apiKey, pdf.buffer, pdf.name, 'application/pdf');
          uploadedFiles.push(uploaded);
        }
        console.log(`[pipeline] Step 1 done: ${uploadedFiles.length} file(s) uploaded`);

        // Step 2: Wait for files to become active
        await send('processing', 'Waiting for file processing...');
        console.log(`[pipeline] Step 2: Waiting for file processing`);
        const activeFiles = [];
        for (const f of uploadedFiles) {
          if (f.state === 'ACTIVE') {
            console.log(`[pipeline]   ${f.name} already ACTIVE`);
            activeFiles.push({ uri: f.uri, mimeType: f.mimeType });
          } else {
            console.log(`[pipeline]   ${f.name} is ${f.state}, polling...`);
            const active = await waitForFile(apiKey, f.name);
            activeFiles.push({ uri: active.uri, mimeType: active.mimeType });
          }
        }
        console.log(`[pipeline] Step 2 done: all files active`);

        // Step 3: Chat 1, Turn 1 — prompt 1a + files
        await send('generating', 'Running prompt 1a — initial content creation...');
        console.log(`[pipeline] Step 3: Running prompt 1a (${prompt1a.length} chars + ${activeFiles.length} file refs)`);
        const turn1 = buildFilePromptTurn(activeFiles, prompt1a);
        const chat1 = [turn1];
        response1a = await generateContent(apiKey, model, chat1);
        console.log(`[pipeline] Step 3 done: response1a = ${response1a.length} chars`);

        // Step 4: Chat 1, Turn 2 — prompt 1b
        await send('generating', 'Running prompt 1b — checking for missing content...');
        console.log(`[pipeline] Step 4: Running prompt 1b (${prompt1b.length} chars)`);
        chat1.push({ role: 'model', parts: [{ text: response1a }] });
        chat1.push({ role: 'user', parts: [{ text: prompt1b }] });
        response1b = await generateContent(apiKey, model, chat1);
        console.log(`[pipeline] Step 4 done: response1b = ${response1b.length} chars`);

        // Step 5: Chat 2, Turn 1 — prompt 2a with both results inserted
        await send('consolidating', 'Running prompt 2a — consolidating content...');
        const mergedResults = response1a + '\n\n' + response1b;
        const filled2a = prompt2a.replace('INSERT HERE', mergedResults);
        console.log(`[pipeline] Step 5: Running prompt 2a (${filled2a.length} chars, merged ${mergedResults.length} chars of results)`);
        const chat2: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [
          { role: 'user', parts: [{ text: filled2a }] },
        ];
        response2a = await generateContent(apiKey, model, chat2);
        console.log(`[pipeline] Step 5 done: response2a = ${response2a.length} chars`);

        // Step 6: Chat 2, Turn 2 — prompt 2b
        await send('finalizing', 'Running prompt 2b — final quality check...');
        console.log(`[pipeline] Step 6: Running prompt 2b (${prompt2b.length} chars)`);
        chat2.push({ role: 'model', parts: [{ text: response2a }] });
        chat2.push({ role: 'user', parts: [{ text: prompt2b }] });
        response2b = await generateContent(apiKey, model, chat2);
        console.log(`[pipeline] Step 6 done: response2b = ${response2b.length} chars`);
      }

      // Step 7: Parse CONTENT_DATA from the final response (shared logic)
      await send('saving', 'Parsing and saving content...');
      console.log(`[pipeline] Step 7: Parsing CONTENT_DATA`);

      let cards: unknown[];
      try {
        console.log(`[pipeline] Trying to parse from response2b (${response2b.length} chars)`);
        cards = parseContentData(response2b);
      } catch (parseErr2b) {
        console.log(`[pipeline] response2b parse failed: ${(parseErr2b as Error).message}`);
        console.log(`[pipeline] Falling back to response2a (${response2a.length} chars)`);
        try {
          cards = parseContentData(response2a);
        } catch (parseErr2a) {
          console.error(`[pipeline] response2a parse also failed: ${(parseErr2a as Error).message}`);
          throw parseErr2a;
        }
      }

      // Generate a filesystem-safe ID
      const slug = topicSlug(title);
      const id = slug;

      const contentFile = {
        id,
        language,
        title,
        cards,
      };

      const outPath = resolve(CONTENT_DIR, `${id}.json`);
      console.log(`[pipeline] Writing ${(cards as unknown[]).length} cards to ${outPath}`);
      await atomicWrite(outPath, JSON.stringify(contentFile, null, 2));
      console.log(`[pipeline] Done! Content saved as id="${id}"`);

      await send('done', 'Content generated successfully!', { id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[pipeline] FAILED:`, err);
      await send('error', message);
    }
  });
});

export default app;
