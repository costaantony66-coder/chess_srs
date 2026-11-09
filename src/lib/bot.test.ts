import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { BOT_MAX_ELO, BOT_MIN_ELO, botMove, botParams, prepareBot } from './bot';
import { Uci, type UciTransport } from './engine';

const require = createRequire(import.meta.url);

function nodeEngine(): UciTransport {
  let cb: (l: string) => void = () => {};
  const engine = require('stockfish')('lite-single', (line: string) => cb(line));
  return { send: (c) => engine.processCommand(c), onLine: (f) => (cb = f), terminate: () => engine.terminate() };
}

describe('réglages du bot', () => {
  it('utilise le vrai réglage d’Elo du moteur à partir de 1320, des coups au hasard en dessous', () => {
    expect(botParams(1500)).toMatchObject({ limitStrength: true, uciElo: 1500, randomRate: 0 });
    expect(botParams(2800).movetime).toBe(1000);
    expect(botParams(5000).uciElo).toBe(BOT_MAX_ELO);
    const weak = botParams(400);
    expect(weak).toMatchObject({ limitStrength: false, skill: 0, depth: 1 });
    expect(weak.randomRate).toBeCloseTo(0.6);
    expect(botParams(1000).randomRate).toBeLessThan(weak.randomRate);
    expect(botParams(1300).randomRate).toBeLessThan(0.05);
    expect(botParams(100).randomRate).toBeCloseTo(0.6); // bornes
    expect(BOT_MIN_ELO).toBe(400);
  });
});

describe('bot (moteur réel, Node)', () => {
  const engine = new Uci(nodeEngine());
  beforeAll(() => engine.init(), 60000);
  afterAll(() => engine.terminate());

  const isLegal = (fen: string, u: string) => {
    try {
      new Chess(fen).move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      return true;
    } catch {
      return false;
    }
  };

  it.each([400, 900, 1320, 1800, 2800])('joue un coup légal à %i Elo', async (elo) => {
    await prepareBot(engine, elo);
    const fens = [new Chess().fen(), 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3'];
    for (const fen of fens) expect(isLegal(fen, await botMove(engine, fen, elo, () => 0.99))).toBe(true);
  }, 60000);

  it('chemin « coup au hasard » : choisit un coup légal sans interroger le moteur', async () => {
    const fen = new Chess().fen();
    const u = await botMove(engine, fen, 400, () => 0);
    expect(isLegal(fen, u)).toBe(true);
  });

  it('trouve un mat en 1 à haut niveau', async () => {
    const fen = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1';
    await prepareBot(engine, 2800);
    expect(await botMove(engine, fen, 2800, () => 0.99)).toBe('d1d8');
  }, 60000);
});
