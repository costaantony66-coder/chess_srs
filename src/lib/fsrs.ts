import { createEmptyCard, fsrs, generatorParameters, Rating, type Card as FsrsCard, type Grade } from 'ts-fsrs';

export type RatingId = 'again' | 'hard' | 'good' | 'easy';

const GRADE: Record<RatingId, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

/** Planificateur FSRS (rétention cible 90 %). */
export const scheduler = fsrs(generatorParameters({ enable_fuzz: true, request_retention: 0.9 }));

export const newFsrsCard = (now = new Date()): FsrsCard => createEmptyCard(now);

export function schedule(card: FsrsCard, rating: RatingId, now: Date) {
  return scheduler.next(card, now, GRADE[rating]);
}

export function formatDelay(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return '<1 min';
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} j`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} mois`;
  return `${Math.round((d / 365) * 10) / 10} an`;
}

/** Délai avant la prochaine révision pour chacune des 4 notes. */
export function previewIntervals(card: FsrsCard, now: Date): Record<RatingId, string> {
  const rec = scheduler.repeat(card, now);
  const at = (g: Grade) => formatDelay(rec[g].card.due.getTime() - now.getTime());
  return { again: at(Rating.Again), hard: at(Rating.Hard), good: at(Rating.Good), easy: at(Rating.Easy) };
}
