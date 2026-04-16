import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { ChatMessage } from '../lib/types';
import { streamGenerateContent } from '../lib/gemini';
import {
  evaluationPrompt,
  firstQuestionTemplate,
  newQuestionRequest,
  optionalInstruction,
  systemPromptInfo,
  uiStrings,
} from '../lib/tutorPrompts';
import { useApp } from '../context/AppContext';
import { Markdown } from './Markdown';

interface TutorModalProps {
  topic: string;
  context: string;
  onClose: () => void;
}

type Entry =
  | { kind: 'question'; text: string }
  | { kind: 'userAnswer'; text: string }
  | { kind: 'evaluation'; text: string }
  | { kind: 'userFollowUp'; text: string }
  | { kind: 'tutorAnswer'; text: string };

type Mode = 'loading' | 'awaitingAnswer' | 'showingEvaluation';

interface State {
  mode: Mode;
  chatHistory: ChatMessage[];
  currentQuestion: string;
  conversation: Entry[];
  streamBuffer: string;
  error: string | null;
}

type Action =
  | { type: 'LOAD_START' }
  | { type: 'STREAM_APPEND'; chunk: string }
  | { type: 'QUESTION_COMPLETE'; userTurn: string; modelText: string; resetConversation: boolean }
  | { type: 'EVALUATION_COMPLETE'; modelText: string; answer: string }
  | { type: 'FOLLOW_UP_SENT'; text: string }
  | { type: 'FOLLOW_UP_COMPLETE'; modelText: string }
  | { type: 'ERROR'; message: string }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'REMOVE_LAST' }
  | { type: 'DISMISS_ERROR' };

const initialState: State = {
  mode: 'loading',
  chatHistory: [],
  currentQuestion: '',
  conversation: [],
  streamBuffer: '',
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, mode: 'loading', streamBuffer: '', error: null };

    case 'STREAM_APPEND':
      return { ...state, streamBuffer: state.streamBuffer + action.chunk };

    case 'QUESTION_COMPLETE':
      return {
        ...state,
        mode: 'awaitingAnswer',
        currentQuestion: action.modelText,
        chatHistory: [
          ...state.chatHistory,
          { role: 'user', parts: [{ text: action.userTurn }] },
          { role: 'model', parts: [{ text: action.modelText }] },
        ],
        conversation: action.resetConversation ? [] : state.conversation,
        streamBuffer: '',
        error: null,
      };

    case 'EVALUATION_COMPLETE':
      return {
        ...state,
        mode: 'showingEvaluation',
        chatHistory: [
          ...state.chatHistory,
          { role: 'user', parts: [{ text: action.answer }] },
          { role: 'model', parts: [{ text: action.modelText }] },
        ],
        conversation: [
          ...state.conversation,
          { kind: 'question', text: state.currentQuestion },
          { kind: 'userAnswer', text: action.answer },
          { kind: 'evaluation', text: action.modelText },
        ],
        streamBuffer: '',
        error: null,
      };

    case 'FOLLOW_UP_SENT':
      return {
        ...state,
        chatHistory: [...state.chatHistory, { role: 'user', parts: [{ text: action.text }] }],
        conversation: [...state.conversation, { kind: 'userFollowUp', text: action.text }],
        streamBuffer: '',
      };

    case 'FOLLOW_UP_COMPLETE':
      return {
        ...state,
        mode: 'showingEvaluation',
        chatHistory: [
          ...state.chatHistory,
          { role: 'model', parts: [{ text: action.modelText }] },
        ],
        conversation: [...state.conversation, { kind: 'tutorAnswer', text: action.modelText }],
        streamBuffer: '',
      };

    case 'ERROR':
      return { ...state, error: action.message, streamBuffer: '' };

    case 'CLEAR_HISTORY':
      return { ...initialState };

    case 'REMOVE_LAST': {
      const hist = [...state.chatHistory];
      while (hist.length && hist[hist.length - 1].role === 'model') hist.pop();
      while (hist.length && hist[hist.length - 1].role === 'user') hist.pop();

      const convo = [...state.conversation];
      if (convo.at(-1)?.kind === 'tutorAnswer') {
        convo.pop();
        if (convo.at(-1)?.kind === 'userFollowUp') convo.pop();
      } else if (convo.at(-1)?.kind === 'evaluation') {
        convo.pop();
        if (convo.at(-1)?.kind === 'userAnswer') convo.pop();
        if (convo.at(-1)?.kind === 'question') convo.pop();
      }
      return { ...state, chatHistory: hist, conversation: convo };
    }

    case 'DISMISS_ERROR':
      return { ...state, error: null };

    default:
      return state;
  }
}

