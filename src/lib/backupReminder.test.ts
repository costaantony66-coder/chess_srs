import { describe, expect, it } from 'vitest';
import { DAY, describeAge, shouldRemind } from './backupReminder';

const now = 1_000 * DAY;
const base = { hasData: true, lastBackupAt: null, firstSeenAt: null, snoozedUntil: null, now };

describe('rappel de sauvegarde', () => {
  it('ne rappelle rien tant qu’il n’y a pas de données', () => {
    expect(shouldRemind({ ...base, hasData: false, firstSeenAt: now - 30 * DAY })).toBe(false);
  });

  it('jamais sauvegardé : rappel après 3 jours d’usage', () => {
    expect(shouldRemind({ ...base, firstSeenAt: now - 2 * DAY })).toBe(false);
    expect(shouldRemind({ ...base, firstSeenAt: now - 3 * DAY })).toBe(true);
  });

  it('déjà sauvegardé : rappel après 7 jours', () => {
    expect(shouldRemind({ ...base, lastBackupAt: now - 6 * DAY, firstSeenAt: now - 90 * DAY })).toBe(false);
    expect(shouldRemind({ ...base, lastBackupAt: now - 7 * DAY, firstSeenAt: now - 90 * DAY })).toBe(true);
  });

  it('« Plus tard » repousse le rappel', () => {
    expect(shouldRemind({ ...base, lastBackupAt: now - 20 * DAY, snoozedUntil: now + DAY })).toBe(false);
    expect(shouldRemind({ ...base, lastBackupAt: now - 20 * DAY, snoozedUntil: now - 1 })).toBe(true);
  });

  it('décrit l’ancienneté de la dernière sauvegarde', () => {
    expect(describeAge(null, now)).toContain('Aucune');
    expect(describeAge(now - 1000, now)).toContain('aujourd’hui');
    expect(describeAge(now - 3 * DAY, now)).toContain('3 jours');
  });
});
