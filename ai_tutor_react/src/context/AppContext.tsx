import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const API_KEY_STORAGE = 'geminiApiKey';
const OPTIONAL_INSTRUCTION_STORAGE = 'optionalInstructionEnabled';

interface AppContextValue {
  apiKey: string;
  setApiKey: (key: string) => void;
  optionalInstruction: boolean;
  setOptionalInstruction: (enabled: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function readStored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string>(() => readStored(API_KEY_STORAGE, ''));
  const [optionalInstruction, setOptionalInstructionState] = useState<boolean>(
    () => readStored(OPTIONAL_INSTRUCTION_STORAGE, 'false') === 'true',
  );

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
    try {
      if (key) localStorage.setItem(API_KEY_STORAGE, key);
      else localStorage.removeItem(API_KEY_STORAGE);
    } catch {
      // localStorage may be unavailable (private mode); ignore silently.
    }
  }, []);

  const setOptionalInstruction = useCallback((enabled: boolean) => {
    setOptionalInstructionState(enabled);
    try {
      localStorage.setItem(OPTIONAL_INSTRUCTION_STORAGE, enabled ? 'true' : 'false');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Cross-tab sync so the API key stays in step across duplicate tabs.
    const onStorage = (e: StorageEvent) => {
      if (e.key === API_KEY_STORAGE) setApiKeyState(e.newValue ?? '');
      if (e.key === OPTIONAL_INSTRUCTION_STORAGE)
        setOptionalInstructionState(e.newValue === 'true');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({ apiKey, setApiKey, optionalInstruction, setOptionalInstruction }),
    [apiKey, setApiKey, optionalInstruction, setOptionalInstruction],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within an AppProvider.');
  return ctx;
}
