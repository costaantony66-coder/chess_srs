import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { makeBook } from '../data/book';
import { analyseGameFull, classifyMoves, errorsFromAnalysis, lossClass, materialBalance, moveAccuracy } from './analysis';
import { Uci, expectedPoints, type Evaluation, type UciTransport } from './engine';
import { replay } from './games';

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

/** centipions correspondant à une probabilité de gain donnée */
const cpFor = (ep: number) => Math.log(ep / (1 - ep)) / 0.00368208;

describe('seuils et précision', () => {
  it('classe la perte de points attendus comme Chess.com', () => {
    expect(lossClass(0.01)).toBe('excellent');
    expect(lossClass(0.04)).toBe('good');
    expect(lossClass(0.08)).toBe('inaccuracy');
    expect(lossClass(0.15)).toBe('mistake');
    expect(lossClass(0.3)).toBe('blunder');
    expect(expectedPoints(0)).toBeCloseTo(0.5);
    expect(moveAccuracy(0)).toBeGreaterThan(99.9);
    expect(moveAccuracy(0.3)).toBeLessThan(moveAccuracy(0.05));
  });

  it('compte le matériel du point de vue d’un camp', () => {
    expect(materialBalance(new Chess().fen(), 'w')).toBe(0);
    const c = new Chess();
    for (const m of ['e4', 'd5', 'exd5']) c.move(m);
    expect(materialBalance(c.fen(), 'w')).toBe(1);
    expect(materialBalance(c.fen(), 'b')).toBe(-1);
  });
});

describe('classification (évaluations simulées)', () => {
  const run = (moves: string[], evals: Evaluation[], book?: Parameters<typeof classifyMoves>[3]) => {
    const { fens, ucis } = replay(moves);
    return classifyMoves(fens, ucis, evals, book);
  };
  /** évaluations « tout est le meilleur coup » pour une liste de coups */
  const allBest = (moves: string[]): Evaluation[] => {
    const { ucis } = replay(moves);
    return [...ucis.map((u) => ({ cp: 0, best: u })), { cp: 0, best: '' }];
  };

  it.each([
    [0.01, 'excellent'],
    [0.04, 'good'],
    [0.08, 'inaccuracy'],
    [0.15, 'mistake'],
    [0.3, 'blunder'],
  ] as const)('perte de %s => %s', (loss, expected) => {
    const evals: Evaluation[] = [
      { cp: 0, best: 'd2d4' },
      { cp: -cpFor(0.5 - loss), best: '' },
    ];
    expect(run(['e4'], evals).classes[0]).toBe(expected);
  });

  it('meilleur coup, puis très bon coup quand le 2ᵉ coup est nettement moins bon', () => {
    expect(run(['e4'], [{ cp: 0, best: 'e2e4', second: -20 }, { cp: 0, best: '' }]).classes[0]).toBe('best');
    expect(run(['e4'], [{ cp: 0, best: 'e2e4', second: -300 }, { cp: 0, best: '' }]).classes[0]).toBe('great');
  });

  it('coup manqué : imprécision juste après une faute adverse', () => {
    const moves = ['e4', 'e5', 'Nf3'];
    const evals: Evaluation[] = [
      { cp: 0, best: 'e2e4' },
      { cp: 0, best: 'd7d5' }, // les noirs jouent e5 au lieu de d5 : perte de 0,3
      { cp: -cpFor(0.2), best: 'd2d4' }, // les blancs devraient mieux jouer : perte de 0,08
      { cp: -cpFor(0.72), best: '' },
    ];
    expect(run(moves, evals).classes).toEqual(['best', 'blunder', 'miss']);
  });

  it('brillant : le sacrifice de dame de Légal (5.Cxe5!)', () => {
    const moves = ['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'g6', 'Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#'];
    const evals = allBest(moves);
    evals[8] = { cp: 100, best: 'f3e5', second: -100 };
    evals[9] = { cp: -9000, best: 'g4d1' }; // les noirs, au trait, sont perdus
    evals[13] = { cp: -10000, best: '' };
    const { classes } = run(moves, evals);
    expect(classes[8]).toBe('brilliant');
    expect(classes[0]).toBe('best');
  });

  it('théorie : une position connue de la base d’ouvertures', () => {
    const moves = ['e4', 'e5'];
    const { fens } = replay(moves);
    const book = makeBook({ [fens[2].split(' ').slice(0, 3).join(' ')]: 'Test Opening' });
    expect(run(moves, allBest(moves), book).classes).toEqual(['best', 'book']);
  });

  it('précision : 100 quand tous les coups sont les meilleurs', () => {
    expect(run(['e4', 'e5'], allBest(['e4', 'e5'])).accuracy).toEqual({ white: 100, black: 100 });
  });
});

describe('Stockfish (moteur réel, Node)', () => {
  // Le moteur Node ne peut être créé qu'une fois par processus : on le partage.
  const engine = new Uci(nodeEngine());
  beforeAll(() => engine.init(2), 60000);
  afterAll(() => engine.terminate());

  it('renvoie deux lignes (MultiPV) pour une position de départ', async () => {
    const ev = await engine.analyse(new Chess().fen(), 8);
    expect(ev.best).toMatch(/^[a-h][1-8][a-h][1-8]/);
    expect(ev.second).toBeTypeOf('number');
  }, 60000);

  it('classe la gaffe 2.g4?? du mat du fou et propose un meilleur coup légal', async () => {
    const progress: number[] = [];
    const moves = ['f3', 'e5', 'g4', 'Qh4#'];
    const { analysis } = await analyseGameFull(moves, engine, { depth: 8, onProgress: (d) => progress.push(d) });
    expect(analysis.classes[2]).toBe('blunder');
    expect(analysis.classes[3]).toBe('best');
    expect(analysis.evals).toHaveLength(5);
    expect(analysis.evals[4]).toBeLessThan(-5000); // les blancs sont maté
    expect(progress.at(-1)).toBe(5);

    const errors = errorsFromAnalysis(analysis, 'white');
    const blunder = errors.find((e) => e.ply === 3)!;
    expect(blunder.severity).toBe('Blunder');
    expect(blunder.bestUci).not.toBe('g2g4');
    const c = new Chess();
    c.move('f3');
    c.move('e5');
    expect(() => c.move({ from: blunder.bestUci.slice(0, 2), to: blunder.bestUci.slice(2, 4), promotion: blunder.bestUci[4] })).not.toThrow();
    expect(errorsFromAnalysis(analysis, 'black').find((e) => e.ply === 4)).toBeUndefined();
  }, 60000);
});
