import type { DrillRun } from '../db/db';
import type { SquareStats } from './coords';

/** Meilleur score (bonnes réponses) pour chaque durée. */
export function bestByDuration(runs: DrillRun[]): Record<number, number> {
  const best: Record<number, number> = {};
  for (const r of runs) best[r.durationSec] = Math.max(best[r.durationSec] ?? 0, r.correct);
  return best;
}

/** Réussites et ratés cumulés par case à trouver. */
export function squareStats(runs: DrillRun[]): SquareStats {
  const stats: SquareStats = {};
  for (const r of runs) {
    for (const [sq, n] of Object.entries(r.ok)) (stats[sq] ??= { ok: 0, ko: 0 }).ok += n;
    for (const [sq, n] of Object.entries(r.ko)) (stats[sq] ??= { ok: 0, ko: 0 }).ko += n;
  }
  return stats;
}

export interface WeakSquare {
  square: string;
  missRate: number;
  attempts: number;
}

/** Cases les plus ratées (au moins `min` essais), de la pire à la moins pire. */
export function weakSquares(stats: SquareStats, { min = 3, top = 5 } = {}): WeakSquare[] {
  return Object.entries(stats)
    .map(([square, s]) => ({ square, attempts: s.ok + s.ko, missRate: s.ko / (s.ok + s.ko) }))
    .filter((s) => s.attempts >= min && s.missRate > 0)
    .sort((a, b) => b.missRate - a.missRate || b.attempts - a.attempts)
    .slice(0, top);
}

/** Précision (%) et temps moyen par bonne réponse (ms) sur les `n` dernières manches. */
export function recentAverages(runs: DrillRun[], n = 10): { accuracy: number | null; avgMs: number | null } {
  const last = [...runs].sort((a, b) => b.ts - a.ts).slice(0, n);
  const attempts = last.reduce((t, r) => t + r.correct + r.errors, 0);
  const withTime = last.filter((r) => r.correct > 0);
  return {
    accuracy: attempts ? Math.round((last.reduce((t, r) => t + r.correct, 0) / attempts) * 100) : null,
    avgMs: withTime.length ? Math.round(withTime.reduce((t, r) => t + r.avgMs, 0) / withTime.length) : null,
  };
}

/** Scores successifs (du plus ancien au plus récent) pour une durée. */
export function seriesFor(runs: DrillRun[], durationSec: number, n = 20): { ts: number; score: number }[] {
  return runs
    .filter((r) => r.durationSec === durationSec)
    .sort((a, b) => a.ts - b.ts)
    .slice(-n)
    .map((r) => ({ ts: r.ts, score: r.correct }));
}
