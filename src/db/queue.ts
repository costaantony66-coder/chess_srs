import { State } from 'ts-fsrs';
import { db, type StoredCard } from './db';
import { inDeck, topLevel } from '../lib/decks';
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
  if (card.suspended) return null;
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
 * apprentissage + révisions dues aujourd'hui, puis nouvelles cartes. Le plafond quotidien de nouvelles cartes
 * est un budget par catégorie (Ouvertures, Puzzles…), partagé entre tous ses sous-paquets.
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

  // Nouvelles cartes déjà vues aujourd'hui, par catégorie (quel que soit le sous-paquet étudié).
  const doneNew = new Map<string, number>();
  for (const r of today) {
    const c = byId.get(r.cardId);
    if (c && r.prevState === State.New) doneNew.set(topLevel(c.deck), (doneNew.get(topLevel(c.deck)) ?? 0) + 1);
  }
  const doneToday = today.filter((r) => byId.has(r.cardId) && inScope(byId.get(r.cardId)!)).length;

  const due = scoped
    .filter((c) => {
      const b = bucketOf(c, nowMs, endMs);
      return b === 'learning' || b === 'review';
    })
    .sort((a, b) => a.due - b.due);

  const limit = getNewPerDay();
  const taken = new Map<string, number>();
  const fresh = scoped
    .filter((c) => c.state === State.New && !c.suspended)
    .sort((a, b) => a.createdAt - b.createdAt)
    .filter((c) => {
      const t = topLevel(c.deck);
      const used = taken.get(t) ?? 0;
      if (used >= Math.max(0, limit - (doneNew.get(t) ?? 0))) return false;
      taken.set(t, used + 1);
      return true;
    });

  const cards = [...due, ...fresh];
  if (excludeId && cards.length > 1 && cards[0].id === excludeId) cards.push(cards.shift()!);

  const queued = new Set(cards.map((c) => c.id));
  const next = scoped
    .filter((c) => !c.suspended && c.state !== State.New && c.due > nowMs && !queued.has(c.id))
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
export interface ReviewUndo {
  /** La carte telle qu'elle était avant la note. */
  previous: StoredCard;
  /** Identifiant de la ligne du journal des révisions. */
  logId: number;
}

export async function applyReview(card: StoredCard, rating: RatingId, meta: { durationMs: number; correct: boolean }): Promise<ReviewUndo> {
  const now = new Date();
  const { card: next, log } = schedule(card.fsrs, rating, now);
  const updated: StoredCard = { ...card, fsrs: next, due: next.due.getTime(), state: next.state };
  let logId = 0;
  await db.transaction('rw', db.cards, db.reviews, async () => {
    await db.cards.put(updated);
    logId = await db.reviews.add({
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
  return { previous: card, logId };
}
