import { db } from './db';
import { buildBackup, hasData } from './backup';
import { markBackupDone } from '../lib/backupReminder';

/** Sauvegarde automatique dans un dossier choisi (Chrome / Edge sur ordinateur : API d'accès aux fichiers). */
export interface DirHandle {
  name: string;
  queryPermission?(d: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(d: { mode: 'readwrite' }): Promise<PermissionState>;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }> }>;
  removeEntry(name: string): Promise<void>;
  entries(): AsyncIterableIterator<[string, unknown]>;
}

const KEY = 'autoBackupDir';
export const KEEP = 7;
export const PREFIX = 'chess-srs-auto-';
const MIN_GAP = 20 * 3_600_000;
const LAST = 'lastAutoBackupAt';

export const supportsAutoBackup = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

const getHandle = async () => (await db.meta.get(KEY))?.value as DirHandle | undefined;
const lastAuto = () => {
  try {
    const v = localStorage.getItem(LAST);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
};

/** Ouvre le sélecteur de dossier et mémorise le choix. Retourne le nom du dossier. */
export async function chooseBackupFolder(): Promise<string> {
  const picker = (window as unknown as { showDirectoryPicker: (o: object) => Promise<DirHandle> }).showDirectoryPicker;
  const handle = await picker({ mode: 'readwrite', id: 'chess-srs-backup' });
  await db.meta.put({ key: KEY, value: handle });
  return handle.name;
}

export async function disableAutoBackup() {
  await db.meta.delete(KEY);
}

export interface AutoBackupStatus {
  supported: boolean;
  enabled: boolean;
  folder?: string;
  permission: 'granted' | 'prompt' | 'denied' | 'none';
  lastAt: number | null;
}

export async function autoBackupStatus(): Promise<AutoBackupStatus> {
  const supported = supportsAutoBackup();
  const handle = await getHandle();
  if (!handle) return { supported, enabled: false, permission: 'none', lastAt: lastAuto() };
  let permission: AutoBackupStatus['permission'] = 'prompt';
  try {
    permission = (await handle.queryPermission?.({ mode: 'readwrite' })) ?? 'prompt';
  } catch {
    permission = 'denied';
  }
  return { supported, enabled: true, folder: handle.name, permission, lastAt: lastAuto() };
}

/** À appeler depuis un clic : redonne au navigateur l'autorisation d'écrire dans le dossier. */
export async function grantAutoBackupPermission(): Promise<boolean> {
  const handle = await getHandle();
  if (!handle?.requestPermission) return false;
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
}

export type AutoResult = 'done' | 'skipped' | 'disabled' | 'no-permission' | 'empty';

const today = (now: number) => new Date(now).toISOString().slice(0, 10);

/** Écrit la sauvegarde du jour dans le dossier et garde les `KEEP` plus récentes. */
export async function runAutoBackup(opts: { force?: boolean; now?: number; handle?: DirHandle } = {}): Promise<AutoResult> {
  const now = opts.now ?? Date.now();
  const handle = opts.handle ?? (await getHandle());
  if (!handle) return 'disabled';
  try {
    if ((await handle.queryPermission?.({ mode: 'readwrite' })) !== 'granted') return 'no-permission';
  } catch {
    return 'no-permission';
  }
  const last = lastAuto();
  if (!opts.force && last !== null && now - last < MIN_GAP) return 'skipped';
  if (!(await hasData())) return 'empty';

  const { json } = await buildBackup();
  const file = await handle.getFileHandle(`${PREFIX}${today(now)}.json`, { create: true });
  const w = await file.createWritable();
  await w.write(json);
  await w.close();

  const names: string[] = [];
  for await (const [name] of handle.entries()) if (name.startsWith(PREFIX) && name.endsWith('.json')) names.push(name);
  names.sort().reverse();
  for (const old of names.slice(KEEP)) await handle.removeEntry(old);

  try {
    localStorage.setItem(LAST, String(now));
  } catch {
    /* stockage indisponible */
  }
  markBackupDone(now);
  return 'done';
}
