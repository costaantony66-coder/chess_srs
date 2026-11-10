export const DAY = 86_400_000;

export interface ReminderInput {
  hasData: boolean;
  lastBackupAt: number | null;
  /** Premier lancement de l'app sur cet appareil (sert quand aucune sauvegarde n'a jamais été faite). */
  firstSeenAt: number | null;
  snoozedUntil: number | null;
  now: number;
}

/** Faut-il rappeler de sauvegarder ? Après 7 jours sans sauvegarde, ou 3 jours d'usage sans aucune. */
export function shouldRemind({ hasData, lastBackupAt, firstSeenAt, snoozedUntil, now }: ReminderInput): boolean {
  if (!hasData) return false;
  if (snoozedUntil !== null && snoozedUntil > now) return false;
  const base = lastBackupAt ?? firstSeenAt ?? now;
  return now - base >= (lastBackupAt !== null ? 7 : 3) * DAY;
}

export function describeAge(last: number | null, now: number): string {
  if (last === null) return 'Aucune sauvegarde pour l’instant';
  const d = Math.floor((now - last) / DAY);
  return d <= 0 ? 'Dernière sauvegarde : aujourd’hui' : `Dernière sauvegarde : il y a ${d} jour${d > 1 ? 's' : ''}`;
}

const read = (k: string) => {
  try {
    const v = localStorage.getItem(k);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
};
const write = (k: string, v: number) => {
  try {
    localStorage.setItem(k, String(v));
  } catch {
    /* stockage indisponible */
  }
};

export const getLastBackupAt = () => read('lastBackupAt');
export const markBackupDone = (now = Date.now()) => write('lastBackupAt', now);
export const getSnoozedUntil = () => read('backupSnoozedUntil');
export const snoozeReminder = (days = 2, now = Date.now()) => write('backupSnoozedUntil', now + days * DAY);
export function getFirstSeenAt(): number {
  const v = read('firstSeenAt');
  if (v !== null) return v;
  const now = Date.now();
  write('firstSeenAt', now);
  return now;
}
