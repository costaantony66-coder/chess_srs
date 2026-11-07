import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { errorCards, parseChessComGames, parseLichessNdjson, parsePgnGames } from './games';

const LICHESS = JSON.stringify({
  id: 'abcd1234',
  variant: 'standard',
  winner: 'black',
  createdAt: 1700000000000,
  moves: 'f3 e5 g4 Qh4#',
  opening: { name: 'Barnes Opening' },
  players: { white: { user: { name: 'Alice' } }, black: { user: { name: 'Bob' } } },
  analysis: [
    { eval: -30 },
    { eval: 20 },
    { eval: -900, best: 'e2e4', variation: 'e4 d5', judgment: { name: 'Blunder', comment: 'Blunder. e4 was best.' } },
    { mate: -0 },
  ],
});

const PGN = `[Event "Rated Blitz game"]
[Site "https://lichess.org/abcd1234"]
[White "Alice"]
[Black "Bob"]
[Result "0-1"]

1. f3 e5 2. g4? { (0.10 → -9.00) Blunder. Best move was e4. } (2. e4 d5) 2... Qh4# { Black wins by checkmate. } 0-1
`;

describe('parseLichessNdjson', () => {
  const games = parseLichessNdjson(LICHESS + '\n', 'alice');

  it('lit la partie, ton camp et tes erreurs avec le meilleur coup', () => {
    expect(games).toHaveLength(1);
    const g = games[0];
    expect(g.id).toBe('lichess:abcd1234');
    expect(g.myColor).toBe('white');
    expect(g.analysed).toBe(true);
    expect(g.errors).toEqual([{ ply: 3, severity: 'Blunder', bestUci: 'e2e4' }]);
  });

  it('ignore les parties où le pseudo ne joue pas', () => {
    expect(parseLichessNdjson(LICHESS, 'carol')).toHaveLength(0);
  });

  it('crée une carte depuis la position avant la gaffe', () => {
    const [card] = errorCards(games[0], new Set(['Blunder', 'Mistake']));
    expect(card.id).toBe('err:lichess:abcd1234:3');
    expect(card.type).toBe('mistake');
    expect(card.solution).toEqual(['e2e4']);
    expect(card.lastMove).toBe('e7e5');
    const c = new Chess();
    c.move('f3');
    c.move('e5');
    expect(card.fen).toBe(c.fen());
    expect(card.note).toContain('g4');
  });

  it('filtre selon la gravité choisie', () => {
    expect(errorCards(games[0], new Set(['Inaccuracy']))).toHaveLength(0);
  });
});

describe('parsePgnGames', () => {
  it('lit une analyse Lichess annotée et dédoublonne avec l’API via le lien de la partie', () => {
    const { games } = parsePgnGames(PGN, { username: 'alice' });
    expect(games).toHaveLength(1);
    expect(games[0].id).toBe('lichess:abcd1234');
    expect(games[0].analysed).toBe(true);
    expect(games[0].errors).toEqual([{ ply: 3, severity: 'Blunder', bestUci: 'e2e4' }]);
  });

  it('ignore les erreurs de l’adversaire et signale un camp inconnu', () => {
    expect(parsePgnGames(PGN, { username: 'bob' }).games[0].errors).toHaveLength(0);
    const r = parsePgnGames(PGN, { username: 'carol' });
    expect(r.games).toHaveLength(0);
    expect(r.unresolved).toBe(1);
    expect(parsePgnGames(PGN, { side: 'white' }).games).toHaveLength(1);
  });
});

describe('parseChessComGames', () => {
  const json = {
    games: [
      {
        url: 'https://www.chess.com/game/live/123456789',
        rules: 'chess',
        end_time: 1700000000,
        white: { username: 'Alice' },
        black: { username: 'Bob' },
        pgn: '[Event "Live Chess"]\n[White "Alice"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. e4 {[%clk 0:09:58]} e5 {[%clk 0:09:57]} 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0',
      },
      { url: 'https://www.chess.com/game/live/1', rules: 'chess960', white: { username: 'Alice' }, black: { username: 'Bob' }, pgn: '1. e4 *' },
    ],
  };

  it('importe les parties standard sans analyse', () => {
    const games = parseChessComGames(json, 'alice');
    expect(games).toHaveLength(1);
    expect(games[0].id).toBe('chesscom:123456789');
    expect(games[0].moves).toHaveLength(7);
    expect(games[0].analysed).toBe(false);
    expect(games[0].errors).toEqual([]);
  });
});
