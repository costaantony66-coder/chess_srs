import { State } from 'ts-fsrs';
import { db, type StoredCard } from './db';
import { schedule, type RatingId } from '../lib/fsrs';
import { getNewPerDay } from '../lib/settings';

const LEARN_AHEAD_MS = 20 * 60 * 1000;

export interface QueueState {
  cards: StoredCard[];
  counts: { new: number; learning: number; review: number };
  doneToday: number;
  totalCards: number;
  nextDue: number | null;
}

/** File du jour : apprentissage + révisions dues aujourd'hui, puis nouvelles cartes (plafonnées). */
export async function loadQueue(now = new Date(), excludeId?: string): Promise<QueueState> {
  const nowMs = now.getTime();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const [totalCards, today] = await Promise.all([
    db.cards.count(),
    db.reviews.where('ts').aboveOrEqual(startOfDay.getTime()).toArray(),
  ]);
  const newToday = today.filter((r) => r.prevState === State.New).length;

  const due = (
    await db.cards
      .where('due')
      .belowOrEqual(endOfDay.getTime())
      .filter((c) => c.state !== State.New)
      .sortBy('due')
  ).filter((c) => c.state === State.Review || c.due <= nowMs + LEARN_AHEAD_MS);

  const newLeft = Math.max(0, getNewPerDay() - newToday);
  const fresh = newLeft
    ? (await db.cards.where('state').equals(State.New).sortBy('createdAt')).slice(0, newLeft)
    : [];

  const cards = [...due, ...fresh];
  if (excludeId && cards.length > 1 && cards[0].id === excludeId) cards.push(cards.shift()!);

  const queued = new Set(cards.map((c) => c.id));
  const next = await db.cards
    .where('due')
    .above(nowMs)
    .filter((c) => c.state !== State.New && !queued.has(c.id))
    .first();

  return {
    cards,
    counts: {
      new: fresh.length,
      learning: due.filter((c) => c.state !== State.Review).length,
      review: due.filter((c) => c.state === State.Review).length,
    },
    doneToday: today.length,
    totalCards,
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
