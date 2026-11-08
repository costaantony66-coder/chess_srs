import { Chess } from 'chess.js';
import type { Book } from '../data/book';
import type { GameAnalysis, MoveClass } from '../db/db';
import { expectedPoints, type Evaluation, type Evaluator } from './engine';
import { replay, type GameError, type Severity } from './games';

/** Libellé, symbole et couleur de chaque catégorie de coup. */
export const CLASS_META: Record<MoveClass, { label: string; symbol: string; color: string; hint: string }> = {
  brilliant: { label: 'Brillant', symbol: '!!', color: '#1baca6', hint: 'Un bon sacrifice, dans une position pas déjà gagnée' },
  great: { label: 'Très bon coup', symbol: '!', color: '#5c8bb0', hint: 'Le seul bon coup de la position' },
  best: { label: 'Meilleur coup', symbol: '★', color: '#81b64c', hint: 'Le coup choisi par Stockfish' },
  excellent: { label: 'Excellent', symbol: '', color: '#96bc4b', hint: 'Presque aussi bon que le meilleur coup' },
  good: { label: 'Bon', symbol: '', color: '#a3b18a', hint: 'Une petite perte seulement' },
  book: { label: 'Théorie', symbol: '', color: '#a88865', hint: 'Un coup connu de la théorie d’ouverture' },
  inaccuracy: { label: 'Imprécision', symbol: '?!', color: '#f0b429', hint: 'Une perte modérée' },
  mistake: { label: 'Erreur', symbol: '?', color: '#e58f2a', hint: 'Une perte importante' },
  miss: { label: 'Coup manqué', symbol: '✗', color: '#ff7769', hint: 'L’adversaire a fait une faute et tu ne l’as pas exploitée' },
  blunder: { label: 'Gaffe', symbol: '??', color: '#ca3431', hint: 'Une perte énorme' },
};

export const CLASS_ORDER: MoveClass[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Bilan matériel du point de vue de `color` (en pions). */
export function materialBalance(fen: string, color: 'w' | 'b'): number {
  let total = 0;
  for (const row of new Chess(fen).board()) {
    for (const sq of row) if (sq) total += (sq.color === color ? 1 : -1) * PIECE_VALUE[sq.type];
  }
  return total;
}

const uciMove = (u: string) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });

/** Seuils en points attendus perdus par rapport au meilleur coup (échelle proche de Chess.com). */
export function lossClass(loss: number): 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' {
  if (loss <= 0.02) return 'excellent';
  if (loss <= 0.05) return 'good';
  if (loss <= 0.1) return 'inaccuracy';
  if (loss <= 0.2) return 'mistake';
  return 'blunder';
}

/** Précision d'un coup (formule de Lichess), à partir des points attendus perdus (0..1). */
export const moveAccuracy = (loss: number) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss * 100) - 3.1669));

export interface Classified {
  classes: MoveClass[];
  accuracy: { white: number; black: number };
}

/**
 * Classe tous les coups (les deux camps) à partir des évaluations de chaque position.
 * `evals[i]` : évaluation de la position i (n+1 positions) du point de vue du camp au trait.
 */
