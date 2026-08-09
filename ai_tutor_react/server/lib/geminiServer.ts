/**
 * Server-side Gemini API helpers for file upload and content generation.
 * Used by the PDF→content pipeline (Phase F).
 */

const BASE = 'https://generativelanguage.googleapis.com';

// ---------- File Upload ----------

interface GeminiFile {
  name: string;       // e.g. "files/abc123"
  uri: string;        // full URI for use in generateContent
  mimeType: string;
  state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
}

/**
 * Upload a file to the Gemini Files API using multipart/related.
 */
export async function uploadFile(
  apiKey: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<GeminiFile> {
  console.log(`[upload] Starting upload: ${fileName} (${(fileBuffer.length / 1024).toFixed(1)} KB, ${mimeType})`);
  const boundary = '----GeminiUploadBoundary' + Date.now();

  const metadataJson = JSON.stringify({ file: { displayName: fileName } });

  // Build multipart/related body manually
  const parts: Buffer[] = [
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${metadataJson}\r\n`,
    ),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ];
  const body = Buffer.concat(parts);

  const url = `${BASE}/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`;
  console.debug(`[upload] POST ${url.replace(/key=[^&]+/, 'key=***')}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'X-Goog-Upload-Protocol': 'multipart',
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[upload] Failed (${res.status}): ${text.slice(0, 500)}`);
      throw new Error(`Gemini file upload failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as { file: GeminiFile };
    console.log(`[upload] Success: ${data.file.name} (state: ${data.file.state}, uri: ${data.file.uri})`);
    return data.file;
  } catch (err) {
    if ((err as Error).message.startsWith('Gemini file upload failed')) throw err;
    console.error(`[upload] Network/fetch error for ${fileName}:`, err);
    throw err;
  }
}

/**
 * Poll the Gemini Files API until the file reaches ACTIVE state.
 */
export async function waitForFile(
  apiKey: string,
  fileName: string,
  maxWaitMs = 120_000,
): Promise<GeminiFile> {
  console.log(`[waitForFile] Polling ${fileName} (timeout: ${maxWaitMs / 1000}s)`);
  const start = Date.now();
  let polls = 0;

  while (Date.now() - start < maxWaitMs) {
    polls++;
    try {
      const res = await fetch(
        `${BASE}/v1beta/${fileName}?key=${encodeURIComponent(apiKey)}`,
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`[waitForFile] Poll #${polls} failed (${res.status}): ${text.slice(0, 300)}`);
        throw new Error(`Failed to check file state (${res.status}): ${text.slice(0, 300)}`);
      }

      const data = (await res.json()) as GeminiFile;
      console.debug(`[waitForFile] Poll #${polls}: state=${data.state} (${((Date.now() - start) / 1000).toFixed(1)}s elapsed)`);

      if (data.state === 'ACTIVE') {
        console.log(`[waitForFile] File active after ${polls} poll(s)`);
        return data;
      }
      if (data.state === 'FAILED') {
        console.error(`[waitForFile] File processing FAILED`);
        throw new Error('Gemini file processing failed.');
      }
    } catch (err) {
      if ((err as Error).message.includes('file state') || (err as Error).message.includes('FAILED')) throw err;
      console.error(`[waitForFile] Poll #${polls} network error:`, err);
      throw err;
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  console.error(`[waitForFile] Timed out after ${polls} polls (${maxWaitMs / 1000}s)`);
  throw new Error('Timed out waiting for file processing.');
}

// ---------- Content Generation ----------

interface ContentPart {
  text?: string;
  fileData?: { fileUri: string; mimeType: string };
}

interface ContentTurn {
  role: 'user' | 'model';
  parts: ContentPart[];
}

/**
 * Call Gemini's generateContent (non-streaming) and return the full text response.
 * Uses a generous timeout since PDF analysis can take a while.
 */
export async function generateContent(
  apiKey: string,
  model: string,
  contents: ContentTurn[],
): Promise<string> {
  const url = `${BASE}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const turnCount = contents.length;
  const lastRole = contents[turnCount - 1]?.role ?? '?';
  console.log(`[generate] Calling model=${model}, turns=${turnCount}, lastRole=${lastRole}`);
  console.debug(`[generate] POST ${url.replace(/key=[^&]+/, 'key=***')}`);

  const body = { contents };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000); // 5 min timeout
  const startTime = Date.now();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[generate] Failed (${res.status}) after ${elapsed}s: ${text.slice(0, 500)}`);
      throw new Error(`Gemini API error (${res.status}): ${text.slice(0, 500)}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
    };

    const candidate = data.candidates?.[0];
    const finishReason = candidate?.finishReason ?? 'unknown';
    const parts = candidate?.content?.parts;

    if (!parts?.length) {
      console.error(`[generate] Empty response after ${elapsed}s (finishReason: ${finishReason})`);
      console.debug(`[generate] Raw response:`, JSON.stringify(data).slice(0, 1000));
      throw new Error(`Empty response from Gemini (finishReason: ${finishReason}).`);
    }

    const text = parts.map((p) => p.text ?? '').join('');
    console.log(`[generate] OK after ${elapsed}s — ${text.length} chars, finishReason=${finishReason}`);
    console.debug(`[generate] Response preview: ${text.slice(0, 200)}...`);
    return text;
  } catch (err) {
    if ((err as Error).message.startsWith('Gemini API error') || (err as Error).message.startsWith('Empty response')) throw err;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[generate] Error after ${elapsed}s:`, err);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Build the initial user turn with file references + prompt text.
 */
export function buildFilePromptTurn(
  files: Array<{ uri: string; mimeType: string }>,
  promptText: string,
): ContentTurn {
  const parts: ContentPart[] = [
    ...files.map((f) => ({ fileData: { fileUri: f.uri, mimeType: f.mimeType } })),
    { text: promptText },
  ];
  return { role: 'user', parts };
}
