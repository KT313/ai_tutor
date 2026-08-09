import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { SettingsPanel } from './SettingsPanel';
import { UploadForm } from './UploadForm';

interface ContentSummary {
  id: string;
  language: string;
  title: string;
}

const languageLabels: Record<string, string> = {
  de: 'Deutsch',
  en: 'English',
  ko: '한국어',
};

export function ContentPicker() {
  const { locale } = useApp();
  const ui = locale.ui;
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetch('/api/contents')
      .then((r) => r.json())
      .then((data: ContentSummary[]) => setItems(data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const pick = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('content', id);
    window.location.href = url.toString();
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#f3f3f3] border-t-brand" />
      </div>
    );
  }

  return (
    <div className="px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand">{ui.selectContent}</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowUpload(!showUpload)}
            className="cursor-pointer rounded-lg border border-accent-blue bg-transparent px-4 py-2 text-sm font-medium text-accent-blue transition-all hover:bg-accent-blue hover:text-white"
          >
            {ui.generateContent}
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={`cursor-pointer rounded-lg border p-2 transition-colors ${
              showSettings
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-[#ced4da] bg-white text-[#495057] hover:bg-gray-50'
            }`}
            aria-label={ui.settingsTitle}
            title={ui.settingsTitle}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <LanguageSwitcher />
        </div>
      </div>

      {showSettings && (
        <div className="mb-8">
          <SettingsPanel onClose={() => setShowSettings(false)} />
        </div>
      )}

      {showUpload && (
        <div className="mb-8">
          <UploadForm onClose={() => setShowUpload(false)} />
        </div>
      )}

      {items.length === 0 && !showUpload ? (
        <div className="mt-16 text-center text-lg text-gray-500">
          {ui.noContent}
        </div>
      ) : (
        <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pick(item.id)}
              className="cursor-pointer rounded-xl border border-surface-cardBorder bg-white p-6 text-left shadow-card transition-shadow hover:shadow-cardHover"
            >
              <div className="text-lg font-bold text-brand">{item.title}</div>
              <div className="mt-1 text-sm text-gray-500">
                {languageLabels[item.language] ?? item.language}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
