// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, type DrillRun } from '../../db/db';
import { VisionStats } from './VisionStats';

const run = (p: Partial<DrillRun>): DrillRun => ({
  ts: 1, kind: 'coords', durationSec: 60, orientation: 'white', aid: false, correct: 10, errors: 0, avgMs: 2000, ok: {}, ko: {}, ...p,
});

beforeEach(async () => {
  await db.drills.clear();
});
afterEach(cleanup);

describe('statistiques « Vision de l’échiquier »', () => {
  it('invite à s’entraîner quand il n’y a encore rien', async () => {
    render(<VisionStats />);
    await waitFor(() => expect(screen.getByText(/Aucune manche pour l’instant/)).toBeTruthy());
  });

  it('résume les manches : records, précision, cases difficiles', async () => {
    await db.drills.bulkAdd([
      run({ ts: 1, durationSec: 30, correct: 12, errors: 1, avgMs: 2400, ok: { e4: 4, f7: 1 }, ko: { f7: 2 } }),
      run({ ts: 2, durationSec: 30, correct: 15, errors: 0, avgMs: 2000, ok: { e4: 4, f7: 1 }, ko: { f7: 1 } }),
      run({ ts: 3, durationSec: 60, correct: 30, errors: 4, avgMs: 1800, ok: { e4: 2 } }),
    ]);
    render(<VisionStats />);
    await waitFor(() => expect(screen.getByText(/3 manches/)).toBeTruthy());
    expect(screen.getAllByText('15').length).toBeGreaterThan(0); // record 30 s
    expect(screen.getAllByText('30').length).toBeGreaterThan(0); // record 1 min
    expect(screen.getByText('f7')).toBeTruthy(); // 3 ratés sur 5 essais : la case la plus difficile (affichée en capitales par le style)
    expect(screen.getByText(/precision|précision/)).toBeTruthy();
  });
});
