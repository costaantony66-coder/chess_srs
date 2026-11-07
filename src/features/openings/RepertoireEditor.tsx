import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, Trash2 } from 'lucide-react';
import { Board } from '../../components/board/Board';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { db, type RepNode, type Repertoire } from '../../db/db';
import { addMove, deleteNode, formatLine, loadNodes, ROOT, setComment, START_FEN } from '../../db/repertoire';
import { MoveTree } from './MoveTree';
import { PgnImport } from './PgnImport';

type Props = { repId: string; onBack: () => void; onGoReview: () => void };

export function RepertoireEditor({ repId, onBack, onGoReview }: Props) {
  const [rep, setRep] = useState<Repertoire | null>(null);
  const [nodes, setNodes] = useState<RepNode[]>([]);
  const [currentId, setCurrentId] = useState(ROOT);
  const [syncKey, setSyncKey] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [cardCount, setCardCount] = useState(0);

  const reload = useCallback(async () => {
    setNodes(await loadNodes(repId));
    setCardCount(await db.cards.where('repId').equals(repId).count());
  }, [repId]);

  useEffect(() => {
    void db.repertoires.get(repId).then((r) => r && setRep(r));
    void loadNodes(repId).then((n) => {
      setNodes(n);
      if (n.length === 0) setShowImport(true);
    });
    void db.cards.where('repId').equals(repId).count().then(setCardCount);
  }, [repId]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const children = useMemo(() => {
    const m = new Map<string, RepNode[]>();
    for (const n of nodes) m.set(n.parentId, [...(m.get(n.parentId) ?? []), n]);
    return m;
  }, [nodes]);

  const current = byId.get(currentId);
  const kids = children.get(currentId) ?? [];
  const fen = current ? current.fenAfter : START_FEN;
  const lastMove = useMemo<[string, string] | undefined>(
    () => (current ? [current.uci.slice(0, 2), current.uci.slice(2, 4)] : undefined),
    [current],
  );

  const path = useMemo(() => {
    const p: RepNode[] = [];
    for (let n = current; n; n = byId.get(n.parentId)) p.unshift(n);
    return p;
  }, [current, byId]);

  const goBack = useCallback(() => current && setCurrentId(current.parentId), [current]);
  const goForward = useCallback(() => kids[0] && setCurrentId(kids[0].id), [kids]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft') goBack();
      if (e.key === 'ArrowRight') goForward();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goBack, goForward]);

  if (!rep) return null;

  const handleMove = async (from: string, to: string) => {
    const res = await addMove(repId, currentId, from, to);
    if (!res) {
      setSyncKey((k) => k + 1);
      return;
    }
    setNote(res.created ? 'Coup ajouté au répertoire.' : null);
    if (res.created) await reload();
    setCurrentId(res.node.id);
  };

  const remove = async () => {
    if (!current) return;
    const count = nodes.filter((n) => n.ply >= current.ply).length;
    if (!window.confirm(`Supprimer « ${current.san} » et toutes ses suites ? Les cartes associées seront supprimées.`) || count < 0) return;
    const parent = current.parentId;
    await deleteNode(current.id);
    setCurrentId(parent);
    setNote(null);
    await reload();
  };

  const nextIsMine = (current ? current.ply : 0) % 2 === 0 === (rep.color === 'white');
  const status = nextIsMine
    ? kids.length
      ? `Ton coup prévu : ${kids.map((k) => k.san).join(' / ')}`
      : 'Aucun coup prévu ici : joue-le sur l’échiquier pour l’ajouter.'
    : kids.length
      ? `Réponses adverses prévues : ${kids.map((k) => k.san).join(', ')}`
      : 'Ajoute les réponses adverses à connaître en les jouant sur l’échiquier.';

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-3 flex items-center gap-2">
        <Button onClick={onBack} aria-label="Retour" className="w-11 px-0">
          <ArrowLeft size={18} />
        </Button>
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl">{rep.name}</h2>
          <p className="text-sm text-muted">
            {rep.color === 'white' ? 'Blancs' : 'Noirs'} · {nodes.length} coups · {cardCount} cartes
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,560px)_1fr]">
        <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-18rem))] lg:max-w-none">
          <Board fen={fen} orientation={rep.color} lastMove={lastMove} onMove={(f, t) => void handleMove(f, t)} syncKey={syncKey} />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button onClick={() => setCurrentId(ROOT)} disabled={!current} aria-label="Début">
              <ChevronsLeft size={18} />
            </Button>
            <Button onClick={goBack} disabled={!current} aria-label="Coup précédent">
              <ChevronLeft size={18} />
            </Button>
            <Button onClick={goForward} disabled={!kids.length} aria-label="Coup suivant">
              <ChevronRight size={18} />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Card>
            <p className="font-mono text-sm">{path.length ? formatLine(path) : 'Position de départ'}</p>
            <p className="mt-2 text-sm text-muted">{status}</p>
            {note && <p className="mt-2 text-sm text-good">{note}</p>}
          </Card>

          {current && (
            <Card>
              <label className="text-sm text-muted" htmlFor="comment">
                Commentaire sur {current.san} (affiché après la réponse en révision)
              </label>
              <textarea
                id="comment"
                key={current.id}
                defaultValue={current.comment ?? ''}
                onBlur={(e) => {
                  if ((current.comment ?? '') !== e.target.value.trim()) void setComment(current.id, e.target.value).then(reload);
                }}
                rows={2}
                className="mt-2 w-full rounded-xl border border-border bg-surface-2 p-2 text-sm text-fg"
              />
              <Button variant="bad" className="mt-2 w-full" onClick={() => void remove()}>
                <Trash2 size={16} /> Supprimer ce coup et ses suites
              </Button>
            </Card>
          )}

          <Card>
            <p className="mb-2 text-sm text-muted">Arbre (tes coups en gras)</p>
            {nodes.length ? (
              <MoveTree children={children} currentId={currentId} color={rep.color} onSelect={setCurrentId} />
            ) : (
              <p className="text-sm text-muted">Vide : joue des coups sur l’échiquier ou importe un PGN.</p>
            )}
          </Card>

          <Card>
            <button className="w-full text-left text-sm font-medium" onClick={() => setShowImport((s) => !s)}>
              {showImport ? '▾' : '▸'} Importer un PGN
            </button>
            {showImport && (
              <div className="mt-3">
                <PgnImport repId={repId} onDone={() => void reload()} />
              </div>
            )}
          </Card>

          <Button variant="primary" onClick={onGoReview} disabled={cardCount === 0}>
            Réviser mes cartes
          </Button>
        </div>
      </div>
    </div>
  );
}
