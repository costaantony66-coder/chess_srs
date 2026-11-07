import { describe, expect, it } from 'vitest';
import { parsePgn } from './pgn';

const PGN = `[Event "Italienne"]
[White "moi"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 {Développement rapide} (3. Bb5 a6 $1) 3... Bc5 (3... Nf6 4. Ng5) 4. O-O 1-0

[Event "Autre"]

1. d4 d5 *
`;

describe('parsePgn', () => {
  const games = parsePgn(PGN);

  it('lit plusieurs parties et leurs en-têtes', () => {
    expect(games).toHaveLength(2);
    expect(games[0].headers.Event).toBe('Italienne');
    expect(games[1].root[0].san).toBe('d4');
  });

  it('place les variantes comme alternatives au coup remplacé', () => {
    const e4 = games[0].root[0];
    const afterNc6 = e4.children[0].children[0].children[0]; // e4 > e5 > Nf3 > Nc6
    expect(afterNc6.san).toBe('Nc6');
    expect(afterNc6.children.map((n) => n.san)).toEqual(['Bc4', 'Bb5']);
    const bc4 = afterNc6.children[0];
    expect(bc4.comment).toBe('Développement rapide');
    expect(bc4.children.map((n) => n.san)).toEqual(['Bc5', 'Nf6']);
    expect(bc4.children[1].children[0].san).toBe('Ng5');
    expect(bc4.children[0].children[0].san).toBe('O-O');
  });

  it('gère les commentaires Lichess et les castings avec zéros', () => {
    const g = parsePgn('1. e4 { [%clk 0:03:00] Bon coup } e5 2. Nf3 Nf6 3. Bc4 Bc5 4. 0-0 *');
    expect(g[0].root[0].comment).toBe('Bon coup');
    let n = g[0].root[0];
    while (n.children[0]) n = n.children[0];
    expect(n.san).toBe('O-O');
  });
});
