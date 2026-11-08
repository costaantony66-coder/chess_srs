import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Star, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { deleteGames, listGames, toggleFavorite, type GameRow } from '../../db/games';
import { GameAnalysis } from './GameAnalysis';
import { GameImport } from './GameImport';
import { GameViewer } from './GameViewer';

const SOURCE = { lichess: 'Lichess', chesscom: 'Chess.com', pgn: 'PGN' } as const;

export function GamesPage({ onGoReview }: { onGoReview: () => void }) {
  const [rows, setRows] = useState<GameRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [onlyFav, setOnlyFav] = useState(false);

  const refresh = useCallback(async () => setRows(await listGames()), []);
  useEffect(() => {
    if (!openId) void refresh();
  }, [openId, refresh]);

  const visible = useMemo(() => (rows ?? []).filter((r) => !onlyFav || r.game.favorite), [rows, onlyFav]);

  if (openId) return <GameViewer gameId={openId} onBack={() => setOpenId(null)} onGoReview={onGoReview} />;
  if (!rows) return null;

  const favCount = rows.filter((r) => r.game.favorite).length;
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  /** « Tout sélectionner » ignore les favoris pour éviter les suppressions par erreur. */
  const selectAll = () => setSelected(new Set(visible.filter((r) => !r.game.favorite).map((r) => r.game.id)));

  const removeSelected = async () => {
    const chosen = rows.filter((r) => selected.has(r.game.id));
    if (!chosen.length) return;
    const cards = chosen.reduce((n, r) => n + r.cards, 0);
    const favs = chosen.filter((r) => r.game.favorite).length;
    const msg =
      `Supprimer ${chosen.length} partie${chosen.length > 1 ? 's' : ''} et ${cards} carte${cards > 1 ? 's' : ''} d’erreur ?` +
      (favs ? `\n\n⚠ ${favs} de ces parties ${favs > 1 ? 'sont' : 'est'} en favori.` : '');
    if (!window.confirm(msg)) return;
    await deleteGames(chosen.map((r) => r.game.id));
    stopSelecting();
    await refresh();
  };

  const fav = async (id: string) => {
    await toggleFavorite(id);
    await refresh();
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <GameImport onDone={() => void refresh()} />
      <GameAnalysis games={rows.filter((r) => !r.game.analysed).map((r) => r.game)} onDone={() => void refresh()} />

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-display text-xl">Mes parties ({rows.length})</h2>
          <button
            onClick={() => setOnlyFav((v) => !v)}
            className={`min-h-10 rounded-full px-3 text-sm ${onlyFav ? 'bg-accent text-accent-fg' : 'bg-surface-2'}`}
          >
            ★ Favoris ({favCount})
          </button>
          {rows.length > 0 && (
            <button
              onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
              className={`min-h-10 rounded-full px-3 text-sm ${selecting ? 'bg-accent text-accent-fg' : 'bg-surface-2'}`}
            >
              {selecting ? 'Annuler' : 'Sélectionner'}
            </button>
          )}
        </div>

        {selecting && (
          <div className="mb-2 grid grid-cols-3 gap-2">
            <Button onClick={selectAll}>Tout (hors favoris)</Button>
            <Button onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
              Aucune
            </Button>
            <Button variant="bad" onClick={() => void removeSelected()} disabled={selected.size === 0}>
              <Trash2 size={16} /> Supprimer ({selected.size})
            </Button>
          </div>
        )}

        {visible.length === 0 ? (
          <Card className="text-center text-sm text-muted">{onlyFav ? 'Aucun favori.' : 'Aucune partie importée.'}</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((r) => {
              const g = r.game;
              const opp = g.myColor === 'white' ? g.black : g.white;
              const date = g.playedAt ? new Date(g.playedAt).toLocaleDateString('fr-FR') : '';
              const checked = selected.has(g.id);
              return (
                <Card key={g.id} className={`flex items-center gap-3 py-3 ${checked ? 'border-accent' : ''}`}>
                  {selecting && (
                    <button
                      onClick={() => toggleSel(g.id)}
                      aria-label={checked ? 'Désélectionner' : 'Sélectionner'}
                      className={`grid size-7 shrink-0 place-items-center rounded-md border ${checked ? 'border-accent bg-accent text-accent-fg' : 'border-border'}`}
                    >
                      {checked && <Check size={16} />}
                    </button>
                  )}
                  <button className="min-w-0 flex-1 text-left" onClick={() => (selecting ? toggleSel(g.id) : setOpenId(g.id))}>
                    <p className="truncate font-medium">
                      vs {opp} · {g.result}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {SOURCE[g.source]} · {g.myColor === 'white' ? 'blancs' : 'noirs'}
                      {date && ` · ${date}`}
                      {g.opening && ` · ${g.opening}`}
                    </p>
                    <p className="text-sm">
                      <span className={g.analysed ? 'text-good' : 'text-muted'}>{g.analysed ? 'analysée' : 'non analysée'}</span>
                      <span className="text-muted">
                        {' '}
                        · {r.cards} carte{r.cards > 1 ? 's' : ''}
                      </span>
                    </p>
                  </button>
                  <button
                    onClick={() => void fav(g.id)}
                    aria-label={g.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    className={`grid size-11 shrink-0 place-items-center rounded-xl ${g.favorite ? 'text-warn' : 'text-muted'}`}
                  >
                    <Star size={20} fill={g.favorite ? 'currentColor' : 'none'} />
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
