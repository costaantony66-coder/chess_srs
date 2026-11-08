import { useRef, useState } from 'react';
import { Cpu } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import type { Game } from '../../db/db';
import { analyseStoredGame } from '../../db/analysis';
import { Uci, stockfishWorker } from '../../lib/engine';
import { SEVERITY_LABEL, type Severity } from '../../lib/games';

const DEPTHS = [
  { label: 'Rapide', depth: 10 },
  { label: 'Normal', depth: 12 },
  { label: 'Précis', depth: 15 },
];

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

/** Analyse Stockfish (dans le navigateur) des parties sans analyse, puis création des cartes d'erreurs. */
export function GameAnalysis({ games, onDone }: { games: Game[]; onDone: () => void }) {
  const [levels, setLevels] = useState<Severity[]>(['Blunder', 'Mistake']);
  const [depth, setDepth] = useState(12);
  const [progress, setProgress] = useState<{ game: number; total: number; pos: number; plies: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  if (games.length === 0 && !progress && !msg) return null;

  const toggle = (s: Severity) => setLevels((l) => (l.includes(s) ? l.filter((x) => x !== s) : [...l, s]));

  const run = async () => {
    setMsg(null);
    const ctl = new AbortController();
    abort.current = ctl;
    const engine = new Uci(stockfishWorker());
    let cards = 0;
    let done = 0;
    try {
      await engine.init();
      for (const [i, g] of games.entries()) {
        const r = await analyseStoredGame(g, engine, new Set(levels), {
          depth,
          signal: ctl.signal,
          onProgress: (pos, plies) => setProgress({ game: i + 1, total: games.length, pos, plies }),
        });
        cards += r.cards;
        done++;
      }
      setMsg(`${done} partie${done > 1 ? 's' : ''} analysée${done > 1 ? 's' : ''}, ${cards} carte${cards > 1 ? 's' : ''} d’erreur créée${cards > 1 ? 's' : ''}.`);
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
      {games.length > 0 && (
        <p className="mt-2 text-sm text-muted">
          {games.length} partie{games.length > 1 ? 's' : ''} sans analyse. Stockfish tourne dans ton navigateur (environ 30 s par partie) et crée les cartes d’erreurs.
        </p>
      )}

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
        games.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {(['Blunder', 'Mistake', 'Inaccuracy'] as Severity[]).map((s) => (
                <Chip key={s} active={levels.includes(s)} onClick={() => toggle(s)}>
                  {SEVERITY_LABEL[s]}s
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {DEPTHS.map((d) => (
                <Chip key={d.depth} active={depth === d.depth} onClick={() => setDepth(d.depth)}>
                  {d.label}
                </Chip>
              ))}
            </div>
            <Button variant="primary" disabled={levels.length === 0} onClick={() => void run()}>
              Analyser {games.length} partie{games.length > 1 ? 's' : ''}
            </Button>
          </div>
        )
      )}
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </Card>
  );
}
