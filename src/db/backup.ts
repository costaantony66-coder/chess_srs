import { db, type ReviewLog, type StoredCard } from './db';

interface BackupFile {
  app: 'chess-srs';
  version: 1;
  exportedAt: string;
  cards: StoredCard[];
  reviews: ReviewLog[];
}

export async function exportData() {
  const [cards, reviews] = await Promise.all([db.cards.toArray(), db.reviews.toArray()]);
  const file: BackupFile = { app: 'chess-srs', version: 1, exportedAt: new Date().toISOString(), cards, reviews };
  const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `chess-srs-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Fusionne une sauvegarde : les cartes de même id sont remplacées. Retourne le nombre de cartes importées. */
export async function importData(file: File): Promise<number> {
  const data = JSON.parse(await file.text()) as BackupFile;
  if (data.app !== 'chess-srs' || !Array.isArray(data.cards) || !Array.isArray(data.reviews)) {
    throw new Error('Fichier non reconnu');
  }
  const cards = data.cards.map((c) => ({
    ...c,
    fsrs: {
      ...c.fsrs,
      due: new Date(c.fsrs.due),
      last_review: c.fsrs.last_review ? new Date(c.fsrs.last_review) : undefined,
    },
  }));
  await db.transaction('rw', db.cards, db.reviews, async () => {
    await db.cards.bulkPut(cards);
    await db.reviews.bulkPut(data.reviews);
  });
  return cards.length;
}
