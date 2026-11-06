import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { Chess, SQUARES } from 'chess.js';

export type Feedback = { kind: 'good' | 'bad' | 'warn'; id: number };

type Props = {
  fen: string;
  orientation?: 'white' | 'black';
  lastMove?: [string, string];
  /** Appelé quand l'utilisateur joue un coup légal sur l'échiquier. */
  onMove?: (from: string, to: string) => void;
  viewOnly?: boolean;
  /** Flash de couleur par-dessus l'échiquier (changer `id` pour le rejouer). */
  feedback?: Feedback | null;
  /** Flèches / cercles (indice, solution). À mémoïser côté appelant. */
  shapes?: DrawShape[];
  /** Incrémenter pour forcer la remise de l'échiquier sur `fen` (ex. coup refusé). */
  syncKey?: number;
  className?: string;
};

function toDests(chess: Chess): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  for (const sq of SQUARES) {
    const moves = chess.moves({ square: sq, verbose: true });
    if (moves.length) dests.set(sq, moves.map((m) => m.to as Key));
  }
  return dests;
}

const FLASH = { good: 'var(--good)', bad: 'var(--bad)', warn: 'var(--warn)' } as const;

export function Board({
  fen,
  orientation = 'white',
  lastMove,
  onMove,
  viewOnly = false,
  feedback,
  shapes,
  syncKey = 0,
  className,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, { animation: { enabled: true, duration: 220 } });
    return () => {
      api.current?.destroy();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    const chess = new Chess(fen);
    const turn = chess.turn() === 'w' ? 'white' : 'black';
    api.current?.set({
      fen,
      orientation,
      turnColor: turn,
      check: chess.inCheck(),
      lastMove: lastMove as Key[] | undefined,
      viewOnly,
      coordinates: true,
      movable: {
        free: false,
        color: viewOnly ? undefined : turn,
        dests: viewOnly ? new Map() : toDests(chess),
        showDests: true,
        events: { after: (from, to) => onMoveRef.current?.(from, to) },
      },
      draggable: { showGhost: true },
    });
    api.current?.setAutoShapes(shapes ?? []);
  }, [fen, orientation, lastMove, viewOnly, shapes, syncKey]);

  return (
    <div className={`relative ${className ?? ''}`}>
      <div ref={el} className="aspect-square w-full" />
      {feedback && (
        <motion.div
          key={feedback.id}
          initial={{ opacity: 0.55 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{ background: FLASH[feedback.kind] }}
        />
      )}
    </div>
  );
}
