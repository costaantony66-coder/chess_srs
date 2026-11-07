import { describe, expect, it } from 'vitest';
import { State } from 'ts-fsrs';
import type { ReviewLog } from '../db/db';
import { computeStreak, dayKey, heatLevel, heatmap, retentionSince, reviewsPerDay, weeklyRetention } from './stats';

const today = new Date(2026, 10, 7, 14, 0); // samedi 7 novembre 2026
const at = (daysAgo: number, h = 10) => new Date(2026, 10, 7 - daysAgo, h).getTime();
const log = (ts: number, rating = 3, prevState: number = State.Review): ReviewLog => ({
  cardId: 'c', ts, rating, prevState, newState: State.Review, durationMs: 0, correct: rating > 1, scheduledDays: 1,
});

describe('série', () => {
  it('compte les jours consécutifs jusqu’à aujourd’hui et garde le record', () => {
    const perDay = reviewsPerDay([log(at(0)), log(at(1)), log(at(2)), log(at(5)), log(at(6)), log(at(7)), log(at(8)), log(at(9))]);
    expect(computeStreak(perDay, today)).toEqual({ current: 3, best: 5 });
  });

  it('la série reste vivante si tu n’as pas encore révisé aujourd’hui', () => {
    const perDay = reviewsPerDay([log(at(1)), log(at(2))]);
    expect(computeStreak(perDay, today).current).toBe(2);
    expect(computeStreak(reviewsPerDay([log(at(3))]), today).current).toBe(0);
  });
});

describe('heatmap', () => {
  it('18 semaines de 7 jours, lundi en premier, jours futurs marqués', () => {
    const cells = heatmap(reviewsPerDay([log(at(0)), log(at(0, 11))]), today, 18);
    expect(cells).toHaveLength(126);
    expect(new Date(cells[0].key + 'T12:00:00').getDay()).toBe(1);
    const t = cells.find((c) => c.key === dayKey(today))!;
    expect(t.count).toBe(2);
    expect(cells[cells.length - 1].future).toBe(true); // dimanche 8
    expect(heatLevel(0, 5)).toBe(0);
    expect(heatLevel(5, 5)).toBe(4);
  });
});

describe('rétention', () => {
  it('par semaine, seulement sur les cartes « à revoir »', () => {
    const reviews = [log(at(0), 3), log(at(0), 1), log(at(1), 4), log(at(0), 3, State.New), log(at(8), 3), log(at(9), 1)];
    const w = weeklyRetention(reviews, today, 12);
    expect(w).toHaveLength(2);
    expect(w[1]).toMatchObject({ n: 3, rate: 2 / 3 });
    expect(w[0]).toMatchObject({ n: 2, rate: 0.5 });
    expect(retentionSince(reviews, 30, today)).toBeCloseTo(3 / 5);
    expect(retentionSince([], 30, today)).toBeNull();
  });
});
