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
}

export interface Evaluator {
  analyse(fen: string, depth: number): Promise<Evaluation>;
}

const toCp = (kind: string, value: number) =>
  kind === 'cp' ? value : (value >= 0 ? 1 : -1) * (10000 - Math.abs(value));

/** Chances de gain dans [-1, 1] (formule de Lichess). */
export const winChance = (cp: number) => 2 / (1 + Math.exp(-0.00368208 * Math.max(-1000, Math.min(1000, cp)))) - 1;

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

  async init() {
    const ok = this.waitFor((l) => l === 'uciok');
    this.transport.send('uci');
    await ok;
    const ready = this.waitFor((l) => l === 'readyok');
    this.transport.send('isready');
    await ready;
  }

  analyse(fen: string, depth: number): Promise<Evaluation> {
    return new Promise((resolve) => {
      let cp = 0;
      const l = (line: string) => {
        if (line.startsWith('info') && line.includes(' score ') && !/lowerbound|upperbound/.test(line)) {
          const m = /score (cp|mate) (-?\d+)/.exec(line);
          if (m) cp = toCp(m[1], Number(m[2]));
        } else if (line.startsWith('bestmove')) {
          this.listeners.delete(l);
          const best = line.split(' ')[1];
          resolve({ cp, best: best && best !== '(none)' ? best : '' });
        }
      };
      this.listeners.add(l);
      this.transport.send(`position fen ${fen}`);
      this.transport.send(`go depth ${depth}`);
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
