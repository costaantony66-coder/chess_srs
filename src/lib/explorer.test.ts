import { describe, expect, it } from 'vitest';
import { parseExplorer, pickWeighted } from './explorer';

const SAMPLE = {
  white: 100,
  draws: 20,
  black: 80,
  moves: [
    { uci: 'g1f3', san: 'Nf3', averageRating: 1800, white: 10, draws: 5, black: 5, game: null, opening: null },
    { uci: 'e2e4', san: 'e4', averageRating: 1800, white: 60, draws: 10, black: 30, game: null, opening: null },
    { uci: 'e1h1', san: 'O-O', averageRating: 1800, white: 0, draws: 0, black: 0, game: null, opening: null },
  ],
};

describe('explorateur Lichess', () => {
  it('trie par popularité, calcule les parts et écarte les coups jamais joués', () => {
    const moves = parseExplorer(SAMPLE);
    expect(moves.map((m) => m.san)).toEqual(['e4', 'Nf3']);
    expect(moves[0].share).toBeCloseTo(100 / 120);
    expect(parseExplorer({})).toEqual([]);
  });

  it('tirage pondéré : respecte les poids', () => {
    const moves = parseExplorer(SAMPLE);
    expect(pickWeighted(moves, () => 0).san).toBe('e4');
    expect(pickWeighted(moves, () => 0.99).san).toBe('Nf3');
  });
});
