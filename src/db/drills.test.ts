import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { buildBackup, importData } from './backup';
import { getBestByDuration, getSquareStats, listDrills, saveDrill } from './drills';

beforeEach(async () => {
  await db.drills.clear();
});

const base = { kind: 'coords' as const, orientation: 'white' as const, aid: false, errors: 0, avgMs: 1500, ok: {}, ko: {} };

describe('manches enregistrées', () => {
  it('enregistre, retrouve les records et les cases ratées', async () => {
    await saveDrill({ ...base, ts: 1, durationSec: 60, correct: 20, errors: 2, ok: { e4: 3 }, ko: { f7: 2 } });
    await saveDrill({ ...base, ts: 2, durationSec: 60, correct: 25, ok: { f7: 1 } });
    await saveDrill({ ...base, ts: 3, durationSec: 30, correct: 11 });
    expect(await getBestByDuration()).toEqual({ 60: 25, 30: 11 });
    expect((await getSquareStats()).f7).toEqual({ ok: 1, ko: 2 });
    expect((await listDrills()).map((r) => r.ts)).toEqual([1, 2, 3]);
  });

  it('fait partie de la sauvegarde et se restaure', async () => {
    await saveDrill({ ...base, ts: 5, durationSec: 120, correct: 40 });
    const { json } = await buildBackup();
    expect(JSON.parse(json).drills).toHaveLength(1);
    await db.drills.clear();
    await importData(new File([json.replace('"cards":[]', '"cards":[]')], 'b.json'));
    expect((await listDrills())[0].correct).toBe(40);
  });
});
