import { useCallback, useState } from 'react';
import { ApiKeyBar } from './components/ApiKeyBar';
import { CardGrid } from './components/CardGrid';
import { TutorModal } from './components/TutorModal';
import { AppProvider } from './context/AppContext';
import { buildTutorContext } from './lib/tutorContext';
import type { Card, ContentFile } from './lib/types';
import germanBwl from '../content/german_bwl.json';

const content = germanBwl as ContentFile;

interface ActiveTutor {
  topic: string;
  context: string;
}

function AppBody() {
  const [active, setActive] = useState<ActiveTutor | null>(null);

  const openTutor = useCallback((card: Card) => {
    setActive({
      topic: card.title.string,
      context: buildTutorContext(card),
    });
  }, []);

  const closeTutor = useCallback(() => setActive(null), []);

  return (
    <main className="mx-auto max-w-[1800px]">
      <ApiKeyBar />
      <CardGrid cards={content.cards} onAskTutor={openTutor} />
      {active && (
        <TutorModal topic={active.topic} context={active.context} onClose={closeTutor} />
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
