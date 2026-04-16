import { useCallback, useState } from 'react';
import { ApiKeyBar } from './components/ApiKeyBar';
import { CardGrid } from './components/CardGrid';
import { TutorModal } from './components/TutorModal';
import { AppProvider } from './context/AppContext';
import { buildTutorContext } from './lib/tutorContext';
import { topicSlug } from './lib/slug';
import type { Card, ContentFile } from './lib/types';
import germanBwl from '../content/german_bwl.json';

const content = germanBwl as ContentFile;

interface ActiveTutor {
  topic: string;
  context: string;
  topicSlug: string;
}

function AppBody() {
  const [active, setActive] = useState<ActiveTutor | null>(null);

  const openTutor = useCallback((card: Card) => {
    setActive({
      topic: card.title.string,
      context: buildTutorContext(card),
      topicSlug: topicSlug(card.title.string),
    });
  }, []);

  const closeTutor = useCallback(() => setActive(null), []);

  return (
    <main className="mx-auto max-w-[1800px]">
      <ApiKeyBar />
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
