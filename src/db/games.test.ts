import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { deleteGame, listGames, saveManualCard, saveParsedGames } from './games';
import { parsePgnGames } from '../lib/games';

const PGN = `[Site "https://lichess.org/abcd1234"]
[White "Alice"]
[Black "Bob"]
[Result "0-1"]

1. f3 e5 2. g4? { (0.10 → -9.00) Blunder. Best move was e4. } 2... Qh4# 0-1
`;
const all = new Set(['Inaccuracy', 'Mistake', 'Blunder'] as const);

beforeEach(async () => {
  await db.cards.clear();
  await db.games.clear();
});

describe('parties importées', () => {
  it('enregistre la partie et une carte d’erreur, sans doublon au second import', async () => {
    const { games } = parsePgnGames(PGN, { username: 'Alice' });
    const first = await saveParsedGames(games, all);
    expect(first).toMatchObject({ games: 1, newGames: 1, cards: 1, unanalysed: 0 });
    const second = await saveParsedGames(games, all);
    expect(second).toMatchObject({ newGames: 0, cards: 0 });
    expect(await db.cards.count()).toBe(1);
    const rows = await listGames();
    expect(rows[0].cards).toBe(1);
  });

  it('carte manuelle puis suppression de la partie avec ses cartes', async () => {
    const { games } = parsePgnGames(PGN, { username: 'Alice' });
    await saveParsedGames(games, new Set());
    const game = (await db.games.toArray())[0];
    await saveManualCard(game, 3, 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2', 'd2d4', 'e7e5', 'g4');
    expect(await db.cards.where('gameId').equals(game.id).count()).toBe(1);
    await deleteGame(game.id);
    expect(await db.cards.count()).toBe(0);
    expect(await db.games.count()).toBe(0);
  });
});

describe('favoris et suppression groupée', () => {
  it('garde le favori après réimport et supprime plusieurs parties avec leurs cartes', async () => {
    const { toggleFavorite, deleteGames } = await import('./games');
    const a = parsePgnGames(PGN, { username: 'Alice' }).games;
    await saveParsedGames(a, all);
    await toggleFavorite(a[0].id);
    await saveParsedGames(a, all); // réimport : le favori est conservé
    expect((await db.games.get(a[0].id))!.favorite).toBe(true);
    await toggleFavorite(a[0].id);
    expect((await db.games.get(a[0].id))!.favorite).toBeFalsy();

    const b = { ...a[0], id: 'lichess:zzzz9999' };
    await saveParsedGames([b], all);
    const removed = await deleteGames([a[0].id, b.id]);
    expect(removed).toBe(2);
    expect(await db.games.count()).toBe(0);
    expect(await db.cards.count()).toBe(0);
  });

  it('crée les cartes d’erreurs dans le paquet Parties::source', async () => {
    const { games } = parsePgnGames(PGN, { username: 'Alice' });
    await saveParsedGames(games, all);
    expect((await db.cards.toArray())[0].deck).toBe('Parties::Lichess');
  });
});
