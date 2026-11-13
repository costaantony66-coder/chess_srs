import { describe, expect, it } from 'vitest';
import type { DrillRun } from '../db/db';
import { bestByDuration, recentAverages, seriesFor, squareStats, weakSquares } from './drills';

const run = (p: Partial<DrillRun>): DrillRun => ({
  ts: 1, kind: 'coords', durationSec: 60, orientation: 'white', aid: false, correct: 10, errors: 0, avgMs: 2000, ok: {}, ko: {}, ...p,
});

describe('statistiques des manches', () => {
  const runs = [
    run({ ts: 1, durationSec: 30, correct: 12, errors: 1, avgMs: 2400, ok: { e4: 2, f7: 1 }, ko: { f7: 1 } }),
    run({ ts: 2, durationSec: 30, correct: 15, errors: 0, avgMs: 2000, ok: { e4: 3, f7: 1 } }),
    run({ ts: 3, durationSec: 60, correct: 30, errors: 5, avgMs: 1800, ok: { e4: 1 }, ko: { f7: 2, a1: 1 } }),
  ];

  it('meilleur score par durée', () => {
    expect(bestByDuration(runs)).toEqual({ 30: 15, 60: 30 });
    expect(bestByDuration([])).toEqual({});
  });

  it('cumule réussites et ratés par case, puis repère les cases difficiles', () => {
    const stats = squareStats(runs);
    expect(stats.f7).toEqual({ ok: 2, ko: 3 });
    expect(stats.e4).toEqual({ ok: 6, ko: 0 });
    const weak = weakSquares(stats, { min: 3 });
    expect(weak.map((w) => w.square)).toEqual(['f7']); // a1 : un seul essai, e4 : jamais raté
    expect(weak[0].missRate).toBeCloseTo(0.6);
  });

  it('précision et temps moyen sur les dernières manches', () => {
    const r = recentAverages(runs, 2); // les 2 plus récentes : ts 3 et ts 2
    expect(r.accuracy).toBe(Math.round(((30 + 15) / (35 + 15)) * 100));
    expect(r.avgMs).toBe(1900);
    expect(recentAverages([], 5)).toEqual({ accuracy: null, avgMs: null });
  });

  it('série de scores d’une durée, du plus ancien au plus récent', () => {
    expect(seriesFor(runs, 30)).toEqual([{ ts: 1, score: 12 }, { ts: 2, score: 15 }]);
    expect(seriesFor(runs, 180)).toEqual([]);
  });
});
