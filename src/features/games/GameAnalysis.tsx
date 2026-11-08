import { useRef, useState } from 'react';
import { Cpu } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import type { Game } from '../../db/db';
import { analyseStoredGame } from '../../db/analysis';
import { Uci, stockfishWorker } from '../../lib/engine';
import type { Severity } from '../../lib/games';

const DEPTHS = [
  { label: 'Rapide', depth: 10 },
  { label: 'Normal', depth: 12 },
  { label: 'Précis', depth: 15 },
];
const COUNTS: { label: string; n: number }[] = [
  { label: '1', n: 1 },
  { label: '2', n: 2 },
  { label: '5', n: 5 },
  { label: '10', n: 10 },
  { label: '20', n: 20 },
  { label: 'Toutes', n: Infinity },
];
const LEVELS: Severity[] = ['Blunder', 'Mistake', 'Inaccuracy', 'Miss'];
const LEVEL_LABEL: Record<Severity, string> = { Blunder: 'Gaffes', Mistake: 'Erreurs', Inaccuracy: 'Imprécisions', Miss: 'Coups manqués' };

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-10 rounded-full px-3 text-sm transition active:scale-95 ${active ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg'}`}
    >
      {children}
    </button>
  );
}

type Props = {
  /** Parties sans analyse, les plus récentes d'abord. */
  candidates: Game[];
  /** Parties cochées dans « Sélectionner » : elles remplacent le choix par nombre (réanalyse comprise). */
  selection: Game[];
  onDone: () => void;
};

/** Analyse Stockfish complète (dans le navigateur) : chaque coup est classé, les erreurs deviennent des cartes. */
export function GameAnalysis({ candidates, selection, onDone }: Props) {
  const [levels, setLevels] = useState<Severity[]>(['Blunder', 'Mistake']);
  const [depth, setDepth] = useState(12);
  const [count, setCount] = useState(5);
  const [progress, setProgress] = useState<{ game: number; total: number; pos: number; plies: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  if (candidates.length === 0 && selection.length === 0 && !progress && !msg) return null;

  const targets = selection.length ? selection : candidates.slice(0, Math.min(count, candidates.length));
  const toggle = (s: Severity) => setLevels((l) => (l.includes(s) ? l.filter((x) => x !== s) : [...l, s]));

  const run = async () => {
    setMsg(null);
    const ctl = new AbortController();
    abort.current = ctl;
    const engine = new Uci(stockfishWorker());
    let cards = 0;
    let done = 0;
    try {
      await engine.init(2);
      for (const [i, g] of targets.entries()) {
        const r = await analyseStoredGame(g, engine, new Set(levels), {
          depth,
          signal: ctl.signal,
          onProgress: (pos, plies) => setProgress({ game: i + 1, total: targets.length, pos, plies }),
        });
        cards += r.cards;
        done++;
      }
      setMsg(`${done} partie${done > 1 ? 's' : ''} analysée${done > 1 ? 's' : ''}, ${cards} carte${cards > 1 ? 's' : ''} d’erreur créée${cards > 1 ? 's' : ''}. Ouvre une partie pour voir l’analyse détaillée.`);
    } catch (e) {
      setMsg(
        e instanceof DOMException && e.name === 'AbortError'
          ? `Analyse interrompue (${done} partie${done > 1 ? 's' : ''} terminée${done > 1 ? 's' : ''}, ${cards} carte${cards > 1 ? 's' : ''}).`
          : 'Impossible de lancer Stockfish. Vérifie ta connexion au premier lancement (le moteur de 2 Mo est ensuite gardé en cache).',
      );
    } finally {
      engine.terminate();
      setProgress(null);
      abort.current = null;
      onDone();
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Cpu size={18} className="text-accent" />
        <h2 className="font-display text-xl">Analyse Stockfish</h2>
      </div>
      <p className="mt-2 text-sm text-muted">
        Stockfish tourne dans ton navigateur (environ 40 s par partie). Il classe chaque coup (meilleur coup, imprécision, erreur, gaffe…) et crée des cartes à partir de tes erreurs.
      </p>

      {progress ? (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-accent transition-all" style={{ width: `${(progress.pos / progress.plies) * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted">
            Partie {progress.game}/{progress.total} · position {progress.pos}/{progress.plies}
          </p>
          <Button className="mt-3 w-full" onClick={() => abort.current?.abort()}>
            Annuler
          </Button>
        </div>
      ) : (
        targets.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            {selection.length === 0 && (
              <div>
                <p className="mb-2 text-sm text-muted">Combien de parties analyser ? ({candidates.length} sans analyse, les plus récentes d’abord)</p>
                <div className="flex flex-wrap gap-2">
                  {COUNTS.map((c) => (
                    <Chip key={c.label} active={count === c.n} onClick={() => setCount(c.n)}>
                      {c.label}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="mb-2 text-sm text-muted">Cartes à créer à partir de tes…</p>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((s) => (
                  <Chip key={s} active={levels.includes(s)} onClick={() => toggle(s)}>
                    {LEVEL_LABEL[s]}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {DEPTHS.map((d) => (
                <Chip key={d.depth} active={depth === d.depth} onClick={() => setDepth(d.depth)}>
                  {d.label}
                </Chip>
              ))}
            </div>
            <Button variant="primary" onClick={() => void run()}>
              {selection.length
                ? `Analyser la sélection (${targets.length})`
                : `Analyser ${targets.length} partie${targets.length > 1 ? 's' : ''}`}
            </Button>
          </div>
        )
      )}
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </Card>
  );
}


