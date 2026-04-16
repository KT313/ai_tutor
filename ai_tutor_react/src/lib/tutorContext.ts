import type { Card } from './types';
import { contextLabels } from './tutorPrompts';

export function buildTutorContext(card: Card): string {
  const { theme, overview, bulletPoints, tutorHint } = contextLabels;

  let ctx = `${theme}: ${card.title.string}\n`;
  if (card.title.verbose_tutor_info) {
    ctx += `\n${overview}: ${card.title.verbose_tutor_info}\n`;
  }
  ctx += `\n${bulletPoints}:\n`;

  for (const row of card.content) {
    for (const item of row) {
      if (!item.tooltip) continue;
      ctx += `- ${item.string}: ${item.tooltip}`;
      if (item.verbose_tutor_info) {
        ctx += ` [${tutorHint}: ${item.verbose_tutor_info}]`;
      }
      ctx += '\n';
    }
  }

  return ctx;
}
