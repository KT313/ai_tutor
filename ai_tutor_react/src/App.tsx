import { useCallback, useEffect, useState } from 'react';
import { CardGrid } from './components/CardGrid';
import { ContentPicker } from './components/ContentPicker';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { SettingsPanel } from './components/SettingsPanel';
import { TutorModal } from './components/TutorModal';
import { AppProvider, useApp } from './context/AppContext';
import { buildTutorContext } from './lib/tutorContext';
import { topicSlug } from './lib/slug';
import type { Card, ContentFile } from './lib/types';

interface ActiveTutor {
  topic: string;
  context: string;
  topicSlug: string;
}

function SettingsGear({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`cursor-pointer rounded-lg border p-2 transition-colors ${
        open
          ? 'border-brand bg-brand/10 text-brand'
          : 'border-[#ced4da] bg-white text-[#495057] hover:bg-gray-50'
      }`}
      aria-label={label}
      title={label}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );
}

function AppBody() {
  const { locale } = useApp();
  const ui = locale.ui;
  const contentId = new URLSearchParams(window.location.search).get('content');
  const [content, setContent] = useState<ContentFile | null>(null);
  const [loading, setLoading] = useState(!!contentId);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveTutor | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!contentId) return;
    setLoading(true);
    fetch(`/api/contents/${encodeURIComponent(contentId)}`)
      .then((r) => {
        if (!r.ok) throw new Error(ui.contentNotFound);
        return r.json();
      })
      .then((data: ContentFile) => {
        setContent(data);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [contentId, ui.contentNotFound]);

  const openTutor = useCallback((card: Card) => {
    setActive({
      topic: card.title.string,
      context: buildTutorContext(card, locale),
      topicSlug: topicSlug(card.title.string),
    });
  }, [locale]);

  const closeTutor = useCallback(() => setActive(null), []);

  if (!contentId) return <ContentPicker />;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#f3f3f3] border-t-brand" />
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="mt-16 text-center">
        <p className="text-lg text-red-600">{error ?? ui.unknownError}</p>
        <a href="/" className="mt-4 inline-block text-accent-blue underline">
          {ui.backToSelection}
        </a>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-[1800px]">
      <div className="mb-4 flex items-center justify-between px-6 pt-4">
        <div>
          <a href="/" className="text-sm text-accent-blue hover:underline">{ui.backToSelection}</a>
          <h1 className="mt-1 text-xl font-bold text-brand">{content.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <SettingsGear
            open={showSettings}
            onToggle={() => setShowSettings(!showSettings)}
            label={ui.settingsTitle}
          />
          <LanguageSwitcher />
        </div>
      </div>

      {showSettings && (
        <div className="mb-4 px-6">
          <SettingsPanel onClose={() => setShowSettings(false)} />
        </div>
      )}

      <CardGrid cards={content.cards} onAskTutor={openTutor} />
      {active && (
        <TutorModal
          topic={active.topic}
          context={active.context}
          contentId={content.id}
          topicSlug={active.topicSlug}
          onClose={closeTutor}
        />
      )}
    </main>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppBody />
    </AppProvider>
  );
}
