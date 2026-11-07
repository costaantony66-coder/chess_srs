import { State } from 'ts-fsrs';
import { db, type StoredCard } from './db';
import { inDeck } from '../lib/decks';
import { schedule, type RatingId } from '../lib/fsrs';
import { getNewPerDay } from '../lib/settings';

export const LEARN_AHEAD_MS = 20 * 60 * 1000;

export interface QueueState {
  cards: StoredCard[];
  counts: { new: number; learning: number; review: number };
  doneToday: number;
  totalCards: number;
  nextDue: number | null;
}

export type Bucket = 'new' | 'learning' | 'review';

/** Dans quelle file la carte se trouve-t-elle maintenant (null : pas à étudier) ? */
export function bucketOf(card: StoredCard, nowMs: number, endOfDayMs: number): Bucket | null {
  if (card.state === State.New) return 'new';
  if (card.state === State.Review) return card.due <= endOfDayMs ? 'review' : null;
  return card.due <= nowMs + LEARN_AHEAD_MS ? 'learning' : null;
}

export const startOfDay = (d: Date) => {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
};
export const endOfDay = (d: Date) => {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
};

/**
 * File du jour d'un paquet (ou de toute la collection si `deck` est absent) :
 * apprentissage + révisions dues aujourd'hui, puis nouvelles cartes (plafonnées par paquet et par jour).
 */
export async function loadQueue(now = new Date(), excludeId?: string, deck?: string): Promise<QueueState> {
  const nowMs = now.getTime();
  const endMs = endOfDay(now).getTime();
  const inScope = (c: StoredCard) => !deck || inDeck(c.deck, deck);

  const [all, today] = await Promise.all([
    db.cards.toArray(),
    db.reviews.where('ts').aboveOrEqual(startOfDay(now).getTime()).toArray(),
  ]);
  const scoped = all.filter(inScope);
  const byId = new Map(all.map((c) => [c.id, c]));

  const newToday = today.filter((r) => r.prevState === State.New && byId.has(r.cardId) && inScope(byId.get(r.cardId)!)).length;
  const doneToday = today.filter((r) => byId.has(r.cardId) && inScope(byId.get(r.cardId)!)).length;

  const due = scoped
    .filter((c) => {
      const b = bucketOf(c, nowMs, endMs);
      return b === 'learning' || b === 'review';
    })
    .sort((a, b) => a.due - b.due);

  const newLeft = Math.max(0, getNewPerDay() - newToday);
  const fresh = scoped
    .filter((c) => c.state === State.New)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, newLeft);

  const cards = [...due, ...fresh];
  if (excludeId && cards.length > 1 && cards[0].id === excludeId) cards.push(cards.shift()!);

  const queued = new Set(cards.map((c) => c.id));
  const next = scoped
    .filter((c) => c.state !== State.New && c.due > nowMs && !queued.has(c.id))
    .sort((a, b) => a.due - b.due)[0];

  return {
    cards,
    counts: {
      new: fresh.length,
      learning: due.filter((c) => c.state !== State.Review).length,
      review: due.filter((c) => c.state === State.Review).length,
    },
    doneToday,
    totalCards: scoped.length,
    nextDue: next?.due ?? null,
  };
}

/** Applique une note FSRS : met à jour la carte et journalise la révision. */
export async function applyReview(card: StoredCard, rating: RatingId, meta: { durationMs: number; correct: boolean }) {
  const now = new Date();
  const { card: next, log } = schedule(card.fsrs, rating, now);
  const updated: StoredCard = { ...card, fsrs: next, due: next.due.getTime(), state: next.state };
  await db.transaction('rw', db.cards, db.reviews, async () => {
    await db.cards.put(updated);
    await db.reviews.add({
      cardId: card.id,
      ts: now.getTime(),
      rating: log.rating,
      prevState: card.state,
      newState: next.state,
      durationMs: meta.durationMs,
      correct: meta.correct,
      scheduledDays: next.scheduled_days,
    });
  });
}
