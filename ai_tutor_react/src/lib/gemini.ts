import type { ChatMessage } from './types';

export const GEMINI_MODEL = 'gemini-3-flash-preview';

interface StreamOptions {
  apiKey: string;
  contents: ChatMessage[];
  systemInstruction?: string;
  model?: string;
  signal?: AbortSignal;
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

/**
 * Extract complete JSON objects from a streaming buffer using brace counting.
 * The Gemini streamGenerateContent endpoint (without alt=sse) returns a JSON
 * array whose elements arrive incrementally:
 *
 *   [{...}\n,{...}\n,{...}\n]
 *
 * We scan for top-level `{…}` objects, handling string escapes so that braces
 * inside JSON strings don't break the count.
 */
function* extractJsonObjects(buf: string): Generator<[object: unknown, consumed: number]> {
  let i = 0;

  while (i < buf.length) {
    // Skip until we find the opening brace of an object.
    if (buf[i] !== '{') {
      i++;
      continue;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;
    let j = i;

    for (; j < buf.length; j++) {
      const ch = buf[j];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          // Complete object found from i..j (inclusive).
          const slice = buf.slice(i, j + 1);
          try {
            yield [JSON.parse(slice), j + 1];
          } catch {
            // Malformed — skip this opening brace and keep scanning.
          }
          i = j + 1;
          break;
        }
      }
    }

    // If we exited the inner loop without closing all braces, the object is
    // incomplete — stop and let the caller accumulate more data.
    if (depth > 0) return;
  }
}

export async function* streamGenerateContent({
  apiKey,
  contents,
  systemInstruction,
  model = GEMINI_MODEL,
  signal,
}: StreamOptions): AsyncGenerator<string, void, unknown> {
  if (!apiKey) {
    throw new GeminiError('No API key configured.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${encodeURIComponent(apiKey)}`;

  const body: Record<string, unknown> = { contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new GeminiError(
      `Gemini API returned ${res.status}${errText ? `: ${errText.slice(0, 300)}` : ''}`,
      res.status,
    );
  }

  if (!res.body) {
    throw new GeminiError('Empty response body from Gemini.');
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;

      let lastConsumed = 0;
      for (const [obj, consumed] of extractJsonObjects(buffer)) {
        // Each JSON object has shape: { candidates: [{ content: { parts: [{ text }] } }] }
        const parts = (obj as Record<string, unknown[]>)?.candidates?.[0];
        const content = (parts as Record<string, unknown> | undefined)?.content;
        const textParts = (content as Record<string, unknown[]> | undefined)?.parts;
        if (Array.isArray(textParts)) {
          for (const part of textParts) {
            const text = (part as Record<string, unknown>)?.text;
            if (typeof text === 'string') yield text;
          }
        }
        lastConsumed = consumed;
      }
      if (lastConsumed > 0) {
        buffer = buffer.slice(lastConsumed);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
