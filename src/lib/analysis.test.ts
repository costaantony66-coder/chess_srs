import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { analyseGame, severityOf } from './analysis';
import { Uci, winChance, type UciTransport } from './engine';

const require = createRequire(import.meta.url);

function nodeEngine(): UciTransport {
  let cb: (l: string) => void = () => {};
  const engine = require('stockfish')('lite-single', (line: string) => cb(line));
  return {
    send: (cmd) => engine.processCommand(cmd),
    onLine: (f) => (cb = f),
    terminate: () => engine.terminate(),
  };
}

describe('seuils', () => {
  it('classe la perte de chances de gain comme Lichess', () => {
    expect(severityOf(0.05)).toBeNull();
    expect(severityOf(0.1)).toBe('Inaccuracy');
    expect(severityOf(0.25)).toBe('Mistake');
    expect(severityOf(0.6)).toBe('Blunder');
    expect(winChance(0)).toBeCloseTo(0);
    expect(winChance(10000)).toBeLessThan(1);
  });
});

describe('Stockfish (moteur réel, Node)', () => {
  // Le moteur Node ne peut être créé qu'une fois par processus : on le partage.
  const engine = new Uci(nodeEngine());
  beforeAll(() => engine.init(), 60000);
  afterAll(() => engine.terminate());

  it('trouve la gaffe 2.g4?? du mat du fou et propose un meilleur coup légal', async () => {
    const progress: number[] = [];
    const errors = await analyseGame(['f3', 'e5', 'g4', 'Qh4#'], 'white', engine, { depth: 8, onProgress: (d) => progress.push(d) });
    const blunder = errors.find((e) => e.ply === 3);
    expect(blunder?.severity).toBe('Blunder');
    expect(blunder!.bestUci).not.toBe('g2g4');
    const c = new Chess();
    c.move('f3');
    c.move('e5');
    expect(() => c.move({ from: blunder!.bestUci.slice(0, 2), to: blunder!.bestUci.slice(2, 4), promotion: blunder!.bestUci[4] })).not.toThrow();
    expect(progress.at(-1)).toBe(5);
  }, 60000);

  it("ne signale rien quand le coup joué est le meilleur (mat en 1)", async () => {
    const errors = await analyseGame(['f3', 'e5', 'g4', 'Qh4#'], 'black', engine, { depth: 8 });
    expect(errors.find((e) => e.ply === 4)).toBeUndefined();
  }, 60000);
});
