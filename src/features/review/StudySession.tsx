import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Pause, PartyPopper, Trash2, Undo2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import type { StoredCard } from '../../db/db';
import { deleteCards, isManagedByRepertoire, setSuspended, undoReview } from '../../db/cards';
import { applyReview, loadQueue, type QueueState, type ReviewUndo } from '../../db/queue';
import { formatDelay, type RatingId } from '../../lib/fsrs';
import { CardRunner } from './CardRunner';

function Counter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex-1 rounded-xl bg-surface-2 px-3 py-2 text-center">
      <div className={`text-xl font-semibold ${tone}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

type Props = { deck: string | null; title: string; onExit: () => void };

/** Révision d'un paquet (sous-paquets inclus) ou de toute la collection (deck = null). */
export function StudySession({ deck, title, onExit }: Props) {
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [last, setLast] = useState<ReviewUndo | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(
    async (excludeId?: string) => {
      setQueue(await loadQueue(new Date(), excludeId, deck ?? undefined));
      setRunKey((k) => k + 1);
    },
    [deck],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRate = async (card: StoredCard, rating: RatingId, meta: { durationMs: number; correct: boolean }) => {
    setLast(await applyReview(card, rating, meta));
    setFocusId(null);
    setNote(null);
    await refresh(card.id);
  };

  const undo = useCallback(async () => {
    if (!last) return;
    await undoReview(last);
    setFocusId(last.previous.id);
    setLast(null);
    setNote('Dernière note annulée : la carte revient.');
    await refresh();
  }, [last, refresh]);

  // Raccourcis : Échap = quitter, U ou Ctrl+Z = annuler la dernière note.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'Escape') onExit();
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        void undo();
      } else if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'u') void undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit, undo]);

  if (!queue) return null;
  const current = (focusId && queue.cards.find((c) => c.id === focusId)) || queue.cards[0];

  const suspend = async () => {
    if (!current) return;
    await setSuspended([current.id], true);
    setNote('Carte suspendue. Tu peux la réactiver dans « Parcourir les cartes ».');
    setLast(null);
    await refresh();
  };

  const remove = async () => {
    if (!current || !window.confirm('Supprimer définitivement cette carte ?')) return;
    await deleteCards([current.id]);
    setNote('Carte supprimée.');
    setLast(null);
    await refresh();
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-3 flex items-center gap-2">
        <Button onClick={onExit} aria-label="Retour aux paquets" className="w-11 px-0">
          <ArrowLeft size={18} />
        </Button>
        <h2 className="min-w-0 truncate font-display text-xl">{title}</h2>
      </div>

      <div className="mb-3 flex gap-2">
        <Counter label="Nouvelles" value={queue.counts.new} tone="text-accent" />
        <Counter label="Apprentissage" value={queue.counts.learning} tone="text-warn" />
        <Counter label="À revoir" value={queue.counts.review} tone="text-good" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button className="min-h-10 px-3" onClick={() => void undo()} disabled={!last} title="Annuler la dernière note (U)">
          <Undo2 size={16} /> Annuler la note
        </Button>
        <Button className="min-h-10 px-3" onClick={() => void suspend()} disabled={!current} title="Ne plus proposer cette carte">
          <Pause size={16} /> Suspendre
        </Button>
        <Button
          variant="bad"
          className="min-h-10 px-3"
          onClick={() => void remove()}
          disabled={!current || isManagedByRepertoire(current)}
          title={current && isManagedByRepertoire(current) ? 'Carte d’un répertoire : modifie le répertoire pour la supprimer' : 'Supprimer cette carte'}
        >
          <Trash2 size={16} /> Supprimer
        </Button>
        <span className="hidden text-xs text-muted md:inline">Échap : quitter · U : annuler la note</span>
      </div>
      {note && <p className="mb-3 text-sm text-muted">{note}</p>}

      {current ? (
        <motion.div key={`${current.id}:${runKey}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          <CardRunner card={current} onRate={(r, m) => void handleRate(current, r, m)} />
        </motion.div>
      ) : (
        <Card className="mx-auto max-w-md text-center">
          <PartyPopper className="mx-auto text-good" size={32} />
          <h2 className="mt-2 font-display text-2xl">Terminé pour ce paquet</h2>
          <p className="mt-2 text-sm text-muted">
            {queue.doneToday} révision{queue.doneToday > 1 ? 's' : ''} faite{queue.doneToday > 1 ? 's' : ''} aujourd’hui.
            {queue.nextDue && <> Prochaine carte dans {formatDelay(queue.nextDue - Date.now())}.</>}
          </p>
          <Button variant="primary" className="mt-4" onClick={onExit}>
            Retour aux paquets
          </Button>
        </Card>
      )}
    </div>
  );
}
