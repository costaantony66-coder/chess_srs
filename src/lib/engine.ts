/** Dialogue UCI avec un moteur d'échecs (Stockfish) via un transport abstrait (Worker, Node…). */
export interface UciTransport {
  send(cmd: string): void;
  onLine(cb: (line: string) => void): void;
  terminate(): void;
}

export interface Evaluation {
  /** Évaluation en centipions du point de vue du camp au trait (mat = ±10000). */
  cp: number;
  /** Meilleur coup UCI ('' si la position est terminée). */
  best: string;
  /** Évaluation du 2ᵉ meilleur coup (même point de vue), absente s'il n'y a qu'un coup légal. */
  second?: number;
}

export interface Evaluator {
  analyse(fen: string, depth: number): Promise<Evaluation>;
}

const toCp = (kind: string, value: number) =>
  kind === 'cp' ? value : (value >= 0 ? 1 : -1) * (10000 - Math.abs(value));

/** Points attendus dans [0, 1] à partir d'une évaluation en centipions (formule de Lichess). */
export const expectedPoints = (cp: number) => 1 / (1 + Math.exp(-0.00368208 * Math.max(-1000, Math.min(1000, cp))));

/** Chances de gain dans [-1, 1]. */
export const winChance = (cp: number) => 2 * expectedPoints(cp) - 1;

export class Uci implements Evaluator {
  private listeners = new Set<(line: string) => void>();

  constructor(private transport: UciTransport) {
    transport.onLine((line) => this.listeners.forEach((l) => l(line)));
  }

  private waitFor(pred: (line: string) => boolean): Promise<void> {
    return new Promise((resolve) => {
      const l = (line: string) => {
        if (pred(line)) {
          this.listeners.delete(l);
          resolve();
        }
      };
      this.listeners.add(l);
    });
  }

  /** `multiPv` : nombre de coups évalués par position (2 pour repérer les « seuls bons coups »). */
  async init(multiPv = 1) {
    const ok = this.waitFor((l) => l === 'uciok');
    this.transport.send('uci');
    await ok;
    if (multiPv > 1) this.transport.send(`setoption name MultiPV value ${multiPv}`);
    const ready = this.waitFor((l) => l === 'readyok');
    this.transport.send('isready');
    await ready;
  }

  /** Règle une option UCI puis attend que le moteur soit prêt. */
  async setOption(name: string, value: string | number | boolean) {
    this.transport.send(`setoption name ${name} value ${value}`);
    await this.isReady();
  }

  async isReady() {
    const ready = this.waitFor((l) => l === 'readyok');
    this.transport.send('isready');
    await ready;
  }

  async newGame() {
    this.transport.send('ucinewgame');
    await this.isReady();
  }

  analyse(fen: string, depth: number): Promise<Evaluation> {
    return this.search(fen, `depth ${depth}`);
  }

  /** Lance une recherche (`go <args>` : « depth 12 », « movetime 500 »…) et attend le meilleur coup. */
  search(fen: string, goArgs: string): Promise<Evaluation> {
    return new Promise((resolve) => {
      const scores = new Map<number, number>(); // numéro de ligne (multipv) -> dernière évaluation
      const l = (line: string) => {
        if (line.startsWith('info') && line.includes(' score ') && !/lowerbound|upperbound/.test(line)) {
          const m = /score (cp|mate) (-?\d+)/.exec(line);
          if (m) scores.set(Number(/ multipv (\d+)/.exec(line)?.[1] ?? 1), toCp(m[1], Number(m[2])));
        } else if (line.startsWith('bestmove')) {
          this.listeners.delete(l);
          const best = line.split(' ')[1];
          resolve({ cp: scores.get(1) ?? 0, best: best && best !== '(none)' ? best : '', second: scores.get(2) });
        }
      };
      this.listeners.add(l);
      this.transport.send(`position fen ${fen}`);
      this.transport.send(`go ${goArgs}`);
    });
  }

  terminate() {
    this.transport.terminate();
  }
}

/** Stockfish 19 « lite » (≈2 Mo, un seul thread) dans un Web Worker. Fichiers copiés dans public/stockfish. */
export function stockfishWorker(): UciTransport {
  const worker = new Worker(`${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`);
  return {
    send: (cmd) => worker.postMessage(cmd),
    onLine: (cb) => {
      worker.onmessage = (ev: MessageEvent) => String(ev.data).split('\n').forEach((l) => l && cb(l));
    },
    terminate: () => worker.terminate(),
  };
}
