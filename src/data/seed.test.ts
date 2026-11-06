import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { SEED_CARDS } from './seed';

describe('cartes de démo', () => {
  it('ont des ids uniques', () => {
    expect(new Set(SEED_CARDS.map((c) => c.id)).size).toBe(SEED_CARDS.length);
  });

  for (const card of SEED_CARDS) {
    it(`${card.id} : FEN valide et solution jouable`, () => {
      const chess = new Chess(card.fen);
      for (const uci of card.solution) {
        chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      }
      if (card.tags.some((t) => t.startsWith('mat-en-'))) expect(chess.isCheckmate()).toBe(true);
    });
  }
});
