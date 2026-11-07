import { State } from 'ts-fsrs';
import type { ReviewLog } from '../db/db';

/** Clé de jour locale « AAAA-MM-JJ ». */
export const dayKey = (ts: number | Date) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setHours(12, 0, 0, 0); // midi : insensible aux changements d'heure
  r.setDate(r.getDate() + n);
  return r;
};

export function reviewsPerDay(reviews: ReviewLog[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of reviews) m.set(dayKey(r.ts), (m.get(dayKey(r.ts)) ?? 0) + 1);
  return m;
}

/** Série en cours (elle reste vivante si tu n'as pas encore révisé aujourd'hui) et record. */
export function computeStreak(perDay: Map<string, number>, today = new Date()): { current: number; best: number } {
  let cursor = addDays(today, 0);
  if (!perDay.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  let current = 0;
  while (perDay.has(dayKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const days = [...perDay.keys()].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of days) {
    const expected = prev ? dayKey(addDays(new Date(prev + 'T12:00:00'), 1)) : null;
    run = prev && expected === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return { current, best };
}

export interface HeatCell {
  key: string;
  count: number;
  future: boolean;
}

/** Grille de `weeks` semaines (lundi → dimanche), la dernière contenant aujourd'hui. */
export function heatmap(perDay: Map<string, number>, today = new Date(), weeks = 18): HeatCell[] {
  const t = addDays(today, 0);
  const offsetToMonday = (t.getDay() + 6) % 7;
  const start = addDays(t, -offsetToMonday - (weeks - 1) * 7);
  const cells: HeatCell[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    const key = dayKey(d);
    cells.push({ key, count: perDay.get(key) ?? 0, future: d.getTime() > t.getTime() + 1000 });
  }
  return cells;
}

export const heatLevel = (count: number, max: number) => (count === 0 || max === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4)));

export interface RetentionPoint {
  weekStart: string;
  rate: number;
  n: number;
}

/** Rétention réelle par semaine : part des cartes « à revoir » réussies (note autre que Again). */
export function weeklyRetention(reviews: ReviewLog[], today = new Date(), weeks = 12): RetentionPoint[] {
  const t = addDays(today, 0);
  const monday = addDays(t, -((t.getDay() + 6) % 7));
  const first = addDays(monday, -(weeks - 1) * 7);
  const buckets = new Map<string, { ok: number; n: number }>();
  for (const r of reviews) {
    if (r.prevState !== State.Review) continue;
    const d = addDays(new Date(r.ts), 0);
    if (d < first) continue;
    const key = dayKey(addDays(d, -((d.getDay() + 6) % 7)));
    const b = buckets.get(key) ?? { ok: 0, n: 0 };
    b.n++;
    if (r.rating > 1) b.ok++;
    buckets.set(key, b);
  }
  const out: RetentionPoint[] = [];
  for (let i = 0; i < weeks; i++) {
    const key = dayKey(addDays(first, i * 7));
    const b = buckets.get(key);
    if (b) out.push({ weekStart: key, rate: b.ok / b.n, n: b.n });
  }
  return out;
}

/** Rétention sur les `days` derniers jours (null s'il n'y a aucune carte à revoir révisée). */
export function retentionSince(reviews: ReviewLog[], days = 30, now = new Date()): number | null {
  const since = now.getTime() - days * 86400000;
  const rs = reviews.filter((r) => r.prevState === State.Review && r.ts >= since);
  return rs.length ? rs.filter((r) => r.rating > 1).length / rs.length : null;
}
