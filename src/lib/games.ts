import { Chess } from 'chess.js';
import type { NewCardInput } from '../db/db';
import { deckPath, SOURCE_LABEL } from './decks';
import { parsePgn } from './pgn';

export type Severity = 'Inaccuracy' | 'Mistake' | 'Blunder';
export const SEVERITIES: Severity[] = ['Inaccuracy', 'Mistake', 'Blunder'];
export const SEVERITY_LABEL: Record<Severity, string> = { Inaccuracy: 'Imprécision', Mistake: 'Erreur', Blunder: 'Gaffe' };

export interface GameError {
  /** Demi-coup de ton coup fautif (1 = premier coup des blancs). */
  ply: number;
  severity: Severity;
  /** Meilleur coup en UCI. */
  bestUci: string;
}

export interface ParsedGame {
  id: string;
  source: 'lichess' | 'chesscom' | 'pgn';
  white: string;
  black: string;
  myColor: 'white' | 'black';
  result: string;
  playedAt?: number;
  opening?: string;
  moves: string[];
  analysed: boolean;
  errors: GameError[];
}

const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

const mine = (ply: number, color: 'white' | 'black') => (ply % 2 === 1) === (color === 'white');
const START = new Chess().fen();

// ---------- Lichess (export JSON/ndjson avec evals=true) ----------

interface LichessGame {
  id: string;
  variant?: string;
  initialFen?: string;
  createdAt?: number;
  winner?: 'white' | 'black';
  status?: string;
  moves?: string;
  opening?: { name?: string };
  players: Record<'white' | 'black', { user?: { name: string }; name?: string; aiLevel?: number }>;
  analysis?: { best?: string; judgment?: { name: string } }[];
}

export function parseLichessNdjson(text: string, username: string): ParsedGame[] {
  const u = username.trim().toLowerCase();
  const out: ParsedGame[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let g: LichessGame;
    try {
      g = JSON.parse(line) as LichessGame;
    } catch {
      continue;
    }
    if ((g.variant && g.variant !== 'standard') || g.initialFen) continue;
    const name = (c: 'white' | 'black') => g.players[c].user?.name ?? g.players[c].name ?? (g.players[c].aiLevel ? `Stockfish ${g.players[c].aiLevel}` : 'Anonyme');
    const white = name('white');
    const black = name('black');
    const myColor = white.toLowerCase() === u ? 'white' : black.toLowerCase() === u ? 'black' : null;
    if (!myColor) continue;
    const moves = (g.moves ?? '').split(' ').filter(Boolean);
    const errors: GameError[] = [];
    (g.analysis ?? []).forEach((a, i) => {
      const ply = i + 1;
      const sev = a.judgment?.name as Severity | undefined;
      if (a.best && sev && SEVERITIES.includes(sev) && mine(ply, myColor)) errors.push({ ply, severity: sev, bestUci: a.best });
    });
    out.push({
      id: `lichess:${g.id}`,
      source: 'lichess',
      white,
      black,
      myColor,
      result: g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : g.status === 'started' ? '*' : '1/2-1/2',
      playedAt: g.createdAt,
      opening: g.opening?.name,
      moves,
      analysed: Array.isArray(g.analysis) && g.analysis.length > 0,
      errors,
    });
  }
  return out;
}

// ---------- PGN (analyse Lichess « literate » : « Mistake. Best move was h6. ») ----------

