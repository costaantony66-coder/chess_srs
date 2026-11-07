import { Chess } from 'chess.js';
import { db, makeCard, type NewCardInput } from '../db/db';
import { isKnownTheme, themeLabel } from './themes';

/** [id, FEN avant le coup de l'adversaire, coups UCI (1er = adversaire), Elo, thèmes] */
export type PuzzleEntry = [id: string, fen: string, moves: string, rating: number, themes: string];

export interface PackIndex {
  generated: string;
  themes: Record<string, { count: number; min: number; max: number }>;
}

const uci = (m: string) => ({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });

/** Transforme un puzzle Lichess en carte : l'adversaire joue son coup, puis c'est à toi. */
export function puzzleToCard(entry: PuzzleEntry, theme: string): NewCardInput | null {
  const [id, fen, movesStr, rating, themes] = entry;
  const moves = movesStr.split(' ');
  if (moves.length < 2) return null;
  try {
    const chess = new Chess(fen);
    chess.move(uci(moves[0]));
    const startFen = chess.fen();
    const solution = moves.slice(1);
    for (const m of solution) chess.move(uci(m)); // vérifie que toute la ligne est jouable
    const tags = themes.split(' ').filter(isKnownTheme);
    if (!tags.includes(theme)) tags.unshift(theme);
    return {
      id: `lichess-${id}`,
      type: 'tactic',
      title: `Puzzle · ${themeLabel(theme)}`,
      fen: startFen,
      solution,
      tags,
      rating,
      lastMove: moves[0],
      source: 'lichess',
    };
  } catch {
    return null;
  }
}

const base = () => import.meta.env.BASE_URL;
const cache = new Map<string, PuzzleEntry[]>();

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base()}puzzles/${path}`);
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) throw new Error('pack indisponible');
  return res.json() as Promise<T>;
}

export const loadIndex = () => fetchJson<PackIndex>('index.json');

export async function loadTheme(theme: string): Promise<PuzzleEntry[]> {
  const hit = cache.get(theme);
  if (hit) return hit;
  const data = await fetchJson<PuzzleEntry[]>(`${theme}.json`);
  cache.set(theme, data);
  return data;
}

export interface ImportResult {
  added: number;
  available: number;
}

/** Ajoute `count` puzzles tirés au hasard (thème + tranche d'Elo), sans doublons. */
export async function importPuzzles(opts: { theme: string; min: number; max: number; count: number }): Promise<ImportResult> {
  const pool = (await loadTheme(opts.theme)).filter((p) => p[3] >= opts.min && p[3] <= opts.max);
  const known = await db.cards.bulkGet(pool.map((p) => `lichess-${p[0]}`));
  const fresh = pool.filter((_, i) => !known[i]);
  for (let i = fresh.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
  }
  const cards = [];
  for (const p of fresh) {
    if (cards.length >= opts.count) break;
    const input = puzzleToCard(p, opts.theme);
    if (input) cards.push(makeCard(input));
  }
  await db.cards.bulkAdd(cards);
  return { added: cards.length, available: fresh.length };
}
