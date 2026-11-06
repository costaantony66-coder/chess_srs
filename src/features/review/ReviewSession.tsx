import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PartyPopper } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { seedDeck } from '../../data/seed';
import type { StoredCard } from '../../db/db';
import { applyReview, loadQueue, type QueueState } from '../../db/queue';
import { formatDelay, type RatingId } from '../../lib/fsrs';
import { Backup } from './Backup';
import { CardRunner } from './CardRunner';

function Counter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex-1 rounded-xl bg-surface-2 px-3 py-2 text-center">
      <div className={`text-xl font-semibold ${tone}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

export function ReviewSession() {
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [runKey, setRunKey] = useState(0);

  const refresh = useCallback(async (excludeId?: string) => {
    setQueue(await loadQueue(new Date(), excludeId));
    setRunKey((k) => k + 1);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRate = async (card: StoredCard, rating: RatingId, meta: { durationMs: number; correct: boolean }) => {
    await applyReview(card, rating, meta);
    await refresh(card.id);
  };

  const loadDemo = async () => {
    await seedDeck();
    await refresh();
  };

  if (!queue) return null;
  const current = queue.cards[0];

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-4 flex gap-2">
        <Counter label="Nouvelles" value={queue.counts.new} tone="text-accent" />
        <Counter label="Apprentissage" value={queue.counts.learning} tone="text-warn" />
        <Counter label="À revoir" value={queue.counts.review} tone="text-good" />
      </div>

      {current ? (
        <motion.div key={`${current.id}:${runKey}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          <CardRunner card={current} onRate={(r, m) => void handleRate(current, r, m)} />
        </motion.div>
      ) : queue.totalCards === 0 ? (
        <Card className="mx-auto max-w-md text-center">
          <h2 className="font-display text-2xl">Aucune carte</h2>
          <p className="mt-2 text-sm text-muted">Charge 9 cartes de démo (tactiques, ouvertures, finale) pour tester la révision.</p>
          <Button variant="primary" className="mt-4" onClick={() => void loadDemo()}>
            Charger le jeu de démo
          </Button>
        </Card>
      ) : (
        <Card className="mx-auto max-w-md text-center">
          <PartyPopper className="mx-auto text-good" size={32} />
          <h2 className="mt-2 font-display text-2xl">Terminé pour aujourd’hui</h2>
          <p className="mt-2 text-sm text-muted">
            {queue.doneToday} révision{queue.doneToday > 1 ? 's' : ''} faite{queue.doneToday > 1 ? 's' : ''} aujourd’hui.
            {queue.nextDue && <> Prochaine carte dans {formatDelay(queue.nextDue - Date.now())}.</>}
          </p>
        </Card>
      )}

      <Backup onImported={() => void refresh()} />
    </div>
  );
}
