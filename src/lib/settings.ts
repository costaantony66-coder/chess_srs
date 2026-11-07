const KEY = 'newPerDay';
export const DEFAULT_NEW_PER_DAY = 10;

export function getNewPerDay(): number {
  try {
    const raw = localStorage.getItem(KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_NEW_PER_DAY;
  } catch {
    return DEFAULT_NEW_PER_DAY;
  }
}

export function setNewPerDay(n: number) {
  try {
    localStorage.setItem(KEY, String(Math.max(0, Math.min(100, n))));
  } catch {
    /* stockage indisponible */
  }
}
