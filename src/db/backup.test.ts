import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, makeCard } from './db';
import { buildBackup, hasData, importData } from './backup';

beforeEach(async () => {
  for (const t of [db.cards, db.reviews, db.repertoires, db.repnodes, db.games, db.meta]) await t.clear();
});

describe('sauvegarde et restauration', () => {
  it('une sauvegarde contient tout et se restaure à l’identique (dates comprises)', async () => {
    expect(await hasData()).toBe(false);
    await db.cards.add(makeCard({ id: 'c1', type: 'tactic', title: 'Mat', fen: 'x', solution: ['e2e4'], tags: ['fork'], deck: 'Puzzles::Fourchette' }));
    await db.repertoires.add({ id: 'r1', name: 'Londres', color: 'white', createdAt: 1 });
    await db.games.add({ id: 'g1', source: 'bot', white: 'Moi', black: 'SF', myColor: 'white', result: '1-0', moves: 'e4', analysed: false, importedAt: 1, favorite: true });
    await db.meta.put({ key: 'autoBackupDir', value: { not: 'exportable' } });
    expect(await hasData()).toBe(true);

    const { json, filename } = await buildBackup();
    expect(filename).toMatch(/^chess-srs-\d{4}-\d{2}-\d{2}\.json$/);
    const data = JSON.parse(json);
    expect(Object.keys(data)).not.toContain('meta'); // le dossier de sauvegarde n'est pas exporté
    expect(data.cards).toHaveLength(1);

    const before = (await db.cards.get('c1'))!;
    for (const t of [db.cards, db.repertoires, db.games]) await t.clear();
    expect(await importData(new File([json], 'b.json'))).toBe(1);
    const after = (await db.cards.get('c1'))!;
    expect(after.fsrs.due).toBeInstanceOf(Date);
    expect(after.fsrs.due.getTime()).toBe(before.fsrs.due.getTime());
    expect((await db.games.get('g1'))!.favorite).toBe(true);
    expect(await db.repertoires.count()).toBe(1);
  });

  it('refuse un fichier qui n’est pas une sauvegarde', async () => {
    await expect(importData(new File(['{"x":1}'], 'x.json'))).rejects.toThrow();
  });
});
