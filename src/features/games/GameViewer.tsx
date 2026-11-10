import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Cpu, Wrench } from 'lucide-react';
import { Chess } from 'chess.js';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { Board } from '../../components/board/Board';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { db, type Game } from '../../db/db';
import { analyseStoredGame } from '../../db/analysis';
import { saveManualCard } from '../../db/games';
import { CLASS_META, formatEval } from '../../lib/analysis';
import { Uci, stockfishWorker } from '../../lib/engine';
import { replay } from '../../lib/games';
import { playSound, soundForSan } from '../../lib/sounds';
import { AnalysisSummary } from './analysis/AnalysisSummary';
import { EvalBar } from './analysis/EvalBar';
import { EvalGraph } from './analysis/EvalGraph';

const BAD = ['inaccuracy', 'mistake', 'miss', 'blunder'];

export function GameViewer({ gameId, onBack, onGoReview }: { gameId: string; onBack: () => void; onGoReview: () => void }) {
  const [game, setGame] = useState<Game | null>(null);
  const [ply, setPly] = useState(0);
  const [fixing, setFixing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [syncKey, setSyncKey] = useState(0);
  const [showBest, setShowBest] = useState(true);
  const [progress, setProgress] = useState<{ pos: number; plies: number } | null>(null);
  const [analysisMsg, setAnalysisMsg] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const load = () => void db.games.get(gameId).then((g) => setGame(g ?? null));
  useEffect(load, [gameId]);

  const moves = useMemo(() => (game ? game.moves.split(' ').filter(Boolean) : []), [game]);
  const { fens, ucis } = useMemo(() => replay(moves), [moves]);
  const analysis = game?.analysis;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (fixing) return;
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setPly((p) => Math.min(ucis.length, p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fixing, ucis.length]);

  const prevPly = useRef(0);
  useEffect(() => {
    if (ply === prevPly.current + 1 && moves[ply - 1]) playSound(soundForSan(moves[ply - 1]));
    prevPly.current = ply;
  }, [ply, moves]);

  const shown = fixing ? ply - 1 : ply;
  const cls = analysis && ply > 0 ? analysis.classes[ply - 1] : undefined;
  const bestUci = analysis && ply > 0 ? analysis.bests[ply - 1] : '';
  const bestSan = useMemo(() => {
    if (!bestUci || ply === 0) return null;
    try {
      return new Chess(fens[ply - 1]).move({ from: bestUci.slice(0, 2), to: bestUci.slice(2, 4), promotion: bestUci[4] }).san;
    } catch {
      return null;
    }
  }, [bestUci, fens, ply]);

  const shapes = useMemo<DrawShape[]>(() => {
    if (fixing || !showBest || !cls || !BAD.includes(cls) || !bestUci || bestUci === ucis[ply - 1]) return [];
    return [{ orig: bestUci.slice(0, 2) as Key, dest: bestUci.slice(2, 4) as Key, brush: 'green' }];
  }, [fixing, showBest, cls, bestUci, ucis, ply]);

  if (!game) return null;
  const last = ucis.length;
  const isMine = (p: number) => (p % 2 === 1) === (game.myColor === 'white');
  const fen = fens[shown] ?? fens[0];
  const prev = ucis[shown - 1];
  const lastMove = prev ? ([prev.slice(0, 2), prev.slice(2, 4)] as [string, string]) : undefined;
  const label = (i: number) => (i % 2 === 0 ? `${i / 2 + 1}.${moves[i]}` : moves[i]);

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

  const analyse = async () => {
    setAnalysisMsg(null);
    const ctl = new AbortController();
    abort.current = ctl;
    const engine = new Uci(stockfishWorker());
    try {
      await engine.init(2);
      const r = await analyseStoredGame(game, engine, new Set(['Blunder', 'Mistake']), {
        depth: 12,
        signal: ctl.signal,
        onProgress: (pos, plies) => setProgress({ pos, plies }),
      });
      setAnalysisMsg(`Analyse terminée : ${r.cards} carte${r.cards > 1 ? 's' : ''} d’erreur créée${r.cards > 1 ? 's' : ''} (gaffes et erreurs).`);
    } catch (e) {
      setAnalysisMsg(
        e instanceof DOMException && e.name === 'AbortError'
          ? 'Analyse interrompue.'
          : 'Impossible de lancer Stockfish. Vérifie ta connexion au premier lancement.',
      );
    } finally {
      engine.terminate();
      setProgress(null);
      abort.current = null;
      load();
    }
  };

  const meta = cls ? CLASS_META[cls] : null;

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
          <p className="truncate text-sm text-muted">
            {game.result}
            {game.opening ? ` · ${game.opening}` : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,600px)_1fr]">
        <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-18rem))] lg:max-w-none">
          <div className="flex gap-2">
            {analysis && <EvalBar cp={analysis.evals[shown] ?? 0} orientation={game.myColor} />}
            <div className="min-w-0 flex-1">
              <Board
                fen={fen}
                orientation={game.myColor}
                lastMove={lastMove}
                viewOnly={!fixing}
                onMove={(f, t) => void handleFix(f, t)}
                shapes={shapes}
                syncKey={syncKey}
              />
            </div>
          </div>
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
                <p className="text-sm text-muted">{ply === 0 ? 'Position de départ' : `Après ${label(ply - 1)}`}</p>
                {meta && (
                  <div className="mt-2">
                    <p className="flex items-center gap-2 font-medium">
                      <span className="rounded-md px-2 py-0.5 text-sm font-semibold text-white" style={{ background: meta.color }}>
                        {meta.symbol || '•'}
                      </span>
                      {moves[ply - 1]} · {meta.label}
                      <span className="ml-auto font-mono text-sm text-muted">{formatEval(analysis!.evals[ply])}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted">{meta.hint}</p>
                    {BAD.includes(cls!) && bestSan && (
                      <p className="mt-2 text-sm">
                        Meilleur coup : <strong>{bestSan}</strong>{' '}
                        <button className="text-accent underline" onClick={() => setShowBest((v) => !v)}>
                          {showBest ? 'masquer la flèche' : 'afficher la flèche'}
                        </button>
                      </p>
                    )}
                  </div>
                )}
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

          {analysis ? (
            <>
              <Card>
                <AnalysisSummary game={game} />
              </Card>
              <Card>
                <p className="mb-2 text-sm text-muted">Évaluation de la partie (clique ou glisse pour te déplacer)</p>
                <EvalGraph analysis={analysis} myColor={game.myColor} ply={ply} onSelect={(p) => !fixing && setPly(p)} />
              </Card>
            </>
          ) : null}

          <Card>
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-accent" />
              <p className="text-sm font-medium">{analysis ? 'Réanalyser la partie' : 'Cette partie n’est pas analysée'}</p>
            </div>
            {progress ? (
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full bg-accent transition-all" style={{ width: `${(progress.pos / progress.plies) * 100}%` }} />
                </div>
                <p className="mt-2 text-sm text-muted">Position {progress.pos}/{progress.plies}</p>
                <Button className="mt-2 w-full" onClick={() => abort.current?.abort()}>Annuler</Button>
              </div>
            ) : (
              <Button className="mt-3 w-full" variant={analysis ? 'ghost' : 'primary'} onClick={() => void analyse()}>
                {analysis ? 'Réanalyser avec Stockfish' : 'Analyser avec Stockfish (≈40 s)'}
              </Button>
            )}
            {analysisMsg && <p className="mt-2 text-sm">{analysisMsg}</p>}
          </Card>

          <Card>
            <p className="mb-2 text-sm text-muted">Coups (tes coups en gras)</p>
            <div className="flex flex-wrap gap-x-0.5 gap-y-0.5 leading-7">
              {moves.map((_, i) => {
                const c = analysis?.classes[i];
                const m = c ? CLASS_META[c] : null;
                return (
                  <button
                    key={i}
                    disabled={fixing}
                    onClick={() => setPly(i + 1)}
                    className={`flex items-center gap-1 rounded px-1 py-0.5 font-mono text-sm ${
                      ply === i + 1 ? 'bg-accent text-accent-fg' : isMine(i + 1) ? 'font-semibold hover:bg-surface-2' : 'text-muted hover:bg-surface-2'
                    }`}
                  >
                    {m && <span className="size-2 shrink-0 rounded-full" style={{ background: m.color }} />}
                    {label(i)}
                    {m?.symbol && <span style={{ color: ply === i + 1 ? undefined : m.color }}>{m.symbol}</span>}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
