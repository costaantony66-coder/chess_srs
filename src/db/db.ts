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
  source?: 'demo' | 'lichess';
  createdAt: number;
  /** Copies à plat de fsrs.due / fsrs.state, pour les index. */
  due: number;
  state: number;
  fsrs: FsrsCard;
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
  }
}

export const db = new ChessDB();

export type NewCardInput = Pick<StoredCard, 'type' | 'title' | 'fen' | 'solution' | 'tags'> &
  Partial<Pick<StoredCard, 'rating' | 'lastMove' | 'source'>> & { id?: string };

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
