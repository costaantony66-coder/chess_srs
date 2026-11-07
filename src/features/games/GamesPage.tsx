import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { deleteGame, listGames, type GameRow } from '../../db/games';
import { GameImport } from './GameImport';
import { GameViewer } from './GameViewer';

const SOURCE = { lichess: 'Lichess', chesscom: 'Chess.com', pgn: 'PGN' } as const;

export function GamesPage({ onGoReview }: { onGoReview: () => void }) {
  const [rows, setRows] = useState<GameRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => setRows(await listGames()), []);
  useEffect(() => {
    if (!openId) void refresh();
  }, [openId, refresh]);

  if (openId) return <GameViewer gameId={openId} onBack={() => setOpenId(null)} onGoReview={onGoReview} />;
  if (!rows) return null;

  const remove = async (r: GameRow) => {
    if (!window.confirm(`Supprimer cette partie et ses ${r.cards} carte(s) d’erreur ?`)) return;
    await deleteGame(r.game.id);
    await refresh();
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <GameImport onDone={() => void refresh()} />

      <div>
        <h2 className="mb-2 font-display text-xl">Mes parties ({rows.length})</h2>
        {rows.length === 0 ? (
          <Card className="text-center text-sm text-muted">Aucune partie importée.</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((r) => {
              const g = r.game;
              const opp = g.myColor === 'white' ? g.black : g.white;
              const date = g.playedAt ? new Date(g.playedAt).toLocaleDateString('fr-FR') : '';
              return (
                <Card key={g.id} className="flex items-center gap-3 py-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(g.id)}>
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
                      <span className="text-muted"> · {r.cards} carte{r.cards > 1 ? 's' : ''}</span>
                    </p>
                  </button>
                  <Button variant="bad" onClick={() => void remove(r)} aria-label="Supprimer" className="w-11 px-0">
                    <Trash2 size={16} />
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
