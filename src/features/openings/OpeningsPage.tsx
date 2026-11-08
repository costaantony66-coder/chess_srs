import { useCallback, useEffect, useState } from 'react';
import { Play, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { createRepertoire, deleteRepertoire, listRepertoires, type RepertoireSummary } from '../../db/repertoire';
import { RepertoireEditor } from './RepertoireEditor';
import { TrainingSession } from './TrainingSession';

export function OpeningsPage({ onGoReview }: { onGoReview: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<'edit' | 'train'>('edit');
  const [list, setList] = useState<RepertoireSummary[] | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState<'white' | 'black'>('white');
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => setList(await listRepertoires()), []);
  useEffect(() => {
    if (!openId) void refresh();
  }, [openId, refresh]);

  if (openId && mode === 'train') return <TrainingSession repId={openId} onBack={() => setOpenId(null)} />;
  if (openId) return <RepertoireEditor repId={openId} onBack={() => setOpenId(null)} onGoReview={onGoReview} onTrain={() => setMode('train')} />;
  if (!list) return null;

  const create = async () => {
    const rep = await createRepertoire(name, color);
    setName('');
    setCreating(false);
    setMode('edit');
    setOpenId(rep.id);
  };

  const remove = async (s: RepertoireSummary) => {
    if (!window.confirm(`Supprimer « ${s.rep.name} », ses ${s.moves} coups et ses ${s.cards} cartes ?`)) return;
    await deleteRepertoire(s.rep.id);
    await refresh();
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      {list.length === 0 && !creating && (
        <Card className="text-center">
          <h2 className="font-display text-2xl">Aucun répertoire</h2>
          <p className="mt-2 text-sm text-muted">
            Crée un répertoire par ouverture et par couleur (ex. « Italienne — blancs »), puis joue tes lignes sur
            l’échiquier ou importe un PGN. Chaque coup à retenir devient une carte.
          </p>
        </Card>
      )}

      {list.map((s) => (
        <Card key={s.rep.id} className="flex items-center gap-3">
          <button className="min-w-0 flex-1 text-left" onClick={() => (setMode('edit'), setOpenId(s.rep.id))}>
            <p className="truncate font-display text-lg">{s.rep.name}</p>
            <p className="text-sm text-muted">
              {s.rep.color === 'white' ? 'Blancs' : 'Noirs'} · {s.moves} coups · {s.cards} cartes
              {s.due > 0 && <span className="text-warn"> · {s.due} à revoir</span>}
            </p>
          </button>
          <Button
            variant="primary"
            disabled={s.moves === 0}
            onClick={() => (setMode('train'), setOpenId(s.rep.id))}
            aria-label="S’entraîner"
            className="w-11 px-0"
          >
            <Play size={16} />
          </Button>
          <Button variant="bad" onClick={() => void remove(s)} aria-label="Supprimer" className="w-11 px-0">
            <Trash2 size={16} />
          </Button>
        </Card>
      ))}

      {creating ? (
        <Card>
          <h2 className="font-display text-xl">Nouveau répertoire</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom (ex. Italienne, Sicilienne…)"
            className="mt-3 h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-fg"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant={color === 'white' ? 'primary' : 'ghost'} onClick={() => setColor('white')}>
              Je joue les blancs
            </Button>
            <Button variant={color === 'black' ? 'primary' : 'ghost'} onClick={() => setColor('black')}>
              Je joue les noirs
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={() => setCreating(false)}>Annuler</Button>
            <Button variant="primary" onClick={() => void create()}>
              Créer
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={18} /> Nouveau répertoire
        </Button>
      )}

    </div>
  );
}
