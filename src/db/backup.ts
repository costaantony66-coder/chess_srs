import { db, type RepNode, type Repertoire, type ReviewLog, type StoredCard } from './db';

interface BackupFile {
  app: 'chess-srs';
  version: 1 | 2;
  exportedAt: string;
  cards: StoredCard[];
  reviews: ReviewLog[];
  repertoires?: Repertoire[];
  repnodes?: RepNode[];
}

export async function exportData() {
  const [cards, reviews, repertoires, repnodes] = await Promise.all([
    db.cards.toArray(),
    db.reviews.toArray(),
    db.repertoires.toArray(),
    db.repnodes.toArray(),
  ]);
  const file: BackupFile = {
    app: 'chess-srs',
    version: 2,
    exportedAt: new Date().toISOString(),
    cards,
    reviews,
    repertoires,
    repnodes,
  };
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
  await db.transaction('rw', db.cards, db.reviews, db.repertoires, db.repnodes, async () => {
    await db.cards.bulkPut(cards);
    await db.reviews.bulkPut(data.reviews);
    if (data.repertoires) await db.repertoires.bulkPut(data.repertoires);
    if (data.repnodes) await db.repnodes.bulkPut(data.repnodes);
  });
  return cards.length;
}
