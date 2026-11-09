import { Chess } from 'chess.js';
import type { Uci } from './engine';

export const BOT_MIN_ELO = 400;
export const BOT_MAX_ELO = 2800;

export interface BotParams {
  /** Stockfish limite lui-même sa force (UCI_Elo, de 1320 à 3190). */
  limitStrength: boolean;
  uciElo?: number;
  skill: number;
  /** Profondeur de recherche (niveaux faibles) ou durée en ms (niveaux élevés). */
  depth?: number;
  movetime?: number;
  /** Probabilité de jouer un coup au hasard (niveaux < 1320, pour descendre sous la force minimale du moteur). */
  randomRate: number;
}

/**
 * Réglages du bot pour un Elo visé. Approximatif : Stockfish ne garantit pas ces niveaux.
 * ≥ 1320 : vrai réglage d'Elo du moteur. En dessous : niveau de compétence 0, recherche très courte
 * et coups au hasard de plus en plus fréquents.
 */
export function botParams(elo: number): BotParams {
  const e = Math.max(BOT_MIN_ELO, Math.min(BOT_MAX_ELO, elo));
  if (e >= 1320) return { limitStrength: true, uciElo: Math.min(3190, e), skill: 20, movetime: e >= 2000 ? 1000 : 500, randomRate: 0 };
  return { limitStrength: false, skill: 0, depth: e < 800 ? 1 : 2, randomRate: Math.max(0, Math.min(0.6, ((1300 - e) / 900) * 0.6)) };
}

/** Prépare le moteur pour une nouvelle partie contre le bot. */
export async function prepareBot(engine: Uci, elo: number) {
  const p = botParams(elo);
  await engine.newGame();
  await engine.setOption('UCI_LimitStrength', p.limitStrength);
  if (p.limitStrength) await engine.setOption('UCI_Elo', p.uciElo!);
  await engine.setOption('Skill Level', p.skill);
}

const uci = (m: { from: string; to: string; promotion?: string }) => m.from + m.to + (m.promotion ?? '');

/** Coup du bot (UCI) pour la position donnée. */
export async function botMove(engine: Uci, fen: string, elo: number, rnd: () => number = Math.random): Promise<string> {
  const legal = new Chess(fen).moves({ verbose: true });
  if (legal.length === 0) throw new Error('Aucun coup légal');
  const p = botParams(elo);
  if (rnd() < p.randomRate) return uci(legal[Math.floor(rnd() * legal.length)]);
  const r = await engine.search(fen, p.movetime ? `movetime ${p.movetime}` : `depth ${p.depth}`);
  return r.best || uci(legal[0]);
}