export function classifyMoves(fens: string[], ucis: string[], evals: Evaluation[], book?: Book): Classified {
  const classes: MoveClass[] = [];
  const accSum = { white: 0, black: 0 };
  const accN = { white: 0, black: 0 };

  for (let p = 1; p <= ucis.length; p++) {
    const mover = p % 2 === 1 ? 'white' : 'black';
    const before = evals[p - 1];
    const after = evals[p];
    const epBefore = expectedPoints(before.cp);
    const epAfter = expectedPoints(-after.cp); // point de vue de celui qui vient de jouer
    const isBest = !before.best || ucis[p - 1] === before.best;
    const loss = isBest ? 0 : Math.max(0, epBefore - epAfter);

    let cls: MoveClass = isBest ? 'best' : lossClass(loss);

    if (isBest) {
      // Très bon coup : le seul bon coup (le 2ᵉ meilleur est nettement moins bon), hors position déjà gagnée.
      if (before.second !== undefined && epBefore - expectedPoints(before.second) >= 0.12 && epBefore <= 0.95) cls = 'great';
    }
    if (cls === 'best' || cls === 'great' || cls === 'excellent') {
      // Brillant : sacrifice de matériel qui reste bon, dans une position pas déjà gagnée.
      const replyUci = after.best;
      if (loss <= 0.02 && epBefore < 0.85 && epAfter >= 0.4 && replyUci) {
        try {
          const color = mover === 'white' ? 'w' : 'b';
          const chess = new Chess(fens[p]);
          chess.move(uciMove(replyUci));
          const delta = materialBalance(chess.fen(), color) - materialBalance(fens[p - 1], color);
          if (delta <= -2) cls = 'brilliant';
        } catch {
          /* réponse illisible : pas de sacrifice détecté */
        }
      }
    }
    if ((cls === 'inaccuracy' || cls === 'mistake') && (classes[p - 2] === 'mistake' || classes[p - 2] === 'blunder')) {
      cls = 'miss'; // l'adversaire vient de se tromper et tu n'en profites pas
    }
    if (book?.name(fens[p]) && cls !== 'mistake' && cls !== 'blunder' && cls !== 'miss') cls = 'book';

    classes.push(cls);
    accSum[mover] += moveAccuracy(loss);
    accN[mover]++;
  }

  const avg = (c: 'white' | 'black') => (accN[c] ? Math.round((accSum[c] / accN[c]) * 10) / 10 : 100);
  return { classes, accuracy: { white: avg('white'), black: avg('black') } };
}

export interface AnalyseOptions {
  depth: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
  book?: Book;
}

export interface FullAnalysis {
  analysis: GameAnalysis;
  /** Nom de l'ouverture (dernière position de théorie atteinte), si connu. */
  opening?: string;
}

/** Évalue toutes les positions d'une partie puis classe chaque coup. */
export async function analyseGameFull(moves: string[], engine: Evaluator, opts: AnalyseOptions): Promise<FullAnalysis> {
  const { fens, ucis } = replay(moves);
  const evals: Evaluation[] = [];
  for (let i = 0; i < fens.length; i++) {
    if (opts.signal?.aborted) throw new DOMException('Analyse annulée', 'AbortError');
    const chess = new Chess(fens[i]);
    if (chess.isCheckmate()) evals.push({ cp: -10000, best: '' });
    else if (chess.isGameOver()) evals.push({ cp: 0, best: '' });
    else evals.push(await engine.analyse(fens[i], opts.depth));
    opts.onProgress?.(i + 1, fens.length);
  }
  const { classes, accuracy } = classifyMoves(fens, ucis, evals, opts.book);

  let opening: string | undefined;
  if (opts.book) for (const f of fens) opening = opts.book.name(f) ?? opening;

  return {
    analysis: {
      version: 1,
      depth: opts.depth,
      // évaluations ramenées au point de vue des blancs
      evals: evals.map((e, i) => (new Chess(fens[i]).turn() === 'w' ? e.cp : -e.cp)),
      bests: evals.map((e) => e.best),
      classes,
      accuracy,
    },
    opening,
  };
}

const SEVERITY_OF: Partial<Record<MoveClass, Severity>> = { blunder: 'Blunder', mistake: 'Mistake', inaccuracy: 'Inaccuracy', miss: 'Miss' };

/** Erreurs de ton camp déduites de l'analyse (elles deviennent des cartes). */
export function errorsFromAnalysis(analysis: GameAnalysis, myColor: 'white' | 'black'): GameError[] {
  const out: GameError[] = [];
  analysis.classes.forEach((cls, i) => {
    const ply = i + 1;
    const severity = SEVERITY_OF[cls];
    const best = analysis.bests[i];
    if (severity && best && (ply % 2 === 1) === (myColor === 'white')) out.push({ ply, severity, bestUci: best });
  });
  return out;
}

/** Évaluation lisible : « +0,8 », « -2,3 » ou « M3 » (mat en 3). Point de vue des blancs. */
export function formatEval(cp: number): string {
  if (Math.abs(cp) >= 9000) return `${cp > 0 ? '' : '-'}M${10000 - Math.abs(cp)}`;
  const v = (Math.round(cp / 10) / 10).toFixed(1).replace('.', ',');
  return cp > 0 ? `+${v}` : v;
}
