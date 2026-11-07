import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { applyReview, loadQueue } from './queue';
import { getNewPerDay } from '../lib/settings';
import { SEED_CARDS, seedDeck } from '../data/seed';

beforeEach(async () => {
  await db.cards.clear();
  await db.reviews.clear();
});

describe('file de révision', () => {
  it('propose les nouvelles cartes, plafonnées par jour', async () => {
    await seedDeck();
    const q = await loadQueue();
    expect(q.totalCards).toBe(SEED_CARDS.length);
    expect(q.counts.new).toBe(Math.min(getNewPerDay(), SEED_CARDS.length));
  });

  it('Good planifie la carte plus tard et la sort de la file', async () => {
    await seedDeck();
    const first = (await loadQueue()).cards[0];
    await applyReview(first, 'easy', { durationMs: 1000, correct: true });
    const q = await loadQueue();
    expect(q.cards.find((c) => c.id === first.id)).toBeUndefined();
    expect(q.doneToday).toBe(1);
    expect(q.nextDue).not.toBeNull();
  });

  it('Again garde la carte en apprentissage', async () => {
    await seedDeck();
    const first = (await loadQueue()).cards[0];
    await applyReview(first, 'again', { durationMs: 1000, correct: false });
    const q = await loadQueue();
    expect(q.counts.learning).toBe(1);
    expect(q.counts.new).toBe(SEED_CARDS.length - 1);
  });
});