export function TutorModal({ topic, context, onClose }: TutorModalProps) {
  const { apiKey, optionalInstruction: optInstr } = useApp();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [answerDraft, setAnswerDraft] = useState('');
  const [followUpDraft, setFollowUpDraft] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const systemInstruction = useCallback((): string => {
    const suffix = optInstr ? `\n${optionalInstruction}` : '';
    return `${systemPromptInfo}\n\nKontext zum Thema:\n${context}${suffix}`;
  }, [context, optInstr]);

  const runStream = useCallback(
    async (
      contents: ChatMessage[],
      onComplete: (fullText: string) => void,
    ): Promise<void> => {
      if (!apiKey) {
        dispatch({ type: 'ERROR', message: uiStrings.errorNoApiKey });
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      dispatch({ type: 'LOAD_START' });

      try {
        let full = '';
        for await (const chunk of streamGenerateContent({
          apiKey,
          systemInstruction: systemInstruction(),
          contents,
          signal: controller.signal,
        })) {
          full += chunk;
          dispatch({ type: 'STREAM_APPEND', chunk });
        }
        if (controller.signal.aborted) return;
        onComplete(full);
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : String(err);
        dispatch({ type: 'ERROR', message: `${uiStrings.errorPrefix}: ${msg}` });
      }
    },
    [apiKey, systemInstruction],
  );

  const askForQuestion = useCallback(
    async (existing: ChatMessage[], resetConversation: boolean): Promise<void> => {
      const userTurn =
        existing.length === 0 ? firstQuestionTemplate(topic) : newQuestionRequest;
      const contents: ChatMessage[] = [
        ...existing,
        { role: 'user', parts: [{ text: userTurn }] },
      ];
      await runStream(contents, (modelText) => {
        dispatch({
          type: 'QUESTION_COMPLETE',
          userTurn,
          modelText,
          resetConversation,
        });
      });
    },
    [runStream, topic],
  );

  useEffect(() => {
    void askForQuestion([], true);
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitAnswer = async (): Promise<void> => {
    const answer = answerDraft.trim();
    if (!answer) {
      dispatch({ type: 'ERROR', message: uiStrings.errorEmptyAnswer });
      return;
    }
    // Transient user turn for the Gemini call: bare answer + evaluation rubric.
    // Only the bare answer is persisted to chatHistory (via EVALUATION_COMPLETE),
    // so future turns don't re-send the rubric.
    const transientContents: ChatMessage[] = [
      ...state.chatHistory,
      { role: 'user', parts: [{ text: `${answer}\n\n${evaluationPrompt}` }] },
    ];
    await runStream(transientContents, (modelText) => {
      dispatch({ type: 'EVALUATION_COMPLETE', modelText, answer });
      setAnswerDraft('');
    });
  };

  const sendFollowUp = async (): Promise<void> => {
    const q = followUpDraft.trim();
    if (!q) {
      dispatch({ type: 'ERROR', message: uiStrings.errorEmptyFollowUp });
      return;
    }
    dispatch({ type: 'FOLLOW_UP_SENT', text: q });
    setFollowUpDraft('');

    const contents: ChatMessage[] = [
      ...state.chatHistory,
      { role: 'user', parts: [{ text: q }] },
    ];
    await runStream(contents, (modelText) => {
      dispatch({ type: 'FOLLOW_UP_COMPLETE', modelText });
    });
  };

  const newQuestion = () => {
    void askForQuestion(state.chatHistory, true);
  };

  const clearHistory = () => {
    if (!window.confirm(uiStrings.confirmClearHistory)) return;
    abortRef.current?.abort();
    dispatch({ type: 'CLEAR_HISTORY' });
    void askForQuestion([], true);
  };

  const removeLast = () => {
    dispatch({ type: 'REMOVE_LAST' });
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleAnswerKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void submitAnswer();
    }
  };

  const streaming = state.mode === 'loading' && state.streamBuffer.length > 0;
  const showLoader = state.mode === 'loading' && state.streamBuffer.length === 0;

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
    >
      <div className="max-h-[90vh] w-[90%] max-w-[36vw] overflow-hidden rounded-xl bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
        <div className="mb-5 flex items-center justify-between border-b border-surface-cardBorder pb-2">
          <h4 className="m-0 text-[16pt] font-bold text-brand">
            {uiStrings.tutorModalTitle}: {topic}
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border-0 bg-transparent text-[28px] font-bold text-[#aaa] transition-colors hover:text-[#333]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="max-h-[75vh] min-h-[60vh] overflow-y-auto pr-3">
          {state.error && (
            <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-[#f5c6cb] bg-[#f8d7da] p-3 text-[#721c24]">
              <span>{state.error}</span>
              <button
                type="button"
                onClick={() => dispatch({ type: 'DISMISS_ERROR' })}
                className="cursor-pointer border-0 bg-transparent font-bold text-[#721c24]"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          {showLoader && (
            <div className="mx-auto my-5 h-10 w-10 animate-spin rounded-full border-4 border-[#f3f3f3] border-t-brand" />
          )}

          {streaming && (
            <div className="mb-4 rounded border-l-4 border-accent-blue bg-[#e9f7ff] p-4 font-medium">
              <Markdown text={state.streamBuffer} />
            </div>
          )}

          {state.mode === 'awaitingAnswer' && (
            <>
              <div className="mb-4 max-h-[55vh] overflow-y-auto rounded border-l-4 border-accent-blue bg-[#e9f7ff] p-4 font-medium">
                <Markdown text={state.currentQuestion} />
              </div>
              <textarea
                value={answerDraft}
                onChange={(e) => setAnswerDraft(e.target.value)}
                onKeyDown={handleAnswerKey}
                placeholder={uiStrings.answerPlaceholder}
                className="mb-4 block h-32 w-full resize-y rounded-lg border border-[#ccc] p-3 font-sans text-[10pt]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={submitAnswer}
                  className="cursor-pointer rounded-lg border-0 bg-accent-green px-3 py-2 text-sm text-white transition-colors hover:bg-accent-greenDark"
                >
                  {uiStrings.submitAnswer}
                </button>
              </div>
            </>
          )}

          {state.mode === 'showingEvaluation' && (
            <>
              <div className="mt-2 max-h-[55vh] overflow-y-auto rounded-lg border border-surface-cardBorder bg-surface-page p-4">
                {state.conversation.map((entry, i) => (
                  <ConversationMessage key={i} entry={entry} />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={newQuestion}
                  className="cursor-pointer rounded-lg border-0 bg-accent-blue px-3 py-2 text-sm text-white transition-colors hover:bg-accent-blueDark"
                >
                  {uiStrings.newQuestion}
                </button>
                <button
                  type="button"
                  onClick={removeLast}
                  className="cursor-pointer rounded-lg border-0 bg-[#6c757d] px-3 py-2 text-sm text-white transition-colors hover:bg-[#5a6268]"
                >
                  {uiStrings.removeLast}
                </button>
                <button
                  type="button"
                  onClick={clearHistory}
                  className="cursor-pointer rounded-lg border-0 bg-[#dc3545] px-3 py-2 text-sm text-white transition-colors hover:bg-[#c82333]"
                >
                  {uiStrings.clearHistory}
                </button>
              </div>
              <div className="mt-4">
                <textarea
                  value={followUpDraft}
                  onChange={(e) => setFollowUpDraft(e.target.value)}
                  placeholder={uiStrings.followUpPlaceholder}
                  className="mb-2 block h-20 w-full resize-y rounded-lg border border-[#ccc] p-3 font-sans text-[10pt]"
                />
                <button
                  type="button"
                  onClick={sendFollowUp}
                  className="cursor-pointer rounded-lg border-0 bg-[#17a2b8] px-4 py-2 font-bold text-white transition-colors hover:bg-[#138496]"
                >
                  {uiStrings.sendFollowUp}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ConversationMessage({ entry }: { entry: Entry }) {
  const label = (
    {
      question: uiStrings.labelQuestion,
      userAnswer: uiStrings.labelYourAnswer,
      evaluation: uiStrings.labelEvaluation,
      userFollowUp: uiStrings.labelYourQuestion,
      tutorAnswer: uiStrings.labelTutorAnswer,
    } as const
  )[entry.kind];

  const tone: Record<Entry['kind'], string> = {
    question: 'border-l-4 border-accent-blue bg-[#e9f7ff]',
    userAnswer: 'border-l-4 border-[#ffc107] bg-[#fff3cd]',
    evaluation: 'border-l-4 border-[#6c757d] bg-white',
    userFollowUp: 'border-l-4 border-[#ffc107] bg-[#fff3cd]',
    tutorAnswer: 'border-l-4 border-[#6c757d] bg-white',
  };

  return (
    <div className={`mb-4 rounded-lg p-3 ${tone[entry.kind]}`}>
      <div className="mb-1 font-bold text-[#495057]">{label}</div>
      <Markdown text={entry.text} />
    </div>
  );
}
