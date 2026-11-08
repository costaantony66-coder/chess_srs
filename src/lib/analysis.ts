import { Chess } from 'chess.js';
import { winChance, type Evaluator } from './engine';
import { replay, type GameError, type Severity } from './games';

/** Seuils de Lichess sur les chances de gain (échelle -1..1). */
export function severityOf(loss: number): Severity | null {
  if (loss >= 0.3) return 'Blunder';
  if (loss >= 0.2) return 'Mistake';
  if (loss >= 0.1) return 'Inaccuracy';
  return null;
}

export interface AnalyseOptions {
  depth: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

/** Analyse une partie avec un moteur et retourne les erreurs de ton camp (avec le meilleur coup). */
export async function analyseGame(
  moves: string[],
  myColor: 'white' | 'black',
  engine: Evaluator,
  opts: AnalyseOptions,
): Promise<GameError[]> {
  const { fens, ucis } = replay(moves);
  const evals = [];
  for (let i = 0; i < fens.length; i++) {
    if (opts.signal?.aborted) throw new DOMException('Analyse annulée', 'AbortError');
    const chess = new Chess(fens[i]);
    if (chess.isCheckmate()) evals.push({ cp: -10000, best: '' });
    else if (chess.isGameOver()) evals.push({ cp: 0, best: '' });
    else evals.push(await engine.analyse(fens[i], opts.depth));
    opts.onProgress?.(i + 1, fens.length);
  }

  const errors: GameError[] = [];
  for (let ply = 1; ply <= ucis.length; ply++) {
    if ((ply % 2 === 1) !== (myColor === 'white')) continue;
    const before = evals[ply - 1];
    const after = evals[ply];
    if (!before.best || ucis[ply - 1] === before.best) continue;
    const severity = severityOf(winChance(before.cp) - winChance(-after.cp));
    if (severity) errors.push({ ply, severity, bestUci: before.best });
  }
  return errors;
}
