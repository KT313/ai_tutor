export interface ContentItem {
  string: string;
  tooltip?: string;
  verbose_tutor_info?: string;
}

export interface CardTitle extends ContentItem {
  extra_class?: string;
}

export interface Card {
  title: CardTitle;
  content: ContentItem[][];
}

export interface ContentFile {
  id: string;
  language: string;
  title: string;
  cards: Card[];
}

export type ChatRole = 'user' | 'model';

export interface ChatMessage {
  role: ChatRole;
  parts: { text: string }[];
}

export type ModalMode =
  | 'loading'
  | 'awaitingAnswer'
  | 'showingEvaluation'
  | 'followUp';

export interface ModalState {
  mode: ModalMode;
  currentQuestion: string;
}
