import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FolderInput, Pause, Play, Search, Trash2 } from 'lucide-react';
import { State } from 'ts-fsrs';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { themeLabel } from '../../data/themes';
import { db, type StoredCard } from '../../db/db';
import { deleteCards, isManagedByRepertoire, listDecks, moveCards, setSuspended } from '../../db/cards';
import { DECK_SEP, deckPath, inDeck } from '../../lib/decks';
import { formatDelay } from '../../lib/fsrs';

type Status = 'all' | 'new' | 'learning' | 'review' | 'suspended';
const STATUS: { id: Status; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'new', label: 'Nouvelles' },
  { id: 'learning', label: 'Apprentissage' },
  { id: 'review', label: 'À revoir' },
  { id: 'suspended', label: 'Suspendues' },
];
const PAGE = 40;

export const statusOf = (c: StoredCard): Exclude<Status, 'all'> =>
  c.suspended ? 'suspended' : c.state === State.New ? 'new' : c.state === State.Review ? 'review' : 'learning';

/** Explorateur de cartes : recherche, filtres, suspendre, déplacer, supprimer (comme « Parcourir » d'Anki). */
export function CardBrowser({ deck, onBack }: { deck: string | null; onBack: () => void }) {
  const [cards, setCards] = useState<StoredCard[] | null>(null);
  const [decks, setDecks] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const all = await db.cards.toArray();
    setCards(deck ? all.filter((c) => inDeck(c.deck, deck)) : all);
    setDecks(await listDecks());
  }, [deck]);
  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (cards ?? [])
      .filter((c) => status === 'all' || statusOf(c) === status)
      .filter((c) => !q || [c.title, c.deck, c.note ?? '', c.tags.map(themeLabel).join(' ')].join(' ').toLowerCase().includes(q))
      .sort((a, b) => a.deck.localeCompare(b.deck, 'fr') || a.createdAt - b.createdAt);
  }, [cards, query, status]);

  if (!cards) return null;
  const visible = filtered.slice(0, limit);
  const ids = [...selected];
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const after = async (text: string) => {
    setMsg(text);
    setSelected(new Set());
    setMoving(false);
    await load();
  };

  const suspend = async (on: boolean) => after(`${await setSuspended(ids, on)} carte(s) ${on ? 'suspendue(s)' : 'réactivée(s)'}.`);

  const remove = async () => {
    if (!window.confirm(`Supprimer définitivement ${ids.length} carte(s) ?`)) return;
    const r = await deleteCards(ids);
    await after(`${r.deleted} carte(s) supprimée(s)${r.skipped ? ` ; ${r.skipped} carte(s) de répertoire ignorée(s) : modifie le répertoire pour les retirer.` : '.'}`);
  };

  const move = async (target: string) => {
    if (!target) return;
    const r = await moveCards(ids, target);
    await after(`${r.moved} carte(s) déplacée(s) vers « ${target.replaceAll(DECK_SEP, ' › ')} »${r.skipped ? ` ; ${r.skipped} carte(s) de répertoire ignorée(s).` : '.'}`);
  };

  const newDeck = () => {
    const name = window.prompt('Nom du nouveau paquet (ex. Puzzles::À retravailler)');
    if (name?.trim()) void move(deckPath(...name.split(DECK_SEP)));
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-3 flex items-center gap-2">
        <Button onClick={onBack} aria-label="Retour" className="w-11 px-0">
          <ArrowLeft size={18} />
        </Button>
        <div className="min-w-0">
          <h2 className="font-display text-xl">Parcourir les cartes</h2>
          <p className="truncate text-sm text-muted">
            {deck ? deck.replaceAll(DECK_SEP, ' › ') : 'Toute la collection'} · {filtered.length} carte{filtered.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => (setQuery(e.target.value), setLimit(PAGE))}
          placeholder="Rechercher (titre, thème, paquet, commentaire)…"
          className="h-11 w-full rounded-xl border border-border bg-surface px-9 text-fg"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {STATUS.map((s) => (
          <button
            key={s.id}
            onClick={() => (setStatus(s.id), setLimit(PAGE))}
            className={`min-h-10 rounded-full px-3 text-sm ${status === s.id ? 'bg-accent text-accent-fg' : 'bg-surface-2'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <Card className="sticky top-0 z-10 mt-3 border-accent py-3">
          <p className="mb-2 text-sm font-medium">{selected.size} sélectionnée{selected.size > 1 ? 's' : ''}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button className="min-h-10 px-2" onClick={() => void suspend(true)}>
              <Pause size={16} /> Suspendre
            </Button>
            <Button className="min-h-10 px-2" onClick={() => void suspend(false)}>
              <Play size={16} /> Réactiver
            </Button>
            <Button className="min-h-10 px-2" onClick={() => setMoving((m) => !m)}>
              <FolderInput size={16} /> Déplacer
            </Button>
            <Button variant="bad" className="min-h-10 px-2" onClick={() => void remove()}>
              <Trash2 size={16} /> Supprimer
            </Button>
          </div>
          {moving && (
            <div className="mt-2 flex gap-2">
              <select
                defaultValue=""
                onChange={(e) => void move(e.target.value)}
                className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-2 text-fg"
                aria-label="Paquet de destination"
              >
                <option value="" disabled>
                  Choisir un paquet…
                </option>
                {decks.map((d) => (
                  <option key={d} value={d}>
                    {d.replaceAll(DECK_SEP, ' › ')}
                  </option>
                ))}
              </select>
              <Button className="min-h-10 px-3" onClick={newDeck}>
                Nouveau…
              </Button>
            </div>
          )}
        </Card>
      )}
      {msg && <p className="mt-3 text-sm">{msg}</p>}

      <div className="mt-3 flex items-center justify-between text-sm text-muted">
        <button className="underline" onClick={() => setSelected(new Set(visible.map((c) => c.id)))}>
          Tout sélectionner ({visible.length})
        </button>
        {selected.size > 0 && (
          <button className="underline" onClick={() => setSelected(new Set())}>
            Aucune
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {visible.length === 0 && <Card className="text-center text-sm text-muted">Aucune carte ne correspond.</Card>}
        {visible.map((c) => {
          const st = statusOf(c);
          const checked = selected.has(c.id);
          return (
            <Card key={c.id} className={`flex items-center gap-3 py-3 ${checked ? 'border-accent' : ''} ${c.suspended ? 'opacity-60' : ''}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(c.id)} aria-label={`Sélectionner ${c.title}`} className="size-5 shrink-0 accent-[var(--accent)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.title}</p>
                <p className="truncate text-xs text-muted">
                  {c.deck.replaceAll(DECK_SEP, ' › ')}
                  {c.line ? ` · ${c.line}` : ''}
                </p>
                <p className="text-xs">
                  <span className={st === 'suspended' ? 'text-warn' : st === 'new' ? 'text-accent' : st === 'review' ? 'text-good' : 'text-muted'}>
                    {STATUS.find((s) => s.id === st)!.label.replace('Toutes', '')}
                  </span>
                  {st !== 'new' && st !== 'suspended' && <span className="text-muted"> · prochaine révision dans {formatDelay(Math.max(0, c.due - Date.now()))}</span>}
                  {isManagedByRepertoire(c) && <span className="text-muted"> · géré par le répertoire</span>}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
      {filtered.length > limit && (
        <Button className="mt-3 w-full" onClick={() => setLimit((l) => l + PAGE)}>
          Afficher plus ({filtered.length - limit} restantes)
        </Button>
      )}
    </div>
  );
}
