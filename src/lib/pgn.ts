export interface PgnNode {
  san: string;
  comment?: string;
  /** Le premier enfant est la suite principale ; les suivants sont des variantes. */
  children: PgnNode[];
}

export interface PgnGame {
  headers: Record<string, string>;
  /** Coups possibles depuis la position de départ. */
  root: PgnNode[];
}

type Holder = { children: PgnNode[]; comment?: string };
type Tok = { t: 'move' | 'comment'; v: string } | { t: 'open' } | { t: 'close' };

const TOKEN =
  /\s+|\{([^}]*)\}|;[^\n]*|(\()|(\))|\$\d+|\d+\.+|(?:1-0|0-1|1\/2-1\/2|\*)|((?:O-O(?:-O)?|0-0(?:-0)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?)[+#]?)[!?]*/y;

function tokenize(text: string): Tok[] {
  const toks: Tok[] = [];
  let pos = 0;
  while (pos < text.length) {
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(text);
    if (!m) {
      pos++;
      continue;
    }
    pos = TOKEN.lastIndex;
    if (m[1] !== undefined) {
      const c = m[1].replace(/\[%[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
      if (c) toks.push({ t: 'comment', v: c });
    } else if (m[2]) toks.push({ t: 'open' });
    else if (m[3]) toks.push({ t: 'close' });
    else if (m[4]) toks.push({ t: 'move', v: m[4].replace(/0/g, 'O') });
  }
  return toks;
}

function parseLine(toks: Tok[], i: number, start: Holder): number {
  let cur: Holder = start;
  let before: Holder = start;
  while (i < toks.length) {
    const tok = toks[i];
    if (tok.t === 'open') {
      i = parseLine(toks, i + 1, before);
      continue;
    }
    if (tok.t === 'close') return i + 1;
    if (tok.t === 'comment') {
      if (cur !== start) cur.comment = cur.comment ? `${cur.comment} ${tok.v}` : tok.v;
    } else {
      const node: PgnNode = { san: tok.v, children: [] };
      cur.children.push(node);
      before = cur;
      cur = node;
    }
    i++;
  }
  return i;
}

/** Lit un PGN (une ou plusieurs parties, variantes et commentaires inclus). */
export function parsePgn(input: string): PgnGame[] {
  const games: PgnGame[] = [];
  let headers: Record<string, string> = {};
  let hasHeaders = false;
  let movetext = '';

  const flush = () => {
    const root: Holder = { children: [] };
    parseLine(tokenize(movetext), 0, root);
    if (root.children.length) games.push({ headers, root: root.children });
    headers = {};
    hasHeaders = false;
    movetext = '';
  };

  for (const line of input.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const h = /^\s*\[(\w+)\s+"(.*)"\]\s*$/.exec(line);
    if (h) {
      if (movetext.trim()) flush();
      headers[h[1]] = h[2];
      hasHeaders = true;
    } else {
      movetext += line + '\n';
    }
  }
  if (movetext.trim() || hasHeaders) flush();
  return games;
}
