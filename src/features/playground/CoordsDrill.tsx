import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Play, Square } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { saveDrill, getBestByDuration, getSquareStats } from '../../db/drills';
import type { DrillRun } from '../../db/db';
import { usePersistentState } from '../../hooks/usePersistentState';
import { DURATIONS, PENALTY_MS, accuracy, durationLabel, nextTarget, typedSquare, weightsFromStats } from '../../lib/coords';
import { weakSquares } from '../../lib/drills';
import { playSound, vibrate } from '../../lib/sounds';
import { SquareBoard, type SquareFlash } from './SquareBoard';

type Phase = 'setup' | 'countdown' | 'running' | 'done';
type Result = Omit<DrillRun, 'id'> & { isRecord: boolean; first: boolean };

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-10 rounded-full px-3 text-sm transition active:scale-95 ${active ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg'}`}
    >
      {children}
    </button>
  );
}

const fmtSec = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',');

/** Entraînement aux coordonnées : un nom de case s'affiche, tu touches la bonne case avant la fin du chrono. */
export function CoordsDrill() {
  const [duration, setDuration] = usePersistentState('drill:duration', '60');
  const [orientChoice, setOrientChoice] = usePersistentState('drill:orient', 'white');
  const [aid, setAid] = usePersistentState('drill:aid', 'off');
  const [adaptive, setAdaptive] = usePersistentState('drill:adaptive', 'off');

  const [phase, setPhase] = useState<Phase>('setup');
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [count, setCount] = useState(3);
  const [target, setTarget] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [errors, setErrors] = useState(0);
  const [streak, setStreak] = useState(0);
  const [flash, setFlash] = useState<SquareFlash | null>(null);
  const [penalty, setPenalty] = useState<number | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [best, setBest] = useState<Record<number, number>>({});

  /** État de la manche en cours : en ref pour que les minuteries et le clavier voient toujours les dernières valeurs. */
  const run = useRef({
    running: false,
    dur: 60,
    o: 'white' as 'white' | 'black',
    endAt: 0,
    targetAt: 0,
    target: '',
    correct: 0,
    errors: 0,
    timeSum: 0,
    ok: {} as Record<string, number>,
    ko: {} as Record<string, number>,
    weights: undefined as Record<string, number> | undefined,
    pending: null as string | null,
  });

  useEffect(() => {
    void getBestByDuration().then(setBest);
  }, []);

  const start = async () => {
    const dur = Number(duration);
    const o = orientChoice === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : (orientChoice as 'white' | 'black');
    const weights = adaptive === 'on' ? weightsFromStats(await getSquareStats()) : undefined;
    run.current = { running: false, dur, o, endAt: 0, targetAt: 0, target: '', correct: 0, errors: 0, timeSum: 0, ok: {}, ko: {}, weights, pending: null };
    setOrientation(o);
    setCorrect(0);
    setErrors(0);
    setStreak(0);
    setResult(null);
    setFlash(null);
    setPending(null);
    setTarget(null);
    setCount(3);
    setPhase('countdown');
  };

  const begin = () => {
    const r = run.current;
    const now = Date.now();
    r.running = true;
    r.endAt = now + r.dur * 1000;
    r.target = nextTarget(null, Math.random, r.weights);
    r.targetAt = now;
    setTarget(r.target);
    setRemaining(r.dur * 1000);
    setPhase('running');
  };

  const finish = async () => {
    const r = run.current;
    if (!r.running) return;
    r.running = false;
    setRemaining(0);
    setTarget(null);
    setPending(null);
    const rec: Omit<DrillRun, 'id'> = {
      ts: Date.now(),
      kind: 'coords',
      durationSec: r.dur,
      orientation: r.o,
      aid: aid === 'on',
      correct: r.correct,
      errors: r.errors,
      avgMs: r.correct ? Math.round(r.timeSum / r.correct) : 0,
      ok: r.ok,
      ko: r.ko,
    };
    const prev = (await getBestByDuration())[r.dur];
    await saveDrill(rec);
    setBest(await getBestByDuration());
    setResult({ ...rec, isRecord: prev !== undefined && r.correct > prev, first: prev === undefined });
    setPhase('done');
    playSound('end');
  };

  const abandon = () => {
    run.current.running = false;
    setPhase('setup');
    setTarget(null);
    setPending(null);
  };

  const answer = (sq: string) => {
    const r = run.current;
    if (!r.running) return;
    const now = Date.now();
    if (sq === r.target) {
      r.correct++;
      r.ok[r.target] = (r.ok[r.target] ?? 0) + 1;
      r.timeSum += now - r.targetAt;
      setCorrect(r.correct);
      setStreak((s) => s + 1);
      setFlash({ square: sq, kind: 'good', id: now });
      playSound('move');
      r.target = nextTarget(r.target, Math.random, r.weights);
      r.targetAt = now;
      setTarget(r.target);
    } else {
      r.errors++;
      r.ko[r.target] = (r.ko[r.target] ?? 0) + 1;
      r.endAt -= PENALTY_MS;
      setErrors(r.errors);
      setStreak(0);
      setFlash({ square: sq, kind: 'bad', id: now });
      setPenalty(now);
      playSound('error');
      vibrate(40);
      const left = r.endAt - now;
      setRemaining(Math.max(0, left));
      if (left <= 0) void finish();
    }
  };

  // Décompte 3, 2, 1 puis départ.
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count <= 0) {
      begin();
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, count]);

  // Chronomètre : calculé sur l'heure réelle (insensible aux ralentissements de l'onglet).
  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => {
      const left = run.current.endAt - Date.now();
      if (left <= 0) void finish();
      else setRemaining(left);
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Saisie au clavier (« f » puis « 7 ») et Échap pour arrêter.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => undefined);
  onKey.current = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'Escape' && (phase === 'running' || phase === 'countdown')) {
      abandon();
      return;
    }
    if (phase !== 'running') return;
    const t = typedSquare(run.current.pending, e.key);
    run.current.pending = t.pending;
    setPending(t.pending);
    if (t.square) answer(t.square);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  useEffect(() => {
    if (penalty === null) return;
    const t = setTimeout(() => setPenalty(null), 900);
    return () => clearTimeout(t);
  }, [penalty]);

  const durMs = (phase === 'running' ? run.current.dur : Number(duration)) * 1000;
  const heat: Record<string, number> | undefined =
    phase === 'done' && result
      ? Object.fromEntries(Object.entries(result.ko).map(([sq, ko]) => [sq, ko / (ko + (result.ok[sq] ?? 0))]))
      : undefined;
  const weak = result ? weakSquares(Object.fromEntries(Object.keys({ ...result.ok, ...result.ko }).map((sq) => [sq, { ok: result.ok[sq] ?? 0, ko: result.ko[sq] ?? 0 }])), { min: 1, top: 3 }) : [];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,560px)_1fr]">
      <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-20rem))] xl:max-w-none">
        <SquareBoard
          orientation={phase === 'setup' ? (orientChoice === 'black' ? 'black' : 'white') : orientation}
          onSquare={phase === 'running' ? answer : undefined}
          showCoords={aid === 'on'}
          flash={flash}
          heat={heat}
        />
      </div>

      <div className="order-first flex flex-col gap-4 xl:order-none">
        {phase === 'setup' && (
          <Card>
            <h2 className="font-display text-xl">Retrouve les cases</h2>
            <p className="mt-1 text-sm text-muted">
              Un nom de case s’affiche (par exemple <strong className="text-fg">F7</strong>) : touche-la sur l’échiquier vierge. Chaque erreur te coûte {PENALTY_MS / 1000} secondes.
            </p>

            <p className="mt-4 text-sm text-muted">Durée</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(String(d))}
                  aria-pressed={Number(duration) === d}
                  className={`rounded-xl px-2 py-2 text-sm transition active:scale-95 ${Number(duration) === d ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg'}`}
                >
                  <span className="block font-medium">{durationLabel(d)}</span>
                  <span className="block text-xs opacity-70">{best[d] ? `Record ${best[d]}` : '—'}</span>
                </button>
              ))}
            </div>

            <p className="mt-4 text-sm text-muted">Point de vue</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip active={orientChoice === 'white'} onClick={() => setOrientChoice('white')}>Blancs</Chip>
              <Chip active={orientChoice === 'black'} onClick={() => setOrientChoice('black')}>Noirs</Chip>
              <Chip active={orientChoice === 'random'} onClick={() => setOrientChoice('random')}>Au hasard</Chip>
            </div>

            <p className="mt-4 text-sm text-muted">Options</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip active={aid === 'on'} onClick={() => setAid(aid === 'on' ? 'off' : 'on')}>Afficher les coordonnées (aide)</Chip>
              <Chip active={adaptive === 'on'} onClick={() => setAdaptive(adaptive === 'on' ? 'off' : 'on')}>Insister sur mes cases difficiles</Chip>
            </div>

            <Button variant="primary" className="mt-5 w-full" onClick={() => void start()}>
              <Play size={16} /> Commencer
            </Button>
            <p className="mt-2 text-center text-xs text-muted">Sur ordinateur, tu peux aussi taper la case au clavier (« f » puis « 7 »).</p>
          </Card>
        )}

        {phase === 'countdown' && (
          <Card className="text-center">
            <p className="text-sm text-muted">Prépare-toi…</p>
            <p className="font-display text-7xl" aria-live="assertive">{Math.max(count, 1)}</p>
            <Button className="mt-3" onClick={abandon}>Annuler</Button>
          </Card>
        )}

        {phase === 'running' && (
          <Card>
            <p className="text-sm text-muted">Case à trouver</p>
            <p className="font-display text-7xl uppercase leading-tight" data-testid="target" aria-live="polite">
              {target}
            </p>
            <p className="h-4 text-xs text-muted">{pending ? `${pending.toUpperCase()}…` : ''}</p>

            <div className="relative mt-3">
              <div className="h-3 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full transition-all ${remaining < 5000 ? 'bg-bad' : 'bg-accent'}`}
                  style={{ width: `${Math.max(0, Math.min(100, (remaining / durMs) * 100))}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span>
                  <strong data-testid="time">{Math.ceil(remaining / 1000)}</strong> s
                </span>
                <AnimatePresence>
                  {penalty !== null && (
                    <motion.span key={penalty} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="font-semibold text-bad">
                      −{PENALTY_MS / 1000} s
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-surface-2 py-2">
                <div className="text-2xl font-semibold text-good" data-testid="correct">{correct}</div>
                <div className="text-xs text-muted">Justes</div>
              </div>
              <div className="rounded-xl bg-surface-2 py-2">
                <div className="text-2xl font-semibold text-bad" data-testid="errors">{errors}</div>
                <div className="text-xs text-muted">Erreurs</div>
              </div>
              <div className="rounded-xl bg-surface-2 py-2">
                <div className="text-2xl font-semibold">{streak}</div>
                <div className="text-xs text-muted">Série</div>
              </div>
            </div>
            <Button className="mt-3 w-full" onClick={abandon}>
              <Square size={14} /> Arrêter (non enregistré)
            </Button>
          </Card>
        )}

        {phase === 'done' && result && (
          <Card>
            <h2 className="font-display text-xl">Terminé !</h2>
            <p className="mt-2 font-display text-5xl" data-testid="final-score">
              {result.correct} <span className="text-lg text-muted">bonne{result.correct > 1 ? 's' : ''} réponse{result.correct > 1 ? 's' : ''}</span>
            </p>
            {result.isRecord && <p className="mt-1 font-medium text-good">Nouveau record pour {durationLabel(result.durationSec)} !</p>}
            {result.first && !result.isRecord && result.correct > 0 && <p className="mt-1 text-sm text-muted">Premier score enregistré pour {durationLabel(result.durationSec)}.</p>}
            <ul className="mt-3 space-y-1 text-sm">
              <li>
                Erreurs : <strong>{result.errors}</strong> · précision : <strong>{accuracy(result.correct, result.errors)} %</strong>
              </li>
              <li>
                Temps moyen par case : <strong>{result.correct ? `${fmtSec(result.avgMs)} s` : '—'}</strong>
              </li>
              {best[result.durationSec] !== undefined && (
                <li>
                  Record ({durationLabel(result.durationSec)}) : <strong>{best[result.durationSec]}</strong>
                </li>
              )}
            </ul>
            {weak.length > 0 && (
              <p className="mt-3 text-sm text-muted">
                Cases à retravailler : <strong className="text-fg">{weak.map((w) => w.square.toUpperCase()).join(', ')}</strong> (en rouge sur l’échiquier).
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button onClick={() => setPhase('setup')}>Réglages</Button>
              <Button variant="primary" onClick={() => void start()}>
                Rejouer
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
