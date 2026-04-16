import type { Card as CardType, ContentItem } from '../lib/types';
import { uiStrings } from '../lib/tutorPrompts';
import { Tooltip } from './Tooltip';

interface CardProps {
  card: CardType;
  onAskTutor: (card: CardType) => void;
}

function renderItem(item: ContentItem, index: number, variant: 'default' | 'extra') {
  const key = `${index}-${item.string}`;
  if (item.tooltip) {
    return <Tooltip key={key} label={item.string} tooltipHtml={item.tooltip} variant={variant} />;
  }
  return <span key={key}>{item.string}</span>;
}

export function Card({ card, onAskTutor }: CardProps) {
  const isExtra = card.title.extra_class === 'extra-info';
  const variant: 'default' | 'extra' = isExtra ? 'extra' : 'default';

  const headingClasses = isExtra
    ? 'text-[14pt] mt-0 mb-4 pb-2 border-b-2 text-accent-green border-accent-green'
    : 'text-[14pt] mt-0 mb-4 pb-2 border-b-2 text-brand border-brand';

  const bulletClasses = isExtra
    ? 'before:content-["›"] before:absolute before:left-0 before:top-0 before:font-bold before:text-lg before:text-accent-green'
    : 'before:content-["›"] before:absolute before:left-0 before:top-0 before:font-bold before:text-lg before:text-brand';

  return (
    <div className="mb-5 flex break-inside-avoid flex-col rounded-xl border border-surface-cardBorder bg-surface-card p-5 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-cardHover">
      <div className="flex-grow">
        <h3 className={headingClasses}>{card.title.string}</h3>
        <ul className="m-0 list-none p-0">
          {card.content.map((row, rowIdx) => (
            <li key={rowIdx} className={`relative mb-2.5 pl-5 ${bulletClasses}`}>
              {row.map((item, itemIdx) => (
                <span key={itemIdx}>
                  {itemIdx > 0 ? ' ' : ''}
                  {renderItem(item, itemIdx, variant)}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-5 text-right">
        <button
          type="button"
          onClick={() => onAskTutor(card)}
          className="cursor-pointer rounded-lg border border-accent-blue bg-transparent px-3 py-1.5 text-[9.5pt] font-medium text-accent-blue transition-all duration-300 hover:-translate-y-0.5 hover:bg-accent-blue hover:text-white hover:shadow-[0_4px_8px_rgba(0,123,255,0.2)]"
        >
          {uiStrings.askTutor}
        </button>
      </div>
    </div>
  );
}
