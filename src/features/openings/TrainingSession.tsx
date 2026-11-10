import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Lightbulb, Play, X } from 'lucide-react';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { Board, type Feedback } from '../../components/board/Board';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { db, type RepNode, type Repertoire } from '../../db/db';
import { formatLine, loadNodes, recordTraining, ROOT, START_FEN } from '../../db/repertoire';
import { playSound, soundForSan, vibrate } from '../../lib/sounds';

type Phase = 'loading' | 'opp' | 'user' | 'wrong' | 'end';

export function TrainingSession({ repId, onBack }: { repId: string; onBack: () => void }) {
  const [rep, setRep] = useState<Repertoire | null>(null);
  const [nodes, setNodes] = useState<RepNode[]>([]);
  const [currentId, setCurrentId] = useState(ROOT);
  const [phase, setPhase] = useState<Phase>('loading');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [syncKey, setSyncKey] = useState(0);
  const [hint, setHint] = useState(false);
  const [stats, setStats] = useState({ good: 0, bad: 0, lines: 0 });
  const started = useRef(false);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const children = useMemo(() => {
    const m = new Map<string, RepNode[]>();
    for (const n of nodes) m.set(n.parentId, [...(m.get(n.parentId) ?? []), n]);
    return m;
  }, [nodes]);

  /** Variété possible : au moins une position où l'adversaire a plusieurs réponses. */
  const hasVariety = useMemo(() => {
    if (!rep) return false;
    return [...children.entries()].some(([pid, kids]) => {
      const ply = pid === ROOT ? 0 : byId.get(pid)?.ply ?? 0;
      return kids.length > 1 && (ply % 2 === 0) !== (rep.color === 'white');
    });
  }, [children, byId, rep]);

  useEffect(() => {
    void Promise.all([db.repertoires.get(repId), loadNodes(repId)]).then(([r, n]) => {
      if (!r) return;
      setRep(r);
      setNodes(n);
    });
  }, [repId]);

  const nextIsMine = (id: string) => {
    const ply = id === ROOT ? 0 : byId.get(id)?.ply ?? 0;
    return (ply % 2 === 0) === (rep?.color === 'white');
  };

  const advance = (id: string) => {
    const kids = children.get(id);
    if (!kids?.length) {
      setStats((s) => ({ ...s, lines: s.lines + 1 }));
      playSound('end');
      setPhase('end');
      return;
    }
    setPhase(nextIsMine(id) ? 'user' : 'opp');
  };

  const startLine = () => {
    setCurrentId(ROOT);
    setHint(false);
    setFeedback(null);
    advance(ROOT);
  };

  useEffect(() => {
    if (rep && nodes.length && !started.current) {
      started.current = true;
      startLine();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rep, nodes]);

  // L'adversaire joue seul, au hasard parmi les réponses de ton arbre.
  useEffect(() => {
    if (phase !== 'opp') return;
    const t = window.setTimeout(() => {
      const kids = children.get(currentId)!;
      const pick = kids[Math.floor(Math.random() * kids.length)];
      playSound(soundForSan(pick.san));
      setCurrentId(pick.id);
      advance(pick.id);
    }, 650);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentId]);

  const current = byId.get(currentId);
  const kids = children.get(currentId) ?? [];
  const fen = current ? current.fenAfter : START_FEN;
  const lastMove = useMemo<[string, string] | undefined>(
    () => (current ? [current.uci.slice(0, 2), current.uci.slice(2, 4)] : undefined),
    [current],
  );
  const path = useMemo(() => {
    const p: RepNode[] = [];
    for (let n = current; n; n = byId.get(n.parentId)) p.unshift(n);
    return p;
  }, [current, byId]);

  const shapes = useMemo<DrawShape[]>(() => {
    const best = kids[0];
    if (!best) return [];
    const from = best.uci.slice(0, 2) as Key;
    const to = best.uci.slice(2, 4) as Key;
    if (phase === 'wrong') return [{ orig: from, dest: to, brush: 'green' }];
    if (phase === 'user' && hint) return [{ orig: from, brush: 'green' }];
    return [];
  }, [kids, phase, hint]);

  const handleMove = (from: string, to: string) => {
    if (phase !== 'user') return;
    const hit = kids.find((k) => k.uci.slice(0, 4) === from + to);
    if (hit) {
      setStats((s) => ({ ...s, good: s.good + 1 }));
      void recordTraining(repId, hit, hint ? 'hint' : 'good');
      setFeedback({ kind: 'good', id: Date.now() });
      playSound(soundForSan(hit.san));
      setHint(false);
      setCurrentId(hit.id);
      advance(hit.id);
    } else {
      setStats((s) => ({ ...s, bad: s.bad + 1 }));
      void recordTraining(repId, kids[0], 'wrong');
      setFeedback({ kind: 'bad', id: Date.now() });
      playSound('error');
      vibrate(40);
      setSyncKey((k) => k + 1);
      setPhase('wrong');
    }
  };

  const continueAfterMistake = () => {
    const next = kids[0];
    setHint(false);
    setCurrentId(next.id);
    advance(next.id);
  };

  if (!rep) return null;
  if (nodes.length === 0) {
    return (
      <Card className="mx-auto mt-6 max-w-md text-center">
        <p className="text-sm text-muted">Ce répertoire est vide : ajoute des coups avant de t’entraîner.</p>
        <Button className="mt-3" onClick={onBack}>Retour</Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-3 flex items-center gap-2">
        <Button onClick={onBack} aria-label="Quitter" className="w-11 px-0">
          <ArrowLeft size={18} />
        </Button>
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl">Entraînement · {rep.name}</h2>
          <p className="text-sm text-muted">
            {rep.color === 'white' ? 'Tu joues les blancs' : 'Tu joues les noirs'} · {stats.good} juste{stats.good > 1 ? 's' : ''} · {stats.bad} erreur{stats.bad > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,560px)_1fr]">
        <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-16rem))] lg:max-w-none">
          <Board
            fen={fen}
            orientation={rep.color}
            lastMove={lastMove}
            onMove={handleMove}
            viewOnly={phase !== 'user'}
            feedback={feedback}
            shapes={shapes}
            syncKey={syncKey}
          />
        </div>

        <div className="flex flex-col gap-3">
          <Card>
            <p className="font-mono text-sm">{path.length ? formatLine(path) : 'Position de départ'}</p>
            <p className="mt-2 text-sm text-muted">
              {phase === 'opp' && 'L’adversaire joue…'}
              {phase === 'user' && 'À toi de jouer : trouve le coup de ton répertoire.'}
              {phase === 'wrong' && 'Mauvais coup.'}
              {phase === 'end' && 'Fin de la ligne.'}
            </p>
          </Card>

          <AnimatePresence mode="wait" initial={false}>
            {phase === 'wrong' && (
              <motion.div key="wrong" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                <div className="flex items-start gap-2 rounded-2xl bg-bad/15 p-4 text-bad">
                  <X size={20} className="mt-0.5 shrink-0" />
                  <p>
                    Le bon coup était <strong>{kids[0]?.san}</strong>
                    {kids.length > 1 && <> (ou {kids.slice(1).map((k) => k.san).join(', ')})</>}.
                    {kids[0]?.comment && <span className="mt-1 block text-sm opacity-80">{kids[0].comment}</span>}
                  </p>
                </div>
                <Button variant="primary" onClick={continueAfterMistake}>
                  <Play size={16} /> Continuer la ligne
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {phase === 'user' && (
            <Button onClick={() => setHint(true)} disabled={hint}>
              <Lightbulb size={16} /> Indice
            </Button>
          )}

          {phase === 'end' && (
            <Card className="text-center">
              <h3 className="font-display text-xl">Fin du répertoire</h3>
              <p className="mt-2 text-sm text-muted">
                Séance : {stats.lines} ligne{stats.lines > 1 ? 's' : ''}, {stats.good} coup{stats.good > 1 ? 's' : ''} juste{stats.good > 1 ? 's' : ''}, {stats.bad} erreur{stats.bad > 1 ? 's' : ''}.
              </p>
              {!hasVariety && (
                <p className="mt-2 text-sm text-warn">
                  Ton arbre n’a qu’une réponse adverse par position : ajoute des variantes adverses pour varier l’entraînement.
                </p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button onClick={onBack}>Terminer</Button>
                <Button variant="primary" onClick={startLine}>Nouvelle ligne</Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
