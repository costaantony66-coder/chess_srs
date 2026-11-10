import { db, type StoredCard } from './db';
import { inDeck } from '../lib/decks';
import type { ReviewUndo } from './queue';

/**
 * Les cartes d'un répertoire sont gérées par le répertoire (supprimer ou déplacer un coup se fait dans l'éditeur) :
 * on peut seulement les suspendre.
 */
export const isManagedByRepertoire = (c: Pick<StoredCard, 'source'>) => c.source === 'repertoire';

export async function setSuspended(ids: string[], suspended: boolean): Promise<number> {
  return db.transaction('rw', db.cards, async () => {
    const cards = (await db.cards.bulkGet(ids)).filter((c): c is StoredCard => !!c);
    await db.cards.bulkPut(cards.map((c) => ({ ...c, suspended })));
    return cards.length;
  });
}

export async function deleteCards(ids: string[]): Promise<{ deleted: number; skipped: number }> {
  const cards = (await db.cards.bulkGet(ids)).filter((c): c is StoredCard => !!c);
  const deletable = cards.filter((c) => !isManagedByRepertoire(c));
  await db.cards.bulkDelete(deletable.map((c) => c.id));
  return { deleted: deletable.length, skipped: cards.length - deletable.length };
}

export async function moveCards(ids: string[], deck: string): Promise<{ moved: number; skipped: number }> {
  const cards = (await db.cards.bulkGet(ids)).filter((c): c is StoredCard => !!c);
  const movable = cards.filter((c) => !isManagedByRepertoire(c));
  await db.cards.bulkPut(movable.map((c) => ({ ...c, deck })));
  return { moved: movable.length, skipped: cards.length - movable.length };
}

/** Chemins de paquets existants (les plus profonds), triés. */
export async function listDecks(scope?: string | null): Promise<string[]> {
  const all = (await db.cards.toArray()).filter((c) => !scope || inDeck(c.deck, scope));
  return [...new Set(all.map((c) => c.deck))].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** Annule la dernière note : la carte retrouve son état précédent et la révision disparaît du journal. */
export async function undoReview({ previous, logId }: ReviewUndo) {
  await db.transaction('rw', db.cards, db.reviews, async () => {
    await db.cards.put(previous);
    await db.reviews.delete(logId);
  });
}
