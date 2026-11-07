import Dexie, { type Table } from 'dexie';
import type { Card as FsrsCard } from 'ts-fsrs';
import { newFsrsCard } from '../lib/fsrs';

export type CardType = 'tactic' | 'opening' | 'endgame';

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
  source?: 'demo' | 'lichess' | 'repertoire';
  /** Autres premiers coups acceptés (répertoire). */
  alts?: string[];
  /** Coups joués avant la position, en SAN (répertoire). */
  line?: string;
  note?: string;
  repId?: string;
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

class ChessDB extends Dexie {
  cards!: Table<StoredCard, string>;
  reviews!: Table<ReviewLog, number>;
  repertoires!: Table<Repertoire, string>;
  repnodes!: Table<RepNode, string>;

  constructor() {
    super('chess-srs');
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
  }
}

export const db = new ChessDB();

export type NewCardInput = Pick<StoredCard, 'type' | 'title' | 'fen' | 'solution' | 'tags'> &
  Partial<Pick<StoredCard, 'rating' | 'lastMove' | 'source' | 'alts' | 'line' | 'note' | 'repId'>> & { id?: string };

export function makeCard(input: NewCardInput): StoredCard {
  const now = new Date();
  const fsrs = newFsrsCard(now);
  return {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    createdAt: now.getTime(),
    due: fsrs.due.getTime(),
    state: fsrs.state,
    fsrs,
  };
}
