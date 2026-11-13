/** Logique de l'entraînement aux coordonnées (Plateau › Positions). */
export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
/** a1, b1 … h1, a2 … h8 */
export const ALL_SQUARES: string[] = RANKS.flatMap((r) => FILES.map((f) => `${f}${r}`));

export const DURATIONS = [30, 60, 120, 180] as const;
export type Duration = (typeof DURATIONS)[number];
/** Pénalité par erreur : 3 secondes en moins sur le chronomètre. */
export const PENALTY_MS = 3000;

export const durationLabel = (sec: number) => (sec < 60 ? `${sec} s` : `${sec / 60} min`);

/** a1 est une case sombre. */
export const isDarkSquare = (sq: string) => (FILES.indexOf(sq[0] as (typeof FILES)[number]) + (Number(sq[1]) - 1)) % 2 === 0;

export type SquareStats = Record<string, { ok: number; ko: number }>;

/** Poids de tirage : une case souvent ratée revient plus souvent (de 1 à environ 9). */
export function weightsFromStats(stats: SquareStats): Record<string, number> {
  const w: Record<string, number> = {};
  for (const sq of ALL_SQUARES) {
    const s = stats[sq];
    w[sq] = s ? 1 + (8 * s.ko) / (s.ok + s.ko + 2) : 1;
  }
  return w;
}

/** Case suivante : au hasard, jamais deux fois la même d'affilée, éventuellement pondérée. */
export function nextTarget(prev: string | null, rnd: () => number = Math.random, weights?: Record<string, number>): string {
  const pool = ALL_SQUARES.filter((s) => s !== prev);
  if (!weights) return pool[Math.floor(rnd() * pool.length)];
  const total = pool.reduce((n, s) => n + (weights[s] ?? 1), 0);
  let r = rnd() * total;
  for (const s of pool) {
    r -= weights[s] ?? 1;
    if (r < 0) return s;
  }
  return pool[pool.length - 1];
}

/**
 * Saisie au clavier d'une case : « f » puis « 7 » = f7. Une nouvelle lettre remplace la précédente ;
 * les autres touches sont ignorées.
 */
export function typedSquare(pending: string | null, key: string): { pending: string | null; square?: string } {
  const k = key.toLowerCase();
  if (/^[a-h]$/.test(k)) return { pending: k };
  if (/^[1-8]$/.test(k) && pending) return { pending: null, square: pending + k };
  return { pending };
}

export const accuracy = (correct: number, errors: number) => (correct + errors === 0 ? 0 : Math.round((correct / (correct + errors)) * 100));