const ERR_RE = /(Inaccuracy|Mistake|Blunder)\.\s*Best move was ([A-Za-z0-9=+#-]+)/;

export function parsePgnGames(
  text: string,
  opts: { username?: string; side?: 'auto' | 'white' | 'black' } = {},
): { games: ParsedGame[]; unresolved: number } {
  const analysedText = /\[%eval|Best move was/.test(text);
  const u = opts.username?.trim().toLowerCase();
  const games: ParsedGame[] = [];
  let unresolved = 0;

  for (const g of parsePgn(text)) {
    if (g.headers.FEN && g.headers.FEN !== START) continue;
    const white = g.headers.White ?? '?';
    const black = g.headers.Black ?? '?';
    const myColor =
      opts.side && opts.side !== 'auto'
        ? opts.side
        : u && white.toLowerCase() === u
          ? 'white'
          : u && black.toLowerCase() === u
            ? 'black'
            : null;
    if (!myColor) {
      unresolved++;
      continue;
    }

    const chess = new Chess();
    const moves: string[] = [];
    const errors: GameError[] = [];
    for (let kids = g.root; kids.length; ) {
      const node = kids[0];
      const before = chess.fen();
      let mv;
      try {
        mv = chess.move(node.san);
      } catch {
        break;
      }
      moves.push(mv.san);
      const ply = moves.length;
      const m = node.comment ? ERR_RE.exec(node.comment) : null;
      if (m && mine(ply, myColor)) {
        try {
          const b = new Chess(before).move(m[2]);
          errors.push({ ply, severity: m[1] as Severity, bestUci: b.from + b.to + (b.promotion ?? '') });
        } catch {
          /* meilleur coup illisible : on ignore */
        }
      }
      kids = node.children;
    }
    if (!moves.length) continue;

    const site = g.headers.Site ?? '';
    const li = /lichess\.org\/(\w{8})/.exec(site);
    const cc = /chess\.com\/game\/(?:live\/)?(\d+)/.exec(site);
    const date = Date.parse((g.headers.UTCDate ?? g.headers.Date ?? '').replace(/\./g, '-'));
    games.push({
      id: li ? `lichess:${li[1]}` : cc ? `chesscom:${cc[1]}` : `pgn:${hash(`${white}|${black}|${g.headers.Date ?? ''}|${moves.join(' ')}`)}`,
      source: li ? 'lichess' : cc ? 'chesscom' : 'pgn',
      white,
      black,
      myColor,
      result: g.headers.Result ?? '*',
      playedAt: Number.isNaN(date) ? undefined : date,
      opening: g.headers.Opening,
      moves,
      analysed: analysedText,
      errors,
    });
  }
  return { games, unresolved };
}

// ---------- Chess.com (API publique : archives mensuelles) ----------

interface ChessComGame {
  url: string;
  pgn?: string;
  rules?: string;
  end_time?: number;
  white: { username: string };
  black: { username: string };
}

export function parseChessComGames(json: { games?: ChessComGame[] }, username: string): ParsedGame[] {
  const u = username.trim().toLowerCase();
  const out: ParsedGame[] = [];
  for (const g of json.games ?? []) {
    if (g.rules && g.rules !== 'chess') continue;
    if (!g.pgn) continue;
    const side = g.white.username.toLowerCase() === u ? 'white' : g.black.username.toLowerCase() === u ? 'black' : null;
    if (!side) continue;
    const { games } = parsePgnGames(g.pgn, { side });
    const parsed = games[0];
    if (!parsed) continue;
    out.push({
      ...parsed,
      id: `chesscom:${g.url.split('/').pop()}`,
      source: 'chesscom',
      white: g.white.username,
      black: g.black.username,
      playedAt: g.end_time ? g.end_time * 1000 : parsed.playedAt,
      analysed: false,
      errors: [],
    });
  }
  return out;
}

// ---------- Cartes d'erreurs ----------

export function replay(moves: string[]): { fens: string[]; ucis: string[] } {
  const chess = new Chess();
  const fens = [chess.fen()];
  const ucis: string[] = [];
  for (const san of moves) {
    try {
      const m = chess.move(san);
      ucis.push(m.from + m.to + (m.promotion ?? ''));
      fens.push(chess.fen());
    } catch {
      break;
    }
  }
  return { fens, ucis };
}

export const errorCardId = (gameId: string, ply: number) => `err:${gameId}:${ply}`;

export function errorCards(game: ParsedGame, allowed: Set<Severity>): NewCardInput[] {
  const { fens, ucis } = replay(game.moves);
  const opponent = game.myColor === 'white' ? game.black : game.white;
  const out: NewCardInput[] = [];
  for (const e of game.errors) {
    const before = fens[e.ply - 1];
    if (!allowed.has(e.severity) || !before || ucis.length < e.ply) continue;
    try {
      new Chess(before).move({ from: e.bestUci.slice(0, 2), to: e.bestUci.slice(2, 4), promotion: e.bestUci[4] });
    } catch {
      continue;
    }
    out.push({
      id: errorCardId(game.id, e.ply),
      type: 'mistake',
      title: `Erreur · vs ${opponent}`,
      fen: before,
      solution: [e.bestUci],
      tags: [e.severity.toLowerCase()],
      lastMove: ucis[e.ply - 2],
      note: `Dans ta partie, tu avais joué ${game.moves[e.ply - 1]} (${SEVERITY_LABEL[e.severity].toLowerCase()}).`,
      source: 'game',
      gameId: game.id,
      deck: deckPath('Parties', SOURCE_LABEL[game.source]),
    });
  }
  return out;
}
