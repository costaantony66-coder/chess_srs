import type { Game } from './db';
import { saveParsedGames, type SaveReport } from './games';
import { analyseGame, type AnalyseOptions } from '../lib/analysis';
import type { Evaluator } from '../lib/engine';
import type { ParsedGame, Severity } from '../lib/games';

/** Analyse une partie enregistrée, crée les cartes d'erreurs et la marque comme analysée. */
export async function analyseStoredGame(game: Game, engine: Evaluator, allowed: Set<Severity>, opts: AnalyseOptions): Promise<SaveReport> {
  const moves = game.moves.split(' ').filter(Boolean);
  const errors = await analyseGame(moves, game.myColor, engine, opts);
  const parsed: ParsedGame = {
    id: game.id,
    source: game.source,
    white: game.white,
    black: game.black,
    myColor: game.myColor,
    result: game.result,
    playedAt: game.playedAt,
    opening: game.opening,
    moves,
    analysed: true,
    errors,
  };
  return saveParsedGames([parsed], allowed);
}
