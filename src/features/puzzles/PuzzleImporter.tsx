import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { THEMES } from '../../data/themes';
import { importPuzzles, loadIndex, type PackIndex } from '../../data/puzzles';
import { db } from '../../db/db';

const LEVELS = [
  { label: 'Débutant', min: 600, max: 1200 },
  { label: 'Intermédiaire', min: 1200, max: 1600 },
  { label: 'Avancé', min: 1600, max: 2000 },
  { label: 'Expert', min: 2000, max: 2800 },
];
const COUNTS = [10, 25, 50, 100];

function Chip({ active, disabled, onClick, children }: { active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-h-10 rounded-full px-3 text-sm transition active:scale-95 disabled:opacity-35 ${
        active ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg'
      }`}
    >
      {children}
    </button>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      {label}
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-24 rounded-xl border border-border bg-surface-2 px-3 text-fg"
      />
    </label>
  );
}

export function PuzzleImporter({ onGoReview }: { onGoReview: () => void }) {
  const [index, setIndex] = useState<PackIndex | null | 'missing'>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [min, setMin] = useState(1200);
  const [max, setMax] = useState(1600);
  const [count, setCount] = useState(25);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [owned, setOwned] = useState(0);

  const refreshOwned = () => void db.cards.where('type').equals('tactic').count().then(setOwned);

  useEffect(() => {
    loadIndex().then(setIndex).catch(() => setIndex('missing'));
    refreshOwned();
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, typeof THEMES>();
    for (const t of THEMES) map.set(t.group, [...(map.get(t.group) ?? []), t]);
    return [...map.entries()];
  }, []);

  const add = async () => {
    if (!theme) return;
    setBusy(true);
    setMsg(null);
    try {
      const { added, available } = await importPuzzles({ theme, min, max, count });
      setMsg(
        added === 0
          ? 'Aucun nouveau puzzle dans cette tranche : élargis le niveau ou change de thème.'
          : added < count
            ? `${added} puzzles ajoutés (c’est tout ce qu’il reste dans cette tranche, sur ${available} disponibles).`
            : `${added} puzzles ajoutés à ton paquet.`,
      );
      refreshOwned();
    } catch {
      setMsg('Impossible de charger ce pack de puzzles.');
    }
    setBusy(false);
  };

  if (index === null) return null;

  if (index === 'missing') {
    return (
      <Card className="mx-auto mt-6 max-w-md text-center">
        <h2 className="font-display text-2xl">Packs de puzzles absents</h2>
        <p className="mt-2 text-sm text-muted">
          Les puzzles Lichess sont générés au déploiement sur GitHub Pages. Ils ne sont pas disponibles en local ni si
          l’étape « Générer les packs de puzzles » a échoué.
        </p>
      </Card>
    );
  }

  const available = (key: string) => key in index.themes;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Card>
        <h2 className="font-display text-xl">1. Thème</h2>
        <div className="mt-3 flex flex-col gap-4">
          {groups.map(([group, items]) => (
            <div key={group}>
              <p className="mb-2 text-sm text-muted">{group}</p>
              <div className="flex flex-wrap gap-2">
                {items.map((t) => (
                  <Chip key={t.key} active={theme === t.key} disabled={!available(t.key)} onClick={() => setTheme(t.key)}>
                    {t.label}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-xl">2. Niveau (Elo)</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <Chip key={l.label} active={min === l.min && max === l.max} onClick={() => (setMin(l.min), setMax(l.max))}>
              {l.label} · {l.min}–{l.max}
            </Chip>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <NumberField label="Min" value={min} onChange={setMin} />
          <NumberField label="Max" value={max} onChange={setMax} />
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-xl">3. Nombre</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {COUNTS.map((n) => (
            <Chip key={n} active={count === n} onClick={() => setCount(n)}>
              {n}
            </Chip>
          ))}
        </div>
        <Button variant="primary" className="mt-4 w-full" disabled={!theme || busy || min > max} onClick={() => void add()}>
          <Plus size={18} /> {busy ? 'Ajout…' : `Ajouter ${count} puzzles`}
        </Button>
        {msg && (
          <div className="mt-3 text-sm">
            <p>{msg}</p>
            <button className="mt-1 font-medium text-accent" onClick={onGoReview}>
              Aller réviser →
            </button>
          </div>
        )}
      </Card>

      <p className="text-center text-sm text-muted">
        {owned} carte{owned > 1 ? 's' : ''} tactique{owned > 1 ? 's' : ''} dans ton paquet · puzzles{' '}
        <a className="underline" href="https://database.lichess.org/#puzzles" target="_blank" rel="noreferrer">
          Lichess
        </a>{' '}
        (CC0)
      </p>
    </div>
  );
}
