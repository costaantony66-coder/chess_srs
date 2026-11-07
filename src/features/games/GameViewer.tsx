import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Wrench } from 'lucide-react';
import { Chess } from 'chess.js';
import { Board } from '../../components/board/Board';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { db, type Game } from '../../db/db';
import { saveManualCard } from '../../db/games';
import { replay } from '../../lib/games';

export function GameViewer({ gameId, onBack, onGoReview }: { gameId: string; onBack: () => void; onGoReview: () => void }) {
  const [game, setGame] = useState<Game | null>(null);
  const [ply, setPly] = useState(0);
  const [fixing, setFixing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [syncKey, setSyncKey] = useState(0);

  useEffect(() => {
    void db.games.get(gameId).then((g) => setGame(g ?? null));
  }, [gameId]);

  const moves = useMemo(() => (game ? game.moves.split(' ').filter(Boolean) : []), [game]);
  const { fens, ucis } = useMemo(() => replay(moves), [moves]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (fixing) return;
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setPly((p) => Math.min(ucis.length, p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fixing, ucis.length]);

  if (!game) return null;
  const last = ucis.length;
  const isMine = (p: number) => (p % 2 === 1) === (game.myColor === 'white');
  const shown = fixing ? ply - 1 : ply;
  const fen = fens[shown] ?? fens[0];
  const prev = ucis[shown - 1];
  const lastMove = prev ? ([prev.slice(0, 2), prev.slice(2, 4)] as [string, string]) : undefined;

  const handleFix = async (from: string, to: string) => {
    const probe = new Chess(fens[ply - 1]);
    let move;
    try {
      move = probe.move({ from, to, promotion: 'q' });
    } catch {
      setSyncKey((k) => k + 1);
      return;
    }
    const uci = move.from + move.to + (move.promotion ?? '');
    setFixing(false);
    if (uci === ucis[ply - 1]) {
      setMsg('C’est le coup que tu as joué dans la partie : aucune carte créée.');
      return;
    }
    await saveManualCard(game, ply, fens[ply - 1], uci, ucis[ply - 2], moves[ply - 1]);
    setMsg(`Carte créée : ${move.san} à la place de ${moves[ply - 1]}.`);
  };

  const label = (i: number) => (i % 2 === 0 ? `${i / 2 + 1}.${moves[i]}` : moves[i]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-3 flex items-center gap-2">
        <Button onClick={onBack} aria-label="Retour" className="w-11 px-0">
          <ArrowLeft size={18} />
        </Button>
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl">
            {game.white} – {game.black}
          </h2>
          <p className="text-sm text-muted">
            {game.result}
            {game.opening ? ` · ${game.opening}` : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,560px)_1fr]">
        <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-18rem))] lg:max-w-none">
          <Board
            fen={fen}
            orientation={game.myColor}
            lastMove={lastMove}
            viewOnly={!fixing}
            onMove={(f, t) => void handleFix(f, t)}
            syncKey={syncKey}
          />
          <div className="mt-3 grid grid-cols-4 gap-2">
            <Button onClick={() => setPly(0)} disabled={fixing || ply === 0} aria-label="Début"><ChevronsLeft size={18} /></Button>
            <Button onClick={() => setPly((p) => p - 1)} disabled={fixing || ply === 0} aria-label="Précédent"><ChevronLeft size={18} /></Button>
            <Button onClick={() => setPly((p) => p + 1)} disabled={fixing || ply >= last} aria-label="Suivant"><ChevronRight size={18} /></Button>
            <Button onClick={() => setPly(last)} disabled={fixing || ply >= last} aria-label="Fin"><ChevronsRight size={18} /></Button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Card>
            {fixing ? (
              <>
                <p className="font-medium">Joue le bon coup sur l’échiquier.</p>
                <p className="mt-1 text-sm text-muted">Position avant ton coup {moves[ply - 1]}.</p>
                <Button className="mt-3 w-full" onClick={() => setFixing(false)}>Annuler</Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">
                  {ply === 0 ? 'Position de départ' : `Après ${label(ply - 1)}`}
                </p>
                <Button
                  className="mt-3 w-full"
                  disabled={ply === 0 || !isMine(ply)}
                  onClick={() => {
                    setMsg(null);
                    setFixing(true);
                  }}
                >
                  <Wrench size={16} /> Corriger ce coup (créer une carte)
                </Button>
                {ply > 0 && !isMine(ply) && <p className="mt-2 text-sm text-muted">Ce coup est celui de ton adversaire.</p>}
              </>
            )}
            {msg && (
              <p className="mt-3 text-sm text-good">
                {msg}{' '}
                <button className="font-medium underline" onClick={onGoReview}>
                  Réviser
                </button>
              </p>
            )}
          </Card>

          <Card>
            <p className="mb-2 text-sm text-muted">Coups (tes coups en gras)</p>
            <div className="flex flex-wrap gap-x-0.5 gap-y-0.5 leading-7">
              {moves.map((_, i) => (
                <button
                  key={i}
                  disabled={fixing}
                  onClick={() => setPly(i + 1)}
                  className={`rounded px-1 py-0.5 font-mono text-sm ${
                    ply === i + 1 ? 'bg-accent text-accent-fg' : isMine(i + 1) ? 'font-semibold hover:bg-surface-2' : 'text-muted hover:bg-surface-2'
                  }`}
                >
                  {label(i)}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
