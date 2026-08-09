import type { ChatMessage, Provider } from './types';
import { streamGenerateContent } from './gemini';
import { streamOpenRouter } from './openrouter';

interface StreamChatOptions {
  provider: Provider;
  apiKey: string;
  contents: ChatMessage[];
  systemInstruction?: string;
  model?: string;
  signal?: AbortSignal;
}

/**
 * Unified streaming interface that delegates to the correct provider.
 * Yields text chunks as they arrive from the model.
 */
export async function* streamChat({
  provider,
  ...rest
}: StreamChatOptions): AsyncGenerator<string, void, unknown> {
  if (provider === 'openrouter') {
    yield* streamOpenRouter(rest);
  } else {
    yield* streamGenerateContent(rest);
  }
}
