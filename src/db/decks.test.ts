import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { State } from 'ts-fsrs';
import { ChessDB, db, makeCard } from './db';
import { loadDeckTree } from './decks';
import { applyReview, loadQueue } from './queue';
import { newFsrsCard } from '../lib/fsrs';
import { deckPath, inDeck, prefixes } from '../lib/decks';
import { seedDeck } from '../data/seed';

beforeEach(async () => {
  await db.cards.clear();
  await db.reviews.clear();
});

describe('chemins de paquets', () => {
  it('prefixes, inDeck et noms nettoyés', () => {
    expect(prefixes('A::B::C')).toEqual(['A', 'A::B', 'A::B::C']);
    expect(inDeck('Ouvertures::Londres::Lignes', 'Ouvertures::Londres')).toBe(true);
    expect(inDeck('Ouvertures::Londres2', 'Ouvertures::Londres')).toBe(false);
    expect(deckPath('Ouvertures', 'a::b')).toBe('Ouvertures::a:b');
  });
});

describe('arbre et file par paquet', () => {
  it('compte par paquet, additionne les sous-paquets, plafonne les nouvelles par paquet', async () => {
    const mk = (id: string, deck: string) =>
      makeCard({ id, type: 'tactic', title: id, fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', solution: ['e1e2'], tags: [], deck });
    await db.cards.bulkAdd([mk('a1', 'Puzzles::Fourchette'), mk('a2', 'Puzzles::Fourchette'), mk('b1', 'Puzzles::Clouage'), mk('c1', 'Ouvertures::Londres')]);
    const tree = await loadDeckTree();
    const puzzles = tree.roots.find((n) => n.name === 'Puzzles')!;
    expect(puzzles.total).toBe(3);
    expect(puzzles.new).toBe(3);
    expect(puzzles.children.map((c) => c.name).sort()).toEqual(['Clouage', 'Fourchette']);
    expect(tree.all.total).toBe(4);

    const q = await loadQueue(new Date(), undefined, 'Puzzles::Fourchette');
    expect(q.cards.map((c) => c.id).sort()).toEqual(['a1', 'a2']);
    const parent = await loadQueue(new Date(), undefined, 'Puzzles');
    expect(parent.cards).toHaveLength(3);
  });

  it('le plafond de nouvelles cartes est compté dans le paquet étudié', async () => {
    const cards = Array.from({ length: 12 }, (_, i) =>
      makeCard({ id: `p${i}`, type: 'tactic', title: 'p', fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', solution: ['e1e2'], tags: [], deck: 'Puzzles::Fourchette' }),
    );
    await db.cards.bulkAdd([...cards, makeCard({ id: 'o', type: 'opening', title: 'o', fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', solution: ['e1e2'], tags: [], deck: 'Ouvertures::X' })]);
    const first = (await loadQueue(new Date(), undefined, 'Puzzles')).cards[0];
    await applyReview(first, 'good', { durationMs: 1, correct: true });
    const puzzles = await loadQueue(new Date(), undefined, 'Puzzles');
    expect(puzzles.counts.new).toBe(9); // 10 par jour - 1 déjà vue
    const openings = await loadQueue(new Date(), undefined, 'Ouvertures');
    expect(openings.counts.new).toBe(1); // autre paquet : pas affecté
  });

  it('les cartes de démo vont dans le paquet Démo', async () => {
    await seedDeck();
    const tree = await loadDeckTree();
    expect(tree.roots.map((n) => n.name)).toEqual(['Démo']);
    expect(tree.roots[0].total).toBe(9);
    expect(State.New).toBe(0);
  });
});

describe('migration vers les paquets', () => {
  it('range les cartes existantes sans rien perdre', async () => {
    const old = new Dexie('mig-test');
    old.version(4).stores({
      cards: 'id, type, due, state, createdAt, rating, repId, gameId, *tags',
      reviews: '++id, cardId, ts',
      repertoires: 'id, createdAt',
      repnodes: 'id, repId, [repId+parentId]',
      games: 'id, source, importedAt',
    });
    const base = { fen: 'x', solution: ['e2e4'], tags: [], createdAt: 1, due: 1, state: 0, fsrs: newFsrsCard() };
    await old.table('repertoires').add({ id: 'r1', name: 'Système de Londres', color: 'white', createdAt: 1 });
    await old.table('games').add({ id: 'g1', source: 'chesscom', white: 'a', black: 'b', myColor: 'white', result: '1-0', moves: '', analysed: false, importedAt: 1 });
    await old.table('cards').bulkAdd([
      { ...base, id: 'demo-x', type: 'tactic', title: 'Mat' },
      { ...base, id: 'rep:r1:k', type: 'opening', title: 'Système de Londres', source: 'repertoire', repId: 'r1' },
      { ...base, id: 'lichess-1', type: 'tactic', title: 'Puzzle · Fourchette', source: 'lichess' },
      { ...base, id: 'err:g1:3', type: 'mistake', title: 'Erreur', source: 'game', gameId: 'g1' },
      { ...base, id: 'misc', type: 'endgame', title: 'Finale' },
    ]);
    old.close();

    const migrated = new ChessDB('mig-test');
    const decks = Object.fromEntries((await migrated.cards.toArray()).map((c) => [c.id, c.deck]));
    expect(decks).toEqual({
      'demo-x': 'Démo',
      'rep:r1:k': 'Ouvertures::Système de Londres',
      'lichess-1': 'Puzzles::Fourchette',
      'err:g1:3': 'Parties::Chess.com',
      misc: 'Finales',
    });
    expect(await migrated.repertoires.count()).toBe(1);
    migrated.close();
  });
});
