import type { Game } from './db';
import { saveParsedGames, type SaveReport } from './games';
import { loadBook } from '../data/book';
import { analyseGameFull, errorsFromAnalysis, type AnalyseOptions } from '../lib/analysis';
import type { Evaluator } from '../lib/engine';
import type { ParsedGame, Severity } from '../lib/games';

/**
 * Analyse complète d'une partie enregistrée : l'analyse (tous les coups classés) est conservée avec la partie,
 * et les erreurs de ton camp choisies (`allowed`) deviennent des cartes.
 */
export async function analyseStoredGame(game: Game, engine: Evaluator, allowed: Set<Severity>, opts: Omit<AnalyseOptions, 'book'>): Promise<SaveReport> {
  const moves = game.moves.split(' ').filter(Boolean);
  const book = await loadBook();
  const { analysis, opening } = await analyseGameFull(moves, engine, { ...opts, book });
  const parsed: ParsedGame = {
    id: game.id,
    source: game.source,
    white: game.white,
    black: game.black,
    myColor: game.myColor,
    result: game.result,
    playedAt: game.playedAt,
    opening: game.opening ?? opening,
    moves,
    analysed: true,
    errors: errorsFromAnalysis(analysis, game.myColor),
    analysis,
  };
  return saveParsedGames([parsed], allowed);
}
