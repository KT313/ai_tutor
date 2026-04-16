import type { Card as CardType } from '../lib/types';
import { Card } from './Card';

interface CardGridProps {
  cards: CardType[];
  onAskTutor: (card: CardType) => void;
}

export function CardGrid({ cards, onAskTutor }: CardGridProps) {
  return (
    <div className="columns-1 gap-5 md:columns-2 lg:columns-3">
      {cards.map((card, idx) => (
        <Card key={`${idx}-${card.title.string}`} card={card} onAskTutor={onAskTutor} />
      ))}
    </div>
  );
}
