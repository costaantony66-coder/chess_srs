import { useEffect, useState } from 'react';
import { DatabaseBackup } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { exportData, hasData } from '../../db/backup';
import { describeAge, getFirstSeenAt, getLastBackupAt, getSnoozedUntil, shouldRemind, snoozeReminder } from '../../lib/backupReminder';

/** Bandeau « pense à sauvegarder » (après 7 jours sans sauvegarde, ou 3 jours d'usage sans aucune). */
export function BackupReminder() {
  const [show, setShow] = useState(false);
  const [last, setLast] = useState<number | null>(null);

  useEffect(() => {
    void hasData().then((has) => {
      const lastBackupAt = getLastBackupAt();
      setLast(lastBackupAt);
      setShow(shouldRemind({ hasData: has, lastBackupAt, firstSeenAt: getFirstSeenAt(), snoozedUntil: getSnoozedUntil(), now: Date.now() }));
    });
  }, []);

  if (!show) return null;
  return (
    <Card className="mb-4 border-warn">
      <div className="flex items-start gap-3">
        <DatabaseBackup className="mt-0.5 shrink-0 text-warn" size={22} />
        <div className="min-w-0">
          <p className="font-medium">Pense à sauvegarder tes données</p>
          <p className="text-sm text-muted">{describeAge(last, Date.now())}. Elles ne sont que sur cet appareil.</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          onClick={() => {
            snoozeReminder(2);
            setShow(false);
          }}
        >
          Plus tard
        </Button>
        <Button
          variant="primary"
          onClick={() =>
            void exportData().then(() => {
              setShow(false);
            })
          }
        >
          Exporter maintenant
        </Button>
      </div>
    </Card>
  );
}
