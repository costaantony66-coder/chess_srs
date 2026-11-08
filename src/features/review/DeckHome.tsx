import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Layers } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { seedDeck } from '../../data/seed';
import { loadDeckTree, type DeckNode, type DeckTree } from '../../db/decks';
import { DECK_SEP } from '../../lib/decks';
import { getNewPerDay, setNewPerDay } from '../../lib/settings';
import { Backup } from './Backup';

type Counts = { new: number; learning: number; review: number };

function CountCells({ n }: { n: Counts }) {
  const cell = (v: number, tone: string) => (
    <span className={`w-9 text-right font-semibold tabular-nums ${v ? tone : 'text-muted opacity-40'}`}>{v}</span>
  );
  return (
    <span className="flex shrink-0 text-sm">
      {cell(n.new, 'text-accent')}
      {cell(n.learning, 'text-warn')}
      {cell(n.review, 'text-good')}
    </span>
  );
}

function findNode(roots: DeckNode[], path: string): DeckNode | null {
  let list = roots;
  let found: DeckNode | null = null;
  const parts = path.split(DECK_SEP);
  for (let i = 0; i < parts.length; i++) {
    const p = parts.slice(0, i + 1).join(DECK_SEP);
    found = list.find((n) => n.path === p) ?? null;
    if (!found) return null;
    list = found.children;
  }
  return found;
}

type Props = {
  /** Niveau affiché (chemin du paquet ouvert, null = racine). */
  level: string | null;
  onLevel: (path: string | null) => void;
  onStudy: (deck: string | null, title: string) => void;
};

export function DeckHome({ level, onLevel, onStudy }: Props) {
  const [tree, setTree] = useState<DeckTree | null>(null);
  const [perDay, setPerDay] = useState(getNewPerDay);

  const refresh = useCallback(async () => setTree(await loadDeckTree()), []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const current = useMemo(() => (tree && level ? findNode(tree.roots, level) : null), [tree, level]);

  // Si le paquet ouvert a disparu (suppression, renommage), retour à la racine.
  useEffect(() => {
    if (tree && level && !current) onLevel(null);
  }, [tree, level, current, onLevel]);

  const changePerDay = (delta: number) => {
    const n = Math.max(0, Math.min(100, perDay + delta));
    setNewPerDay(n);
    setPerDay(n);
    void refresh();
  };

  if (!tree) return null;

  const rows = current ? current.children : tree.roots;
  const crumbs = level ? level.split(DECK_SEP).map((name, i, a) => ({ name, path: a.slice(0, i + 1).join(DECK_SEP) })) : [];
  const head: Counts & { total: number } = current ?? tree.all;
  const headTitle = current ? current.path.replaceAll(DECK_SEP, ' › ') : 'Toutes les cartes';

  return (
    <div className="mx-auto w-full max-w-2xl">
      {tree.all.total === 0 && tree.roots.length === 0 ? (
        <Card className="text-center">
          <h2 className="font-display text-2xl">Aucune carte</h2>
          <p className="mt-2 text-sm text-muted">Charge 9 cartes de démo, ou ajoute des puzzles, un répertoire d’ouvertures ou des parties.</p>
          <Button variant="primary" className="mt-4" onClick={() => void seedDeck().then(refresh)}>
            Charger le jeu de démo
          </Button>
        </Card>
      ) : (
        <>
          <nav aria-label="Fil d’Ariane" className="mb-3 flex flex-wrap items-center gap-1 text-sm">
            <button className={level ? 'text-accent' : 'font-medium'} onClick={() => onLevel(null)}>
              Réviser
            </button>
            {crumbs.map((c, i) => (
              <span key={c.path} className="flex items-center gap-1">
                <ChevronRight size={14} className="text-muted" />
                <button className={i === crumbs.length - 1 ? 'font-medium' : 'text-accent'} onClick={() => onLevel(c.path)}>
                  {c.name}
                </button>
              </span>
            ))}
          </nav>

          <Button
            variant="primary"
            className="w-full justify-between"
            disabled={head.total === 0}
            onClick={() => onStudy(current ? current.path : null, headTitle)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Layers size={18} className="shrink-0" />
              <span className="truncate">{current ? `Réviser tout « ${current.name} »` : 'Tout réviser'}</span>
            </span>
            <span className="flex gap-2 text-sm font-semibold opacity-90">
              <span>{head.new}</span>
              <span>{head.learning}</span>
              <span>{head.review}</span>
            </span>
          </Button>

          <Card className="mt-3 py-2">
            <div className="flex items-center justify-end pb-1 pr-8 text-xs text-muted">
              <span className="w-9 text-right">Nouv.</span>
              <span className="w-9 text-right">Appr.</span>
              <span className="w-9 text-right">Revoir</span>
            </div>
            {rows.map((n) => {
              const hasChildren = n.children.length > 0;
              const empty = n.total === 0;
              return (
                <button
                  key={n.path}
                  disabled={empty}
                  onClick={() => (hasChildren ? onLevel(n.path) : onStudy(n.path, n.path.replaceAll(DECK_SEP, ' › ')))}
                  className="flex w-full items-center gap-2 border-b border-border py-3 text-left last:border-b-0 disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{n.name}</span>
                    <span className="block text-xs text-muted">
                      {empty
                        ? n.name === 'Lignes'
                          ? 'Aucune ligne : crée-en dans l’éditeur du répertoire'
                          : 'Aucune carte'
                        : `${n.total} carte${n.total > 1 ? 's' : ''}${hasChildren ? ` · ${n.children.length} sous-paquet${n.children.length > 1 ? 's' : ''}` : ''}`}
                    </span>
                  </span>
                  <CountCells n={n} />
                  {hasChildren ? <ChevronRight size={18} className="shrink-0 text-muted" /> : <span className="w-[18px] shrink-0" />}
                </button>
              );
            })}
          </Card>
        </>
      )}

      {!level && (
        <>
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
        </>
      )}
    </div>
  );
}
