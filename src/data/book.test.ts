import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { loadBook } from './book';
import { formatEval } from '../lib/analysis';

describe('base d’ouvertures embarquée', () => {
  it('reconnaît la Ruy Lopez et ne connaît pas une position hasardeuse', async () => {
    const book = await loadBook();
    const c = new Chess();
    for (const m of ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']) c.move(m);
    expect(book.name(c.fen())).toContain('Ruy Lopez');
    const d = new Chess();
    for (const m of ['h4', 'a5', 'Rh3', 'a4', 'Rg3', 'a3']) d.move(m);
    expect(book.name(d.fen())).toBeUndefined();
  });
});

describe('formatEval', () => {
  it('affiche centipions et mats', () => {
    expect(formatEval(85)).toBe('+0,9');
    expect(formatEval(-230)).toBe('-2,3');
    expect(formatEval(0)).toBe('0,0');
    expect(formatEval(9997)).toBe('M3');
    expect(formatEval(-9998)).toBe('-M2');
  });
});
