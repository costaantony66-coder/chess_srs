import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Lightbulb, X } from 'lucide-react';
import { Chess, type Move } from 'chess.js';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { Board, type Feedback } from '../../components/board/Board';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { RatingButtons } from '../../components/ui/RatingButtons';
import type { StoredCard } from '../../db/db';
import { themeLabel } from '../../data/themes';
import { previewIntervals, type RatingId } from '../../lib/fsrs';

type Phase = 'playing' | 'busy' | 'wrong' | 'solved';

const TYPE_LABEL = { tactic: 'Tactique', opening: 'Ouverture', endgame: 'Finale' } as const;
const uciOf = (m: Move) => m.from + m.to + (m.promotion ?? '');

type Props = {
  card: StoredCard;
  onRate: (rating: RatingId, meta: { durationMs: number; correct: boolean }) => void;
};

export function CardRunner({ card, onRate }: Props) {
  const chess = useRef(new Chess(card.fen));
  const startedAt = useRef(Date.now());
  const timer = useRef<number | undefined>(undefined);

  const [fen, setFen] = useState(card.fen);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('playing');
  const [lastMove, setLastMove] = useState<[string, string] | undefined>(() =>
    card.lastMove ? [card.lastMove.slice(0, 2), card.lastMove.slice(2, 4)] : undefined,
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [syncKey, setSyncKey] = useState(0);
  const [hint, setHint] = useState(false);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const orientation = useMemo(() => (new Chess(card.fen).turn() === 'w' ? 'white' : 'black'), [card.fen]);
  const intervals = useMemo(() => previewIntervals(card.fsrs, new Date()), [card]);
  const expected = card.solution[idx];

  const expectedSan = useMemo(() => {
    if (phase !== 'wrong' || !expected) return null;
    try {
      return new Chess(fen).move({ from: expected.slice(0, 2), to: expected.slice(2, 4), promotion: expected[4] }).san;
    } catch {
      return null;
    }
  }, [phase, fen, expected]);

  const shapes = useMemo<DrawShape[]>(() => {
    if (!expected) return [];
    const from = expected.slice(0, 2) as Key;
    const to = expected.slice(2, 4) as Key;
    if (phase === 'wrong') return [{ orig: from, dest: to, brush: 'green' }];
    if (phase === 'playing' && hint) return [{ orig: from, brush: 'green' }];
    return [];
  }, [expected, phase, hint]);

  const handleMove = (from: string, to: string) => {
    if (phase !== 'playing') return;
    let move: Move;
    try {
      const promotion = expected && expected.slice(0, 4) === from + to ? expected[4] : 'q';
      move = chess.current.move({ from, to, promotion });
    } catch {
      return;
    }
    const mate = move.san.endsWith('#');

    if (uciOf(move) !== expected && !mate) {
      chess.current.undo();
      setFeedback({ kind: 'bad', id: Date.now() });
      setSyncKey((k) => k + 1);
      setPhase('wrong');
      return;
    }

    setFen(chess.current.fen());
    setLastMove([from, to]);
    setFeedback({ kind: 'good', id: Date.now() });
    const next = idx + 1;
    setIdx(next);

    if (mate || next >= card.solution.length) {
      setPhase('solved');
      return;
    }
    setPhase('busy');
    timer.current = window.setTimeout(() => {
      const reply = card.solution[next];
      const rm = chess.current.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] });
      setFen(chess.current.fen());
      setLastMove([rm.from, rm.to]);
      setIdx(next + 1);
      setPhase(next + 1 >= card.solution.length ? 'solved' : 'playing');
    }, 450);
  };

  const rate = (r: RatingId) =>
    onRate(r, { durationMs: Date.now() - startedAt.current, correct: phase === 'solved' });

  const enabled: RatingId[] | undefined =
    phase === 'wrong' ? ['again'] : phase === 'solved' ? (hint ? ['again', 'hard', 'good'] : undefined) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,640px)_1fr]">
      <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-20rem))] lg:max-w-none">
        <Board
          fen={fen}
          orientation={orientation}
          lastMove={lastMove}
          onMove={handleMove}
          viewOnly={phase !== 'playing'}
          feedback={feedback}
          shapes={shapes}
          syncKey={syncKey}
        />
      </div>

      <div className="flex flex-col gap-3">
        <Card>
          <p className="text-sm text-muted">
            {TYPE_LABEL[card.type]}
            {card.tags.length > 0 && ` · ${card.tags.slice(0, 4).map(themeLabel).join(', ')}`}
            {card.rating ? ` · Elo ${card.rating}` : ''}
          </p>
          <h2 className="mt-1 font-display text-xl">{card.title}</h2>
          <p className="mt-1 text-sm text-muted">Trait aux {orientation === 'white' ? 'blancs' : 'noirs'}</p>
        </Card>

        <AnimatePresence mode="wait" initial={false}>
          {phase === 'wrong' && (
            <motion.div
              key="wrong"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-2 rounded-2xl bg-bad/15 p-4 text-bad"
            >
              <X size={20} className="mt-0.5 shrink-0" />
              <p>
                Mauvais coup. Le bon coup était <strong>{expectedSan ?? expected}</strong> (flèche verte).
              </p>
            </motion.div>
          )}
          {phase === 'solved' && (
            <motion.div
              key="solved"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-2xl bg-good/15 p-4 text-good"
            >
              <Check size={20} /> Bien joué. Note ta difficulté.
            </motion.div>
          )}
        </AnimatePresence>

        {(phase === 'playing' || phase === 'busy') && (
          <Button onClick={() => setHint(true)} disabled={hint || phase !== 'playing'}>
            <Lightbulb size={16} /> Indice
          </Button>
        )}

        {(phase === 'wrong' || phase === 'solved') && (
          <RatingButtons onRate={rate} enabled={enabled} intervals={intervals} />
        )}
      </div>
    </div>
  );
}
