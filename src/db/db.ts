import Dexie, { type Table } from 'dexie';
import type { Card as FsrsCard } from 'ts-fsrs';
import { defaultDeck, legacyDeck } from '../lib/decks';
import { newFsrsCard } from '../lib/fsrs';

export type CardType = 'tactic' | 'opening' | 'endgame' | 'mistake';

export interface StoredCard {
  id: string;
  type: CardType;
  title: string;
  /** Position de départ ; le trait indique qui doit jouer. */
  fen: string;
  /** Coups en UCI, alternant toi / adversaire, en commençant par toi (ex. ["g5f7","h8g8","f7d8"]). */
  solution: string[];
  tags: string[];
  /** Elo du puzzle (cartes Lichess). */
  rating?: number;
  /** Dernier coup de l'adversaire (UCI), pour le surligner au départ. */
  lastMove?: string;
  source?: 'demo' | 'lichess' | 'repertoire' | 'game';
  /** Autres premiers coups acceptés (répertoire). */
  alts?: string[];
  /** Coups joués avant la position, en SAN (répertoire). */
  line?: string;
  note?: string;
  repId?: string;
  /** Partie d'origine (cartes d'erreurs). */
  gameId?: string;
  /** Paquet (chemin façon Anki). */
  deck: string;
  /** Carte-ligne : suite de coups à rejouer (le paquet « Lignes »). */
  lineMode?: boolean;
  /** Dernier coup (nœud du répertoire) d'une carte-ligne. */
  lineEnd?: string;
  createdAt: number;
  /** Copies à plat de fsrs.due / fsrs.state, pour les index. */
  due: number;
  state: number;
  fsrs: FsrsCard;
}

export interface Repertoire {
  id: string;
  name: string;
  color: 'white' | 'black';
  createdAt: number;
}

/** Un coup du répertoire. parentId = 'root' pour le premier coup. */
export interface RepNode {
  id: string;
  repId: string;
  parentId: string;
  /** Demi-coup : 1 = premier coup des blancs. */
  ply: number;
  seq: number;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  comment?: string;
}

export interface Game {
  id: string;
  source: 'lichess' | 'chesscom' | 'pgn';
  white: string;
  black: string;
  myColor: 'white' | 'black';
  result: string;
  playedAt?: number;
  opening?: string;
  /** Coups en SAN, séparés par des espaces. */
  moves: string;
  /** Une analyse (évaluations) était disponible à l'import. */
  analysed: boolean;
  importedAt: number;
  favorite?: boolean;
}

export interface ReviewLog {
  id?: number;
  cardId: string;
  ts: number;
  rating: number;
  prevState: number;
  newState: number;
  durationMs: number;
  correct: boolean;
  scheduledDays: number;
}

export class ChessDB extends Dexie {
  cards!: Table<StoredCard, string>;
  reviews!: Table<ReviewLog, number>;
  repertoires!: Table<Repertoire, string>;
  repnodes!: Table<RepNode, string>;
  games!: Table<Game, string>;

  constructor(name = 'chess-srs') {
    super(name);
    this.version(1).stores({
      cards: 'id, type, due, state, createdAt',
      reviews: '++id, cardId, ts',
    });
    this.version(2).stores({
      cards: 'id, type, due, state, createdAt, rating, *tags',
      reviews: '++id, cardId, ts',
    });
    this.version(3).stores({
      cards: 'id, type, due, state, createdAt, rating, repId, *tags',
      reviews: '++id, cardId, ts',
      repertoires: 'id, createdAt',
      repnodes: 'id, repId, [repId+parentId]',
    });
    this.version(4).stores({
      cards: 'id, type, due, state, createdAt, rating, repId, gameId, *tags',
      reviews: '++id, cardId, ts',
      repertoires: 'id, createdAt',
      repnodes: 'id, repId, [repId+parentId]',
      games: 'id, source, importedAt',
    });
    this.version(5)
      .stores({
        cards: 'id, type, due, state, createdAt, rating, repId, gameId, deck, *tags',
        reviews: '++id, cardId, ts',
        repertoires: 'id, createdAt',
        repnodes: 'id, repId, [repId+parentId]',
        games: 'id, source, importedAt',
      })
      .upgrade(async (tx) => {
        const reps = new Map((await tx.table('repertoires').toArray()).map((r: Repertoire) => [r.id, r.name]));
        const games = new Map((await tx.table('games').toArray()).map((g: Game) => [g.id, g.source]));
        await tx
          .table('cards')
          .toCollection()
          .modify((c: StoredCard) => {
            if (!c.deck) c.deck = legacyDeck(c, { repName: c.repId ? reps.get(c.repId) : undefined, gameSource: c.gameId ? games.get(c.gameId) : undefined });
          });
      });
    // v6 : coups isolés d'une ouverture dans le sous-paquet « Coups seuls » (frère de « Lignes »)
    this.version(6)
      .stores({
        cards: 'id, type, due, state, createdAt, rating, repId, gameId, deck, *tags',
        reviews: '++id, cardId, ts',
        repertoires: 'id, createdAt',
        repnodes: 'id, repId, [repId+parentId]',
        games: 'id, source, importedAt',
      })
      .upgrade((tx) =>
        tx
          .table('cards')
          .toCollection()
          .modify((c: StoredCard) => {
            if (c.source === 'repertoire' && !c.lineMode && c.deck.startsWith('Ouvertures::') && c.deck.split('::').length === 2) {
              c.deck = `${c.deck}::Coups seuls`;
            }
          }),
      );
  }
}

export const db = new ChessDB();

export type NewCardInput = Pick<StoredCard, 'type' | 'title' | 'fen' | 'solution' | 'tags'> &
  Partial<Pick<StoredCard, 'rating' | 'lastMove' | 'source' | 'alts' | 'line' | 'note' | 'repId' | 'gameId' | 'deck' | 'lineMode' | 'lineEnd'>> & { id?: string };

export function makeCard(input: NewCardInput): StoredCard {
  const now = new Date();
  const fsrs = newFsrsCard(now);
  return {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    deck: input.deck ?? defaultDeck(input),
    createdAt: now.getTime(),
    due: fsrs.due.getTime(),
    state: fsrs.state,
    fsrs,
  };
}
