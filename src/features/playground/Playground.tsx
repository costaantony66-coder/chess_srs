import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FlipVertical2, RotateCcw, Undo2 } from 'lucide-react';
import { Board, type Feedback } from '../../components/board/Board';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { RatingButtons } from '../../components/ui/RatingButtons';
import { useChessGame } from '../../hooks/useChessGame';

export function Playground() {
  const game = useChessGame();
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const handleMove = (from: string, to: string) => {
    const move = game.play(from, to);
    if (!move) return;
    const kind = move.san.endsWith('#') ? 'good' : move.san.endsWith('+') ? 'warn' : null;
    if (kind) setFeedback({ kind, id: Date.now() });
  };

  const status = game.isCheckmate
    ? `Échec et mat — ${game.turn === 'w' ? 'les noirs' : 'les blancs'} gagnent`
    : game.isDraw
      ? 'Partie nulle'
      : `${game.turn === 'w' ? 'Aux blancs' : 'Aux noirs'} de jouer${game.inCheck ? ' · échec' : ''}`;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[minmax(0,640px)_1fr]">
      <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-16rem))] lg:max-w-none">
        <Board
          fen={game.fen}
          orientation={orientation}
          lastMove={game.lastMove}
          onMove={handleMove}
          feedback={feedback}
        />
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <p className="font-display text-lg">{status}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>
              <FlipVertical2 size={16} /> Retourner
            </Button>
            <Button onClick={game.undo} disabled={game.history.length === 0}>
              <Undo2 size={16} /> Annuler
            </Button>
            <Button onClick={game.reset} disabled={game.history.length === 0}>
              <RotateCcw size={16} /> Reset
            </Button>
          </div>
        </Card>

        <Card className="min-h-24">
          <p className="mb-2 text-sm text-muted">Coups</p>
          {game.history.length === 0 ? (
            <p className="text-sm text-muted">Joue un coup sur l’échiquier.</p>
          ) : (
            <ol className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-sm">
              <AnimatePresence initial={false}>
                {game.history.map((m, i) => (
                  <motion.li
                    key={i}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={i === game.history.length - 1 ? 'font-semibold text-accent' : ''}
                  >
                    {i % 2 === 0 && <span className="mr-1 text-muted">{i / 2 + 1}.</span>}
                    {m.san}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          )}
        </Card>

        <Card>
          <p className="mb-2 text-sm text-muted">Notation FSRS (branchée en phase 2)</p>
          <RatingButtons disabled />
        </Card>
      </div>
    </div>
  );
}
