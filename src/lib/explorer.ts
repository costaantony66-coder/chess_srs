/** Explorateur d'ouvertures Lichess (parties jouées). Nécessite un jeton personnel, sans aucune autorisation cochée. */
export interface ExplorerMove {
  san: string;
  games: number;
  /** Part parmi les coups listés (0..1). */
  share: number;
}

const TOKEN_KEY = 'lichessToken';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
};

export const setToken = (token: string) => {
  try {
    if (token.trim()) localStorage.setItem(TOKEN_KEY, token.trim());
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* stockage indisponible */
  }
};

export function parseExplorer(json: { moves?: { san: string; white: number; draws: number; black: number }[] }): ExplorerMove[] {
  const moves = (json.moves ?? []).map((m) => ({ san: m.san, games: m.white + m.draws + m.black })).filter((m) => m.games > 0);
  const total = moves.reduce((n, m) => n + m.games, 0);
  return moves.map((m) => ({ ...m, share: total ? m.games / total : 0 })).sort((a, b) => b.games - a.games);
}

export async function fetchExplorer(fen: string, token: string): Promise<ExplorerMove[]> {
  const params = new URLSearchParams({ variant: 'standard', fen, moves: '8', topGames: '0', recentGames: '0', speeds: 'blitz,rapid,classical' });
  let res: Response;
  try {
    res = await fetch(`https://explorer.lichess.org/lichess?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new Error('connexion impossible');
  }
  if (res.status === 401 || res.status === 403) throw new Error('jeton refusé par Lichess');
  if (res.status === 429) throw new Error('trop de requêtes, réessaie dans une minute');
  if (!res.ok) throw new Error(`erreur ${res.status}`);
  return parseExplorer(await res.json());
}

/** Tirage au sort pondéré par le nombre de parties. */
export function pickWeighted<T extends { games: number }>(items: T[], rnd: () => number = Math.random): T {
  const total = items.reduce((n, i) => n + i.games, 0);
  let r = rnd() * total;
  for (const item of items) {
    r -= item.games;
    if (r < 0) return item;
  }
  return items[items.length - 1];
}
