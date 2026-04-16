import type { ChatMessage } from './types';

export interface PersistedHistory {
  chatHistory: ChatMessage[];
  conversation: ConversationEntry[];
  modalState: { currentQuestion: string };
  updatedAt: number;
}

export interface ConversationEntry {
  kind: 'question' | 'userAnswer' | 'evaluation' | 'userFollowUp' | 'tutorAnswer';
  text: string;
}

export async function loadHistory(
  contentId: string,
  topicSlug: string,
): Promise<PersistedHistory | null> {
  const res = await fetch(`/api/histories/${encodeURIComponent(contentId)}/${encodeURIComponent(topicSlug)}`);
  if (!res.ok) return null;
  return res.json();
}

export interface SaveResult {
  ok: boolean;
  updatedAt?: number;
  conflict?: boolean;
}

export async function saveHistory(
  contentId: string,
  topicSlug: string,
  data: {
    chatHistory: ChatMessage[];
    conversation: ConversationEntry[];
    modalState: { currentQuestion: string };
    updatedAt: number | null;
  },
): Promise<SaveResult> {
  const res = await fetch(
    `/api/histories/${encodeURIComponent(contentId)}/${encodeURIComponent(topicSlug)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (res.status === 409) {
    return { ok: false, conflict: true };
  }
  if (!res.ok) return { ok: false };
  const json = await res.json();
  return { ok: true, updatedAt: json.updatedAt };
}

export async function deleteHistory(
  contentId: string,
  topicSlug: string,
): Promise<void> {
  await fetch(
    `/api/histories/${encodeURIComponent(contentId)}/${encodeURIComponent(topicSlug)}`,
    { method: 'DELETE' },
  );
}

export async function loadDraft(contentId: string, topicSlug: string): Promise<string> {
  try {
    const res = await fetch(`/api/drafts/${encodeURIComponent(contentId)}/${encodeURIComponent(topicSlug)}`);
    if (!res.ok) return '';
    const json = await res.json();
    return json.text ?? json.answer ?? '';
  } catch {
    return '';
  }
}

export async function saveDraft(
  contentId: string,
  topicSlug: string,
  text: string,
): Promise<void> {
  await fetch(
    `/api/drafts/${encodeURIComponent(contentId)}/${encodeURIComponent(topicSlug)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    },
  ).catch(() => {
    // Best-effort — draft loss is acceptable.
  });
}
