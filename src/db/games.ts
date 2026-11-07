import { db, makeCard, type Game } from './db';
import { errorCards, type ParsedGame, type Severity } from '../lib/games';

export interface SaveReport {
  games: number;
  newGames: number;
  cards: number;
  unanalysed: number;
}

const toGame = (g: ParsedGame): Game => ({
  id: g.id,
  source: g.source,
  white: g.white,
  black: g.black,
  myColor: g.myColor,
  result: g.result,
  playedAt: g.playedAt,
  opening: g.opening,
  moves: g.moves.join(' '),
  analysed: g.analysed,
  importedAt: Date.now(),
});

/** Enregistre les parties et crée une carte par erreur retenue (sans doublon). */
export async function saveParsedGames(parsed: ParsedGame[], allowed: Set<Severity>): Promise<SaveReport> {
  const known = new Set((await db.games.bulkGet(parsed.map((g) => g.id))).filter(Boolean).map((g) => g!.id));
  const cards = parsed.flatMap((g) => errorCards(g, allowed)).map(makeCard);
  const have = new Set((await db.cards.bulkGet(cards.map((c) => c.id))).filter(Boolean).map((c) => c!.id));
  const fresh = cards.filter((c) => !have.has(c.id));
  await db.transaction('rw', db.games, db.cards, async () => {
    await db.games.bulkPut(parsed.map(toGame));
    await db.cards.bulkAdd(fresh);
  });
  return {
    games: parsed.length,
    newGames: parsed.filter((g) => !known.has(g.id)).length,
    cards: fresh.length,
    unanalysed: parsed.filter((g) => !g.analysed).length,
  };
}

export interface GameRow {
  game: Game;
  cards: number;
}

export async function listGames(): Promise<GameRow[]> {
  const games = await db.games.toArray();
  games.sort((a, b) => (b.playedAt ?? b.importedAt) - (a.playedAt ?? a.importedAt));
  return Promise.all(games.map(async (game) => ({ game, cards: await db.cards.where('gameId').equals(game.id).count() })));
}

export async function deleteGame(id: string) {
  await db.transaction('rw', db.games, db.cards, async () => {
    await db.cards.where('gameId').equals(id).delete();
    await db.games.delete(id);
  });
}

/** Carte créée à la main depuis la visionneuse : tu rejoues le bon coup. */
export async function saveManualCard(game: Game, ply: number, fen: string, uci: string, lastMove: string | undefined, played: string) {
  const id = `err:${game.id}:${ply}`;
  const opponent = game.myColor === 'white' ? game.black : game.white;
  const old = await db.cards.get(id);
  const note = `Dans ta partie, tu avais joué ${played}.`;
  if (old) {
    await db.cards.put({ ...old, solution: [uci], note });
    return;
  }
  await db.cards.add(
    makeCard({ id, type: 'mistake', title: `Erreur · vs ${opponent}`, fen, solution: [uci], tags: ['mistake'], lastMove, note, source: 'game', gameId: game.id }),
  );
}
