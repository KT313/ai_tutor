import type { ChatMessage } from './types';

interface StreamOptions {
  apiKey: string;
  contents: ChatMessage[];
  systemInstruction?: string;
  model?: string;
  signal?: AbortSignal;
}

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

/**
 * Convert internal Gemini-style messages to OpenRouter/OpenAI format.
 * Adds cache_control on the system message so providers like Anthropic
 * can cache the static system prompt across turns.
 */
function buildMessages(
  contents: ChatMessage[],
  systemInstruction?: string,
): unknown[] {
  const messages: unknown[] = [];

  if (systemInstruction) {
    messages.push({
      role: 'system',
      content: [
        {
          type: 'text',
          text: systemInstruction,
          cache_control: { type: 'ephemeral' },
        },
      ],
    });
  }

  for (const msg of contents) {
    messages.push({
      role: msg.role === 'model' ? 'assistant' : msg.role,
      content: msg.parts.map((p) => p.text).join(''),
    });
  }

  return messages;
}

/**
 * Stream chat completions from OpenRouter (OpenAI-compatible SSE format).
 * Yields text chunks as they arrive.
 */
export async function* streamOpenRouter({
  apiKey,
  contents,
  systemInstruction,
  model = 'google/gemini-2.5-flash',
  signal,
}: StreamOptions): AsyncGenerator<string, void, unknown> {
  if (!apiKey) {
    throw new OpenRouterError('No API key configured.');
  }

  const messages = buildMessages(contents, systemInstruction);

  const body: Record<string, unknown> = { model, messages, stream: true };
  // Enable automatic prefix caching for Anthropic models.
  // Ignored by other providers — safe to always include.
  if (model.includes('anthropic/') || model.includes('claude')) {
    body.cache_control = { type: 'ephemeral' };
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new OpenRouterError(
      `OpenRouter API returned ${res.status}${errText ? `: ${errText.slice(0, 300)}` : ''}`,
      res.status,
    );
  }

  if (!res.body) {
    throw new OpenRouterError('Empty response body from OpenRouter.');
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
            error?: { message?: string };
          };
          if (parsed.error?.message) {
            throw new OpenRouterError(parsed.error.message);
          }
          const content = parsed.choices?.[0]?.delta?.content;
          if (typeof content === 'string') yield content;
        } catch (err) {
          if (err instanceof OpenRouterError) throw err;
          // Ignore malformed SSE frames
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
