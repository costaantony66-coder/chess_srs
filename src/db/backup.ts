import { markBackupDone } from '../lib/backupReminder';
import { legacyDeck } from '../lib/decks';
import { db, type Game, type RepNode, type Repertoire, type ReviewLog, type StoredCard } from './db';

interface BackupFile {
  app: 'chess-srs';
  version: 1 | 2;
  exportedAt: string;
  cards: StoredCard[];
  reviews: ReviewLog[];
  repertoires?: Repertoire[];
  repnodes?: RepNode[];
  games?: Game[];
}

/** Contenu complet de la sauvegarde (cartes, révisions, répertoires, parties…) au format JSON. */
export async function buildBackup(): Promise<{ json: string; filename: string }> {
  const [cards, reviews, repertoires, repnodes, games] = await Promise.all([
    db.cards.toArray(),
    db.reviews.toArray(),
    db.repertoires.toArray(),
    db.repnodes.toArray(),
    db.games.toArray(),
  ]);
  const file: BackupFile = {
    app: 'chess-srs',
    version: 2,
    exportedAt: new Date().toISOString(),
    cards,
    reviews,
    repertoires,
    repnodes,
    games,
  };
  return { json: JSON.stringify(file), filename: `chess-srs-${new Date().toISOString().slice(0, 10)}.json` };
}

/** Y a-t-il des données à protéger ? */
export async function hasData(): Promise<boolean> {
  const [c, g, r] = await Promise.all([db.cards.count(), db.games.count(), db.repertoires.count()]);
  return c + g + r > 0;
}

export async function exportData() {
  const { json, filename } = await buildBackup();
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  markBackupDone();
}

/** Partage la sauvegarde via la feuille de partage du téléphone (Drive, iCloud, mail…). */
export async function shareBackup(): Promise<'shared' | 'cancelled' | 'unsupported'> {
  const { json, filename } = await buildBackup();
  const file = new File([json], filename, { type: 'application/json' });
  if (!navigator.canShare?.({ files: [file] })) return 'unsupported';
  try {
    await navigator.share({ files: [file], title: 'Sauvegarde Chess SRS' });
    markBackupDone();
    return 'shared';
  } catch (e) {
    return e instanceof DOMException && e.name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}

/** Fusionne une sauvegarde : les cartes de même id sont remplacées. Retourne le nombre de cartes importées. */
export async function importData(file: File): Promise<number> {
  const data = JSON.parse(await file.text()) as BackupFile;
  if (data.app !== 'chess-srs' || !Array.isArray(data.cards) || !Array.isArray(data.reviews)) {
    throw new Error('Fichier non reconnu');
  }
  const cards = data.cards.map((c) => ({
    ...c,
    deck: c.deck ?? legacyDeck(c),
    fsrs: {
      ...c.fsrs,
      due: new Date(c.fsrs.due),
      last_review: c.fsrs.last_review ? new Date(c.fsrs.last_review) : undefined,
    },
  }));
  await db.transaction('rw', db.cards, db.reviews, db.repertoires, db.repnodes, db.games, async () => {
    await db.cards.bulkPut(cards);
    await db.reviews.bulkPut(data.reviews);
    if (data.repertoires) await db.repertoires.bulkPut(data.repertoires);
    if (data.repnodes) await db.repnodes.bulkPut(data.repnodes);
    if (data.games) await db.games.bulkPut(data.games);
  });
  return cards.length;
}
