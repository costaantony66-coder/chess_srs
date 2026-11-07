import { db, makeCard, type NewCardInput } from '../db/db';

export const SEED_CARDS: (NewCardInput & { id: string })[] = [
  {
    id: 'demo-mat-berger',
    type: 'tactic',
    title: 'Mat du berger',
    tags: ['mat-en-1'],
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    solution: ['h5f7'],
  },
  {
    id: 'demo-mat-couloir',
    type: 'tactic',
    title: 'Mat du couloir',
    tags: ['mat-en-1'],
    fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
    solution: ['d1d8'],
  },
  {
    id: 'demo-mat-en-2',
    type: 'tactic',
    title: 'Mat en 2 : deux tours',
    tags: ['mat-en-2'],
    fen: '6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1',
    solution: ['b1b7', 'g8f8', 'a2a8'],
  },
  {
    id: 'demo-fourchette-cavalier',
    type: 'tactic',
    title: 'Fourchette de cavalier',
    tags: ['fourchette'],
    fen: '3q3k/8/8/6N1/8/8/8/6K1 w - - 0 1',
    solution: ['g5f7', 'h8g8', 'f7d8'],
  },
  {
    id: 'demo-fourchette-pion',
    type: 'tactic',
    title: 'Fourchette de pion',
    tags: ['fourchette'],
    fen: '4k3/8/8/3r1n2/8/4P1P1/8/4K3 w - - 0 1',
    solution: ['e3e4', 'f5g3', 'e4d5'],
  },
  {
    id: 'demo-clouage-fg5',
    type: 'tactic',
    title: 'Clouer le cavalier',
    tags: ['clouage'],
    fen: 'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4',
    solution: ['c1g5'],
  },
  {
    id: 'demo-italienne',
    type: 'opening',
    title: 'Italienne : 3ᵉ coup des blancs',
    tags: ['italienne', 'blancs'],
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
    solution: ['f1c4'],
  },
  {
    id: 'demo-reponse-e4',
    type: 'opening',
    title: 'Réponse à 1.e4',
    tags: ['noirs'],
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    solution: ['e7e5'],
  },
  {
    id: 'demo-mat-tour',
    type: 'endgame',
    title: 'Mat roi + tour',
    tags: ['mat-en-1', 'mat-de-la-tour'],
    fen: '7k/8/6K1/8/8/8/8/R7 w - - 0 1',
    solution: ['a1a8'],
  },
];

/** Ajoute les cartes de démo absentes. Retourne le nombre de cartes ajoutées. */
export async function seedDeck(): Promise<number> {
  const existing = new Set(await db.cards.bulkGet(SEED_CARDS.map((c) => c.id)).then((r) => r.filter(Boolean).map((c) => c!.id)));
  const toAdd = SEED_CARDS.filter((c) => !existing.has(c.id)).map((c) => makeCard({ ...c, deck: 'Démo' }));
  await db.cards.bulkAdd(toAdd);
  return toAdd.length;
}
