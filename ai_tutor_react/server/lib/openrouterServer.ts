/**
 * Server-side OpenRouter API helpers for the PDF→content pipeline.
 * Uses the OpenAI-compatible chat completions API with base64 PDF support
 * and cache_control for prompt caching on supported providers.
 */

const BASE = 'https://openrouter.ai/api/v1';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

interface ContentPart {
  type: 'text' | 'file';
  text?: string;
  file?: { filename: string; file_data: string };
  cache_control?: { type: 'ephemeral' };
}

/**
 * Call OpenRouter chat completions (non-streaming) and return the full text.
 * Uses a generous timeout since PDF analysis can take a while.
 */
export async function generateContentOpenRouter(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  const url = `${BASE}/chat/completions`;
  const turnCount = messages.length;
  const lastRole = messages[turnCount - 1]?.role ?? '?';
  console.log(`[openrouter] Calling model=${model}, turns=${turnCount}, lastRole=${lastRole}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000); // 5 min
  const startTime = Date.now();

  try {
    const body: Record<string, unknown> = { model, messages };
    // Enable automatic prefix caching for Anthropic models.
    // This tells OpenRouter to cache the prompt prefix, making follow-up
    // turns in the same conversation significantly cheaper.
    if (model.includes('anthropic/') || model.includes('claude')) {
      body.cache_control = { type: 'ephemeral' };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[openrouter] Failed (${res.status}) after ${elapsed}s: ${text.slice(0, 500)}`);
      throw new Error(`OpenRouter API error (${res.status}): ${text.slice(0, 500)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{
        message?: { content?: string };
        finish_reason?: string;
      }>;
      error?: { message?: string };
    };

    if (data.error?.message) {
      console.error(`[openrouter] API error after ${elapsed}s: ${data.error.message}`);
      throw new Error(`OpenRouter API error: ${data.error.message}`);
    }

    const choice = data.choices?.[0];
    const finishReason = choice?.finish_reason ?? 'unknown';
    const text = choice?.message?.content ?? '';

    if (!text) {
      console.error(`[openrouter] Empty response after ${elapsed}s (finish_reason: ${finishReason})`);
      throw new Error(`Empty response from OpenRouter (finish_reason: ${finishReason}).`);
    }

    console.log(`[openrouter] OK after ${elapsed}s — ${text.length} chars, finish_reason=${finishReason}`);
    console.debug(`[openrouter] Response preview: ${text.slice(0, 200)}...`);
    return text;
  } catch (err) {
    if (
      (err as Error).message.startsWith('OpenRouter API error') ||
      (err as Error).message.startsWith('Empty response')
    )
      throw err;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[openrouter] Error after ${elapsed}s:`, err);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Build the initial user turn with base64 PDF files + prompt text.
 * Adds cache_control on the prompt text so repeated calls with the
 * same prompt (but different PDFs) benefit from caching.
 */
export function buildPdfPromptMessage(
  pdfBuffers: Array<{ buffer: Buffer; name: string }>,
  promptText: string,
): ChatMessage {
  const parts: ContentPart[] = [];

  for (const pdf of pdfBuffers) {
    parts.push({
      type: 'file',
      file: {
        filename: pdf.name,
        file_data: `data:application/pdf;base64,${pdf.buffer.toString('base64')}`,
      },
    });
  }

  parts.push({
    type: 'text',
    text: promptText,
    cache_control: { type: 'ephemeral' },
  });

  return { role: 'user', content: parts };
}

/**
 * Build a simple text message with optional cache_control.
 */
export function buildTextMessage(
  role: 'user' | 'assistant',
  text: string,
  cache?: boolean,
): ChatMessage {
  if (cache) {
    return {
      role,
      content: [{ type: 'text', text, cache_control: { type: 'ephemeral' } }],
    };
  }
  return { role, content: text };
}
