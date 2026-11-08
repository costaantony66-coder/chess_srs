import 'fake-indexeddb/auto';
import { Chess } from 'chess.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { analyseStoredGame } from './analysis';
import { deleteGame, deleteGames, listGames, saveManualCard, saveParsedGames, toggleFavorite } from './games';
import { parsePgnGames, replay, type ParsedGame } from '../lib/games';
import type { Evaluator } from '../lib/engine';

const PGN = `[Site "https://lichess.org/abcd1234"]
[White "Alice"]
[Black "Bob"]
[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1
`;
const all = new Set(['Inaccuracy', 'Mistake', 'Blunder', 'Miss'] as const);
const base = (): ParsedGame => parsePgnGames(PGN, { username: 'Alice' }).games[0];
const withError = (): ParsedGame => ({ ...base(), errors: [{ ply: 3, severity: 'Blunder', bestUci: 'e2e4' }] });

/** Moteur simulé : la gaffe 2.g4 fait passer l'évaluation de +0,5 à -8 pour les blancs. */
function fakeEngine(moves: string[]): Evaluator {
  const { fens, ucis } = replay(moves);
  const cps = [0, 0, 50, 800, -10000]; // au trait de chaque position
  return {
    analyse: async (fen) => {
      const i = fens.indexOf(fen);
      const legal = new Chess(fen).moves({ verbose: true })[0];
      return { cp: cps[i], best: i === 2 ? 'e2e4' : ucis[i] ?? legal.from + legal.to };
    },
  };
}

beforeEach(async () => {
  await db.cards.clear();
  await db.games.clear();
});

describe('parties importées', () => {
  it('enregistre la partie et les cartes d’erreurs fournies, sans doublon au second enregistrement', async () => {
    const first = await saveParsedGames([withError()], all);
    expect(first).toMatchObject({ games: 1, newGames: 1, cards: 1 });
    const second = await saveParsedGames([withError()], all);
    expect(second).toMatchObject({ newGames: 0, cards: 0 });
    expect(await db.cards.count()).toBe(1);
    expect((await db.cards.toArray())[0].deck).toBe('Parties::Lichess');
    expect((await listGames())[0].cards).toBe(1);
  });

  it('un import sans analyse ne crée aucune carte', async () => {
    const r = await saveParsedGames([base()], all);
    expect(r.cards).toBe(0);
    expect(await db.cards.count()).toBe(0);
  });

  it('carte manuelle puis suppression de la partie avec ses cartes', async () => {
    await saveParsedGames([base()], new Set());
    const game = (await db.games.toArray())[0];
    await saveManualCard(game, 3, 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2', 'd2d4', 'e7e5', 'g4');
    expect(await db.cards.where('gameId').equals(game.id).count()).toBe(1);
    await deleteGame(game.id);
    expect(await db.cards.count()).toBe(0);
    expect(await db.games.count()).toBe(0);
  });
});

describe('analyse complète enregistrée', () => {
  it('conserve l’analyse avec la partie, crée les cartes d’erreurs et nomme l’ouverture', async () => {
    await saveParsedGames([base()], new Set());
    const game = (await db.games.toArray())[0];
    const moves = game.moves.split(' ');
    const r = await analyseStoredGame(game, fakeEngine(moves), new Set(['Blunder', 'Mistake']), { depth: 1 });
    expect(r.cards).toBe(1);
    const saved = (await db.games.get(game.id))!;
    expect(saved.analysis?.classes).toHaveLength(4);
    expect(saved.analysis?.classes[2]).toBe('blunder');
    expect(saved.analysis?.accuracy.white).toBeLessThan(saved.analysis!.accuracy.black);
    expect(saved.analysed).toBe(true);
    const card = (await db.cards.toArray())[0];
    expect(card.solution).toEqual(['e2e4']);
    expect(card.deck).toBe('Parties::Lichess');
  });

  it('un réimport ne perd ni l’analyse ni le favori', async () => {
    await saveParsedGames([base()], new Set());
    const game = (await db.games.toArray())[0];
    await analyseStoredGame(game, fakeEngine(game.moves.split(' ')), new Set(), { depth: 1 });
    await toggleFavorite(game.id);
    await saveParsedGames([base()], new Set());
    const again = (await db.games.get(game.id))!;
    expect(again.analysis).toBeDefined();
    expect(again.favorite).toBe(true);
  });
});

describe('favoris et suppression groupée', () => {
  it('supprime plusieurs parties avec leurs cartes', async () => {
    const a = withError();
    await saveParsedGames([a], all);
    await toggleFavorite(a.id);
    expect((await db.games.get(a.id))!.favorite).toBe(true);
    await toggleFavorite(a.id);
    expect((await db.games.get(a.id))!.favorite).toBeFalsy();

    const b = { ...a, id: 'lichess:zzzz9999' };
    await saveParsedGames([b], all);
    const removed = await deleteGames([a.id, b.id]);
    expect(removed).toBe(2);
    expect(await db.games.count()).toBe(0);
    expect(await db.cards.count()).toBe(0);
  });
});
