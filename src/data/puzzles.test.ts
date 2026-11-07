import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { puzzleToCard, type PuzzleEntry } from './puzzles';

const HEADER = 'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags';
const ROWS = [
  'aaaaa,r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3,g8f6 h5f7,650,80,95,5000,mate mateIn1 short opening,https://lichess.org/x,',
  'bbbbb,r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3,g8f6 h5f7,1300,80,90,4000,mate mateIn1 hangingPiece,https://lichess.org/y,',
  'ccccc,r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3,g8f6 h5f7,900,80,99,10,mateIn1,https://lichess.org/z,',
];

describe('packs de puzzles', () => {
  it('le script génère un pack par thème, filtre les puzzles peu joués', () => {
    const dir = mkdtempSync(join(tmpdir(), 'puzzles-'));
    execFileSync('node', ['scripts/build-puzzles.mjs', dir], { input: [HEADER, ...ROWS].join('\n') });
    const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
    expect(index.themes.mateIn1).toEqual({ count: 2, min: 650, max: 1300 });
    expect(index.themes.hangingPiece.count).toBe(1);
    const pack = JSON.parse(readFileSync(join(dir, 'mateIn1.json'), 'utf8')) as PuzzleEntry[];
    expect(pack.map((p) => p[0])).toEqual(['aaaaa', 'bbbbb']);
  });

  it('puzzleToCard joue le coup adverse puis donne la solution', () => {
    const entry: PuzzleEntry = ['aaaaa', 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', 'g8f6 h5f7', 650, 'mateIn1 short'];
    const card = puzzleToCard(entry, 'mateIn1')!;
    expect(card.id).toBe('lichess-aaaaa');
    expect(card.solution).toEqual(['h5f7']);
    expect(card.lastMove).toBe('g8f6');
    expect(card.tags).toEqual(['mateIn1']);
    const chess = new Chess(card.fen);
    expect(chess.turn()).toBe('w');
    chess.move({ from: 'h5', to: 'f7' });
    expect(chess.isCheckmate()).toBe(true);
  });

  it('rejette un puzzle dont la ligne est injouable', () => {
    const bad: PuzzleEntry = ['x', 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', 'g8f6 a1a8', 700, 'mateIn1'];
    expect(puzzleToCard(bad, 'mateIn1')).toBeNull();
  });
});
