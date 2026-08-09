import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { detectLocale, getLocale, type Locale, type LocaleKey } from '../lib/i18n';
import type { Provider } from '../lib/types';

const GEMINI_KEY_STORAGE = 'geminiApiKey';
const OPENROUTER_KEY_STORAGE = 'openrouterApiKey';
const PROVIDER_STORAGE = 'apiProvider';
const TUTOR_MODEL_STORAGE = 'tutorModel';
const OPTIONAL_INSTRUCTION_STORAGE = 'optionalInstructionEnabled';
const UI_LANGUAGE_STORAGE = 'uiLanguage';

export interface ModelPreset {
  id: string;
  label: string;
}

export const GOOGLE_MODELS: ModelPreset[] = [
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
];

export const OPENROUTER_MODELS: ModelPreset[] = [
  { id: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
  { id: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { id: 'anthropic/claude-opus-4.7', label: 'Claude Opus 4.7' },
];

export const DEFAULT_MODELS: Record<Provider, string> = {
  google: 'gemini-3-flash-preview',
  openrouter: 'google/gemini-3.1-pro-preview',
};

export const DEFAULT_GENERATE_MODELS: Record<Provider, string> = {
  google: 'gemini-2.5-flash',
  openrouter: 'google/gemini-2.5-flash',
};

interface AppContextValue {
  provider: Provider;
  setProvider: (p: Provider) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  tutorModel: string;
  setTutorModel: (model: string) => void;
  optionalInstruction: boolean;
  setOptionalInstruction: (enabled: boolean) => void;
  uiLanguage: LocaleKey;
  setUiLanguage: (lang: LocaleKey) => void;
  locale: Locale;
}

const AppContext = createContext<AppContextValue | null>(null);

function readStored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // localStorage may be unavailable (private mode); ignore silently.
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [provider, setProviderState] = useState<Provider>(() => {
    const stored = readStored(PROVIDER_STORAGE, 'google');
    return stored === 'openrouter' ? 'openrouter' : 'google';
  });
  const [geminiKey, setGeminiKeyState] = useState(() => readStored(GEMINI_KEY_STORAGE, ''));
  const [openrouterKey, setOpenrouterKeyState] = useState(() => readStored(OPENROUTER_KEY_STORAGE, ''));
  const [tutorModel, setTutorModelState] = useState(() => readStored(TUTOR_MODEL_STORAGE, ''));
  const [optionalInstruction, setOptionalInstructionState] = useState<boolean>(
    () => readStored(OPTIONAL_INSTRUCTION_STORAGE, 'false') === 'true',
  );
  const [uiLanguage, setUiLanguageState] = useState<LocaleKey>(() => {
    const stored = readStored(UI_LANGUAGE_STORAGE, '');
    if (stored === 'de' || stored === 'en' || stored === 'ja' || stored === 'ko') return stored;
    return detectLocale();
  });

  // Computed: active API key for current provider
  const apiKey = provider === 'openrouter' ? openrouterKey : geminiKey;

  const setProvider = useCallback((p: Provider) => {
    setProviderState(p);
    writeStored(PROVIDER_STORAGE, p);
  }, []);

  const setApiKey = useCallback((key: string) => {
    if (provider === 'openrouter') {
      setOpenrouterKeyState(key);
      writeStored(OPENROUTER_KEY_STORAGE, key);
    } else {
      setGeminiKeyState(key);
      writeStored(GEMINI_KEY_STORAGE, key);
    }
  }, [provider]);

  const setTutorModel = useCallback((model: string) => {
    setTutorModelState(model);
    writeStored(TUTOR_MODEL_STORAGE, model);
  }, []);

  const setOptionalInstruction = useCallback((enabled: boolean) => {
    setOptionalInstructionState(enabled);
    writeStored(OPTIONAL_INSTRUCTION_STORAGE, enabled ? 'true' : 'false');
  }, []);

  const setUiLanguage = useCallback((lang: LocaleKey) => {
    setUiLanguageState(lang);
    writeStored(UI_LANGUAGE_STORAGE, lang);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === GEMINI_KEY_STORAGE) setGeminiKeyState(e.newValue ?? '');
      if (e.key === OPENROUTER_KEY_STORAGE) setOpenrouterKeyState(e.newValue ?? '');
      if (e.key === PROVIDER_STORAGE) {
        const v = e.newValue;
        if (v === 'google' || v === 'openrouter') setProviderState(v);
      }
      if (e.key === TUTOR_MODEL_STORAGE) setTutorModelState(e.newValue ?? '');
      if (e.key === OPTIONAL_INSTRUCTION_STORAGE)
        setOptionalInstructionState(e.newValue === 'true');
      if (e.key === UI_LANGUAGE_STORAGE) {
        const v = e.newValue;
        if (v === 'de' || v === 'en' || v === 'ja' || v === 'ko') setUiLanguageState(v);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const locale = useMemo(() => getLocale(uiLanguage), [uiLanguage]);

  // Effective tutor model: stored value or provider default
  const effectiveTutorModel = tutorModel || DEFAULT_MODELS[provider];

  const value = useMemo<AppContextValue>(
    () => ({
      provider, setProvider,
      apiKey, setApiKey,
      tutorModel: effectiveTutorModel, setTutorModel,
      optionalInstruction, setOptionalInstruction,
      uiLanguage, setUiLanguage, locale,
    }),
    [provider, setProvider, apiKey, setApiKey, effectiveTutorModel, setTutorModel, optionalInstruction, setOptionalInstruction, uiLanguage, setUiLanguage, locale],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within an AppProvider.');
  return ctx;
}
