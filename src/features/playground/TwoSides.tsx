import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw, RotateCcw, Undo2 } from 'lucide-react';
import { Board, type Feedback } from '../../components/board/Board';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useChessGame } from '../../hooks/useChessGame';

/** Plateau libre : tu joues les deux camps, tu peux retourner l'échiquier. */
export function TwoSides() {
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
    ? `Échec et mat : ${game.turn === 'w' ? 'les noirs' : 'les blancs'} gagnent`
    : game.isDraw
      ? 'Partie nulle'
      : `${game.turn === 'w' ? 'Aux blancs' : 'Aux noirs'} de jouer${game.inCheck ? ' · échec' : ''}`;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,560px)_1fr]">
      <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-16rem))] xl:max-w-none">
        <Board fen={game.fen} orientation={orientation} lastMove={game.lastMove} onMove={handleMove} feedback={feedback} />
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <p className="font-display text-lg">{status}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>
              <RefreshCw size={16} /> Retourner
            </Button>
            <Button onClick={game.undo} disabled={game.history.length === 0}>
              <Undo2 size={16} /> Annuler
            </Button>
            <Button onClick={game.reset} disabled={game.history.length === 0}>
              <RotateCcw size={16} /> Reset
            </Button>
          </div>
        </Card>

        <MoveList history={game.history.map((m) => m.san)} />
      </div>
    </div>
  );
}

export function MoveList({ history }: { history: string[] }) {
  return (
    <Card className="min-h-24">
      <p className="mb-2 text-sm text-muted">Coups</p>
      {history.length === 0 ? (
        <p className="text-sm text-muted">Joue un coup sur l’échiquier.</p>
      ) : (
        <ol className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-sm">
          <AnimatePresence initial={false}>
            {history.map((san, i) => (
              <motion.li
                key={i}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={i === history.length - 1 ? 'font-semibold text-accent' : ''}
              >
                {i % 2 === 0 && <span className="mr-1 text-muted">{i / 2 + 1}.</span>}
                {san}
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </Card>
  );
}
