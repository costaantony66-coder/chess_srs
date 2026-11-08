/** Appels réseau vers Lichess et Chess.com (API publiques, appelées depuis le navigateur). */

async function check(res: Response, what: string) {
  if (res.status === 404) throw new Error(`${what} introuvable : vérifie le pseudo.`);
  if (res.status === 429) throw new Error('Trop de requêtes : réessaie dans une minute.');
  if (!res.ok) throw new Error(`Erreur ${res.status} en contactant le service.`);
}

export async function fetchLichess(username: string, max: number): Promise<string> {
  const params = new URLSearchParams({
    max: String(max),
    opening: 'true',
    moves: 'true',
    perfType: 'ultraBullet,bullet,blitz,rapid,classical,correspondence',
  });
  try {
    const res = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(username.trim())}?${params}`, {
      headers: { Accept: 'application/x-ndjson' },
    });
    await check(res, 'Utilisateur');
    return await res.text();
  } catch (e) {
    if (e instanceof TypeError) throw new Error('Connexion impossible : vérifie ta connexion internet.');
    throw e;
  }
}

export async function fetchChessCom(username: string, months: number): Promise<{ games?: unknown[] }> {
  const user = encodeURIComponent(username.trim().toLowerCase());
  try {
    const res = await fetch(`https://api.chess.com/pub/player/${user}/games/archives`);
    await check(res, 'Joueur');
    const { archives } = (await res.json()) as { archives: string[] };
    const games: unknown[] = [];
    for (const url of archives.slice(-months).reverse()) {
      const r = await fetch(url);
      await check(r, 'Archive');
      const json = (await r.json()) as { games?: unknown[] };
      games.push(...(json.games ?? []).reverse());
    }
    return { games };
  } catch (e) {
    if (e instanceof TypeError) throw new Error('Connexion impossible : vérifie ta connexion internet.');
    throw e;
  }
}
