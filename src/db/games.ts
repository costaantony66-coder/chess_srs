import { db, makeCard, type Game } from './db';
import { errorCards, type ParsedGame, type Severity } from '../lib/games';

export interface SaveReport {
  games: number;
  newGames: number;
  cards: number;
  unanalysed: number;
}

const toGame = (g: ParsedGame, prev?: Game): Game => {
  const analysis = g.analysis ?? prev?.analysis;
  return {
    id: g.id,
    source: g.source,
    white: g.white,
    black: g.black,
    myColor: g.myColor,
    result: g.result,
    playedAt: g.playedAt,
    opening: g.opening ?? prev?.opening,
    moves: g.moves.join(' '),
    analysed: !!analysis,
    importedAt: prev?.importedAt ?? Date.now(),
    ...(prev?.favorite ? { favorite: true } : {}),
    ...(analysis ? { analysis } : {}),
  };
};

/** Enregistre les parties et crée une carte par erreur retenue (sans doublon). */
export async function saveParsedGames(parsed: ParsedGame[], allowed: Set<Severity>): Promise<SaveReport> {
  const existing = new Map((await db.games.bulkGet(parsed.map((g) => g.id))).filter(Boolean).map((g) => [g!.id, g!]));
  const known = new Set(existing.keys());
  const cards = parsed.flatMap((g) => errorCards(g, allowed)).map(makeCard);
  const have = new Set((await db.cards.bulkGet(cards.map((c) => c.id))).filter(Boolean).map((c) => c!.id));
  const fresh = cards.filter((c) => !have.has(c.id));
  await db.transaction('rw', db.games, db.cards, async () => {
    await db.games.bulkPut(parsed.map((g) => toGame(g, existing.get(g.id))));
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
    makeCard({
      id,
      type: 'mistake',
      title: `Erreur · vs ${opponent}`,
      fen,
      solution: [uci],
      tags: ['mistake'],
      lastMove,
      note,
      source: 'game',
      gameId: game.id,
      deck: 'Parties::Corrections manuelles',
    }),
  );
}

export async function toggleFavorite(id: string) {
  const g = await db.games.get(id);
  if (g) await db.games.update(id, { favorite: !g.favorite });
}

/** Supprime plusieurs parties et leurs cartes d'erreurs. Retourne le nombre de cartes supprimées. */
export async function deleteGames(ids: string[]): Promise<number> {
  let cards = 0;
  await db.transaction('rw', db.games, db.cards, async () => {
    for (const id of ids) cards += await db.cards.where('gameId').equals(id).delete();
    await db.games.bulkDelete(ids);
  });
  return cards;
}
