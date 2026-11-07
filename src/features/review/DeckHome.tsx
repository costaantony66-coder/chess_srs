import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { seedDeck } from '../../data/seed';
import { loadDeckTree, type DeckNode, type DeckTree } from '../../db/decks';
import { getNewPerDay, setNewPerDay } from '../../lib/settings';
import { Backup } from './Backup';

function Counts({ n }: { n: { new: number; learning: number; review: number } }) {
  const cell = (v: number, tone: string) => <span className={`w-8 text-right font-semibold tabular-nums ${v ? tone : 'text-muted opacity-40'}`}>{v}</span>;
  return (
    <span className="flex shrink-0 text-sm">
      {cell(n.new, 'text-accent')}
      {cell(n.learning, 'text-warn')}
      {cell(n.review, 'text-good')}
    </span>
  );
}

function Row({ node, depth, open, toggle, onStudy }: { node: DeckNode; depth: number; open: Set<string>; toggle: (p: string) => void; onStudy: (path: string, title: string) => void }) {
  const isOpen = open.has(node.path);
  return (
    <>
      <div className="flex items-center gap-1 border-b border-border py-2 last:border-b-0" style={{ paddingLeft: depth * 16 }}>
        {node.children.length ? (
          <button onClick={() => toggle(node.path)} aria-label={isOpen ? 'Replier' : 'Déplier'} className="grid size-9 shrink-0 place-items-center text-muted">
            {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
        ) : (
          <span className="size-9 shrink-0" />
        )}
        <button className="min-w-0 flex-1 text-left" onClick={() => onStudy(node.path, node.name)}>
          <p className="truncate font-medium">{node.name}</p>
          <p className="text-xs text-muted">
            {node.total} carte{node.total > 1 ? 's' : ''}
          </p>
        </button>
        <Counts n={node} />
      </div>
      {isOpen &&
        node.children.map((c) => <Row key={c.path} node={c} depth={depth + 1} open={open} toggle={toggle} onStudy={onStudy} />)}
    </>
  );
}

type Props = { onStudy: (deck: string | null, title: string) => void };

export function DeckHome({ onStudy }: Props) {
  const [tree, setTree] = useState<DeckTree | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [perDay, setPerDay] = useState(getNewPerDay);

  const refresh = useCallback(async () => setTree(await loadDeckTree()), []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = (p: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });

  const changePerDay = (delta: number) => {
    const n = Math.max(0, Math.min(100, perDay + delta));
    setNewPerDay(n);
    setPerDay(n);
    void refresh();
  };

  if (!tree) return null;

  return (
    <div className="mx-auto w-full max-w-2xl">
      {tree.all.total === 0 ? (
        <Card className="text-center">
          <h2 className="font-display text-2xl">Aucune carte</h2>
          <p className="mt-2 text-sm text-muted">Charge 9 cartes de démo, ou ajoute des puzzles, un répertoire d’ouvertures ou des parties.</p>
          <Button variant="primary" className="mt-4" onClick={() => void seedDeck().then(refresh)}>
            Charger le jeu de démo
          </Button>
        </Card>
      ) : (
        <>
          <Button variant="primary" className="w-full justify-between" onClick={() => onStudy(null, 'Toutes les cartes')}>
            <span className="flex items-center gap-2">
              <Layers size={18} /> Tout réviser
            </span>
            <span className="flex gap-2 text-sm font-semibold opacity-90">
              <span>{tree.all.new}</span>
              <span>{tree.all.learning}</span>
              <span>{tree.all.review}</span>
            </span>
          </Button>

          <Card className="mt-3 py-2">
            <div className="flex items-center justify-end gap-1 pb-1 pr-0 text-xs text-muted">
              <span className="w-8 text-right">Nouv.</span>
              <span className="w-8 text-right">Appr.</span>
              <span className="w-8 text-right">Revoir</span>
            </div>
            {tree.roots.map((n) => (
              <Row key={n.path} node={n} depth={0} open={open} toggle={toggle} onStudy={(path) => onStudy(path, path.replaceAll('::', ' › '))} />
            ))}
          </Card>
        </>
      )}

      <Card className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm">Nouvelles cartes par jour et par paquet</p>
        <div className="flex items-center gap-2">
          <Button onClick={() => changePerDay(-5)} disabled={perDay <= 0} aria-label="Moins" className="w-11 px-0">
            −
          </Button>
          <span className="w-8 text-center font-semibold">{perDay}</span>
          <Button onClick={() => changePerDay(5)} disabled={perDay >= 100} aria-label="Plus" className="w-11 px-0">
            +
          </Button>
        </div>
      </Card>

      <Backup onImported={() => void refresh()} />
    </div>
  );
}
