import deLocale from '../../locales/de.json';
import enLocale from '../../locales/en.json';
import jaLocale from '../../locales/ja.json';
import koLocale from '../../locales/ko.json';

export type LocaleKey = 'de' | 'en' | 'ja' | 'ko';

export interface Locale {
  ui: Record<string, string>;
  tutor: {
    systemPromptInfo: string;
    optionalInstruction: string;
    firstQuestionTemplate: string;
    newQuestionRequest: string;
    evaluationPrompt: string;
    contextLabels: {
      theme: string;
      overview: string;
      bulletPoints: string;
      tutorHint: string;
    };
  };
}

const locales: Record<LocaleKey, Locale> = {
  de: deLocale as Locale,
  en: enLocale as Locale,
  ja: jaLocale as Locale,
  ko: koLocale as Locale,
};

export const supportedLocales: { key: LocaleKey; label: string }[] = [
  { key: 'de', label: 'Deutsch' },
  { key: 'en', label: 'English' },
  { key: 'ja', label: '日本語' },
  { key: 'ko', label: '한국어' },
];

export function getLocale(key: LocaleKey): Locale {
  return locales[key] ?? locales.en;
}

/** Detect best locale from browser language, falling back to 'en'. */
export function detectLocale(): LocaleKey {
  try {
    const lang = navigator.language.slice(0, 2).toLowerCase();
    if (lang in locales) return lang as LocaleKey;
  } catch {
    // SSR or restricted environment
  }
  return 'en';
}
