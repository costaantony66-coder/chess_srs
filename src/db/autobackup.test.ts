// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, makeCard } from './db';
import { KEEP, PREFIX, runAutoBackup, type DirHandle } from './autobackup';

class FakeDir implements DirHandle {
  name = 'Sauvegardes';
  files = new Map<string, string>();
  perm: PermissionState = 'granted';
  async queryPermission() {
    return this.perm;
  }
  async requestPermission() {
    this.perm = 'granted';
    return this.perm;
  }
  async getFileHandle(name: string) {
    return {
      createWritable: async () => {
        let buf = '';
        return {
          write: async (d: string) => void (buf += d),
          close: async () => void this.files.set(name, buf),
        };
      },
    };
  }
  async removeEntry(name: string) {
    this.files.delete(name);
  }
  async *entries(): AsyncIterableIterator<[string, unknown]> {
    for (const k of this.files.keys()) yield [k, {}];
  }
}

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 10, 1, 12);

beforeEach(async () => {
  localStorage.clear();
  await db.cards.clear();
  await db.meta.clear();
});

const withCard = () => db.cards.add(makeCard({ id: 'c1', type: 'tactic', title: 't', fen: 'x', solution: ['e2e4'], tags: [], deck: 'Puzzles::A' }));

describe('sauvegarde automatique', () => {
  it('écrit la sauvegarde du jour (JSON valide) dans le dossier', async () => {
    await withCard();
    const dir = new FakeDir();
    expect(await runAutoBackup({ handle: dir, now: t0 })).toBe('done');
    const [name] = [...dir.files.keys()];
    expect(name).toBe(`${PREFIX}2026-11-01.json`);
    const data = JSON.parse(dir.files.get(name)!);
    expect(data.app).toBe('chess-srs');
    expect(data.cards).toHaveLength(1);
    expect(localStorage.getItem('lastBackupAt')).toBe(String(t0)); // le rappel se met à jour tout seul
  });

  it('une seule sauvegarde par jour, sauf si on force', async () => {
    await withCard();
    const dir = new FakeDir();
    await runAutoBackup({ handle: dir, now: t0 });
    expect(await runAutoBackup({ handle: dir, now: t0 + 3_600_000 })).toBe('skipped');
    expect(await runAutoBackup({ handle: dir, now: t0 + 3_600_000, force: true })).toBe('done');
    expect(await runAutoBackup({ handle: dir, now: t0 + DAY })).toBe('done');
    expect(dir.files.size).toBe(2);
  });

  it(`ne garde que les ${KEEP} sauvegardes les plus récentes`, async () => {
    await withCard();
    const dir = new FakeDir();
    for (let i = 0; i < 10; i++) await runAutoBackup({ handle: dir, now: t0 + i * DAY });
    expect(dir.files.size).toBe(KEEP);
    expect([...dir.files.keys()].sort()[0]).toBe(`${PREFIX}2026-11-04.json`); // les 3 plus anciennes ont disparu
  });

  it('respecte les autorisations et l’absence de données', async () => {
    const dir = new FakeDir();
    expect(await runAutoBackup({ handle: dir, now: t0 })).toBe('empty');
    await withCard();
    dir.perm = 'prompt';
    expect(await runAutoBackup({ handle: dir, now: t0 })).toBe('no-permission');
    expect(dir.files.size).toBe(0);
    expect(await runAutoBackup({ now: t0 })).toBe('disabled'); // aucun dossier choisi
  });
});
