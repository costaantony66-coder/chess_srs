/** Base d'ouvertures (lichess-org/chess-openings, CC0) : position → nom. Chargée à la demande (≈400 Ko). */
export interface Book {
  /** Nom de l'ouverture si la position est « de théorie ». */
  name(fen: string): string | undefined;
}

const key = (fen: string) => fen.split(' ').slice(0, 3).join(' ');

export function makeBook(map: Record<string, string>): Book {
  return { name: (fen) => map[key(fen)] };
}

let cached: Promise<Book> | undefined;
export function loadBook(): Promise<Book> {
  cached ??= import('./openings.json').then((m) => makeBook(m.default as Record<string, string>));
  return cached;
}
