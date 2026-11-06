import { useCallback, useRef, useState } from 'react';
import { Chess, type Move } from 'chess.js';

/** État d'une partie. chess.js est mutable : on force un rendu après chaque action. */
export function useChessGame(initialFen?: string) {
  const chess = useRef(new Chess(initialFen));
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  /** Joue un coup (promotion automatique en dame pour l'instant). Retourne null si illégal. */
  const play = useCallback((from: string, to: string): Move | null => {
    try {
      const move = chess.current.move({ from, to, promotion: 'q' });
      refresh();
      return move;
    } catch {
      refresh(); // resynchronise l'échiquier si le coup est refusé
      return null;
    }
  }, []);

  const undo = useCallback(() => {
    chess.current.undo();
    refresh();
  }, []);

  const reset = useCallback(() => {
    chess.current.reset();
    refresh();
  }, []);

  const c = chess.current;
  const history = c.history({ verbose: true });
  const last = history[history.length - 1];

  return {
    fen: c.fen(),
    history,
    lastMove: last ? ([last.from, last.to] as [string, string]) : undefined,
    turn: c.turn(),
    inCheck: c.inCheck(),
    isCheckmate: c.isCheckmate(),
    isDraw: c.isDraw(),
    isGameOver: c.isGameOver(),
    play,
    undo,
    reset,
  };
}
