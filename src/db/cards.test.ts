import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, makeCard, type NewCardInput } from './db';
import { deleteCards, listDecks, moveCards, setSuspended, undoReview } from './cards';
import { applyReview, loadQueue } from './queue';

const mk = (id: string, extra: Partial<NewCardInput> = {}) =>
  makeCard({ id, type: 'tactic', title: id, fen: 'x', solution: ['e2e4'], tags: [], deck: 'Puzzles::A', ...extra });

beforeEach(async () => {
  await db.cards.clear();
  await db.reviews.clear();
});

describe('gestion des cartes', () => {
  it('suspend et réactive : une carte suspendue disparaît de la file', async () => {
    await db.cards.bulkAdd([mk('a'), mk('b')]);
    expect(await setSuspended(['a'], true)).toBe(1);
    expect((await loadQueue()).cards.map((c) => c.id)).toEqual(['b']);
    await setSuspended(['a'], false);
    expect((await loadQueue()).cards).toHaveLength(2);
  });

  it('supprime les cartes ordinaires mais protège celles d’un répertoire', async () => {
    await db.cards.bulkAdd([mk('a'), mk('rep', { source: 'repertoire', repId: 'r1', deck: 'Ouvertures::X::Coups seuls' })]);
    expect(await deleteCards(['a', 'rep', 'inconnue'])).toEqual({ deleted: 1, skipped: 1 });
    expect(await db.cards.count()).toBe(1);
    expect(await db.cards.get('rep')).toBeDefined();
  });

  it('déplace vers un autre paquet, sauf les cartes de répertoire', async () => {
    await db.cards.bulkAdd([mk('a'), mk('rep', { source: 'repertoire', repId: 'r1', deck: 'Ouvertures::X::Coups seuls' })]);
    expect(await moveCards(['a', 'rep'], 'Puzzles::Favoris')).toEqual({ moved: 1, skipped: 1 });
    expect((await db.cards.get('a'))!.deck).toBe('Puzzles::Favoris');
    expect((await db.cards.get('rep'))!.deck).toBe('Ouvertures::X::Coups seuls');
    expect(await listDecks()).toEqual(['Ouvertures::X::Coups seuls', 'Puzzles::Favoris']);
    expect(await listDecks('Puzzles')).toEqual(['Puzzles::Favoris']);
  });

  it('annule la dernière note : la carte redevient nouvelle et le journal est nettoyé', async () => {
    await db.cards.add(mk('a'));
    const card = (await db.cards.get('a'))!;
    const undo = await applyReview(card, 'good', { durationMs: 1, correct: true });
    expect((await db.cards.get('a'))!.fsrs.reps).toBe(1);
    expect(await db.reviews.count()).toBe(1);
    await undoReview(undo);
    const back = (await db.cards.get('a'))!;
    expect(back.fsrs.reps).toBe(0);
    expect(back.state).toBe(0);
    expect(await db.reviews.count()).toBe(0);
    expect((await loadQueue()).counts.new).toBe(1); // le budget du jour est rendu
  });
});
