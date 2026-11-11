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

  it('le nombre de nouvelles cartes affiché est le nombre réel, par paquet', async () => {
    const cards = Array.from({ length: 12 }, (_, i) =>
      makeCard({ id: `p${i}`, type: 'tactic', title: 'p', fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', solution: ['e1e2'], tags: [], deck: 'Puzzles::Fourchette' }),
    );
    await db.cards.bulkAdd([...cards, makeCard({ id: 'o', type: 'opening', title: 'o', fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', solution: ['e1e2'], tags: [], deck: 'Ouvertures::X' })]);
    const first = (await loadQueue(new Date(), undefined, 'Puzzles')).cards[0];
    await applyReview(first, 'good', { durationMs: 1, correct: true });
    const puzzles = await loadQueue(new Date(), undefined, 'Puzzles');
    expect(puzzles.counts.new).toBe(11); // 12 cartes - 1 déjà vue : aucune limite cachée
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
      'rep:r1:k': 'Ouvertures::Système de Londres::Coups seuls',
      'lichess-1': 'Puzzles::Fourchette',
      'err:g1:3': 'Parties::Chess.com',
      misc: 'Finales',
    });
    expect(await migrated.repertoires.count()).toBe(1);
    migrated.close();
  });
});

describe('ouvertures : Coups seuls / Lignes', () => {
  it('migration v6 : les coups isolés vont dans « Coups seuls », les lignes ne bougent pas', async () => {
    const old = new Dexie('mig-v5');
    old.version(5).stores({
      cards: 'id, type, due, state, createdAt, rating, repId, gameId, deck, *tags',
      reviews: '++id, cardId, ts',
      repertoires: 'id, createdAt',
      repnodes: 'id, repId, [repId+parentId]',
      games: 'id, source, importedAt',
    });
    const base = { fen: 'x', solution: ['e2e4'], tags: [], createdAt: 1, due: 1, state: 0, fsrs: newFsrsCard(), type: 'opening', title: 't' };
    await old.table('cards').bulkAdd([
      { ...base, id: 'single', source: 'repertoire', repId: 'r1', deck: 'Ouvertures::Londres' },
      { ...base, id: 'line', source: 'repertoire', repId: 'r1', lineMode: true, deck: 'Ouvertures::Londres::Lignes' },
      { ...base, id: 'puzzle', type: 'tactic', source: 'lichess', deck: 'Puzzles::Fourchette' },
    ]);
    old.close();
    const migrated = new ChessDB('mig-v5');
    const decks = Object.fromEntries((await migrated.cards.toArray()).map((c) => [c.id, c.deck]));
    expect(decks).toEqual({
      single: 'Ouvertures::Londres::Coups seuls',
      line: 'Ouvertures::Londres::Lignes',
      puzzle: 'Puzzles::Fourchette',
    });
    migrated.close();
  });

  it('une ouverture sans carte affiche quand même ses deux sous-paquets', async () => {
    await db.repertoires.clear();
    await db.repertoires.add({ id: 'r9', name: 'Londres', color: 'white', createdAt: 1 });
    const tree = await loadDeckTree();
    const londres = tree.roots.find((n) => n.name === 'Ouvertures')!.children.find((n) => n.name === 'Londres')!;
    expect(londres.children.map((c) => c.name).sort()).toEqual(['Coups seuls', 'Lignes']);
    expect(londres.children.every((c) => c.total === 0)).toBe(true);
    await db.repertoires.clear();
  });
});

describe('compteurs de nouvelles cartes : vrais nombres, parent = somme des enfants', () => {
  const mk = (id: string, deck: string) =>
    makeCard({ id, type: 'tactic', title: id, fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', solution: ['e1e2'], tags: [], deck });
  const many = (n: number, deck: string, prefix: string) => Array.from({ length: n }, (_, i) => mk(`${prefix}${i}`, deck));

  it('10 mats en 3 + 10 mats en 2 + 5 mats en 1 + 10 fourchettes + 2 clouages = 37 dans Puzzles', async () => {
    await db.cards.clear();
    await db.reviews.clear();
    await db.cards.bulkAdd([
      ...many(10, 'Puzzles::Mat en 3', 'm3-'),
      ...many(10, 'Puzzles::Mat en 2', 'm2-'),
      ...many(5, 'Puzzles::Mat en 1', 'm1-'),
      ...many(10, 'Puzzles::Fourchette', 'f-'),
      ...many(2, 'Puzzles::Clouage', 'c-'),
    ]);
    const tree = await loadDeckTree();
    const puzzles = tree.roots.find((n) => n.name === 'Puzzles')!;
    expect(puzzles.new).toBe(37);
    expect(puzzles.children.map((c) => c.new).sort((a, b) => a - b)).toEqual([2, 5, 10, 10, 10]);
    expect(puzzles.children.reduce((n, c) => n + c.new, 0)).toBe(puzzles.new);
    expect(tree.all.new).toBe(37);
    // et la session propose bien toutes ces cartes
    expect((await loadQueue(new Date(), undefined, 'Puzzles')).counts.new).toBe(37);
    expect((await loadQueue()).counts.new).toBe(37);
  });

  it('l’objectif du jour avance avec les cartes vues mais ne cache ni ne bloque rien', async () => {
    await db.cards.clear();
    await db.reviews.clear();
    await db.cards.bulkAdd([...many(8, 'Puzzles::A', 'a'), ...many(7, 'Puzzles::B', 'b')]);
    for (let i = 0; i < 5; i++) {
      const q = await loadQueue(new Date(), undefined, 'Puzzles::A');
      await applyReview(q.cards[0], 'easy', { durationMs: 1, correct: true }); // « Easy » : la carte sort de la file
    }
    const tree = await loadDeckTree();
    const puzzles = tree.roots.find((n) => n.name === 'Puzzles')!;
    expect(puzzles.children.find((c) => c.name === 'A')!.new).toBe(3);
    expect(puzzles.children.find((c) => c.name === 'B')!.new).toBe(7);
    expect(puzzles.new).toBe(10); // 3 + 7
    expect(tree.budgets.Puzzles).toEqual({ limit: 10, done: 5, left: 5 });

    // 5 cartes vues sur un objectif de 10 : on peut continuer, rien n'est coupé
    const q = await loadQueue(new Date(), undefined, 'Puzzles');
    expect(q.counts.new).toBe(10);
    expect(q.goal).toEqual({ done: 5, limit: 10 });
    // objectif dépassé : toujours rien de bloqué
    for (let i = 0; i < 6; i++) {
      const next = await loadQueue(new Date(), undefined, 'Puzzles');
      await applyReview(next.cards[0], 'easy', { durationMs: 1, correct: true });
    }
    const after = await loadQueue(new Date(), undefined, 'Puzzles');
    expect(after.goal!.done).toBe(11);
    expect(after.counts.new).toBe(4);
    expect((await loadQueue()).goal).toBeNull(); // « Tout réviser » : pas d'objectif unique
  });

  it('les cartes suspendues ne sont jamais proposées', async () => {
    await db.cards.clear();
    await db.reviews.clear();
    await db.cards.bulkAdd([mk('x1', 'Puzzles::A'), { ...mk('x2', 'Puzzles::A'), suspended: true }]);
    expect((await loadQueue()).cards.map((c) => c.id)).toEqual(['x1']);
    expect((await loadDeckTree()).all.new).toBe(1);
  });
});
