import { Chess } from 'chess.js';
import { db, makeCard, type NewCardInput, type RepNode, type Repertoire, type StoredCard } from './db';
import { parsePgn, type PgnNode } from '../lib/pgn';
import { State } from 'ts-fsrs';
import { applyReview } from './queue';
import { openingDecks } from '../lib/decks';

export const ROOT = 'root';
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const posKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ');
export const cardIdFor = (repId: string, fenBefore: string) => `rep:${repId}:${posKey(fenBefore)}`;

/** Mise en forme d'une ligne : "1.e4 e5 2.Nf3". */
export function formatLine(nodes: RepNode[]): string {
  return nodes
    .map((n, i) => {
      if (n.ply % 2 === 1) return `${(n.ply + 1) / 2}.${n.san}`;
      return i === 0 ? `${n.ply / 2}...${n.san}` : n.san;
    })
    .join(' ');
}

export async function createRepertoire(name: string, color: 'white' | 'black'): Promise<Repertoire> {
  const rep: Repertoire = { id: crypto.randomUUID(), name: name.trim() || 'Mon répertoire', color, createdAt: Date.now() };
  await db.repertoires.add(rep);
  return rep;
}

export async function deleteRepertoire(id: string) {
  await db.transaction('rw', db.repertoires, db.repnodes, db.cards, async () => {
    await db.repnodes.where('repId').equals(id).delete();
    await db.cards.where('repId').equals(id).delete();
    await db.repertoires.delete(id);
  });
}

export async function loadNodes(repId: string): Promise<RepNode[]> {
  return db.repnodes.where('repId').equals(repId).sortBy('seq');
}

// ---------- Construction de l'arbre en mémoire ----------

interface Tree {
  byKey: Map<string, RepNode>;
  created: RepNode[];
  dirty: Set<RepNode>;
  seq: number;
}

async function loadTree(repId: string): Promise<Tree> {
  const nodes = await loadNodes(repId);
  return {
    byKey: new Map(nodes.map((n) => [`${n.parentId}|${n.uci}`, n])),
    created: [],
    dirty: new Set(),
    seq: nodes.reduce((m, n) => Math.max(m, n.seq), 0),
  };
}

type Parent = { id: string; fen: string; ply: number };
const rootParent: Parent = { id: ROOT, fen: START_FEN, ply: 0 };
const asParent = (n: RepNode): Parent => ({ id: n.id, fen: n.fenAfter, ply: n.ply });

type MoveInput = { san: string } | { from: string; to: string; promotion?: string };

function extend(tree: Tree, repId: string, parent: Parent, input: MoveInput): RepNode | null {
  const chess = new Chess(parent.fen);
  let m;
  try {
    m = 'san' in input ? chess.move(input.san) : chess.move(input);
  } catch {
    return null;
  }
  const uci = m.from + m.to + (m.promotion ?? '');
  const key = `${parent.id}|${uci}`;
  const hit = tree.byKey.get(key);
  if (hit) return hit;
  const node: RepNode = {
    id: crypto.randomUUID(),
    repId,
    parentId: parent.id,
    ply: parent.ply + 1,
    seq: ++tree.seq,
    san: m.san,
    uci,
    fenBefore: parent.fen,
    fenAfter: chess.fen(),
  };
  tree.byKey.set(key, node);
  tree.created.push(node);
  return node;
}

async function commit(tree: Tree) {
  const toSave = [...new Set([...tree.created, ...tree.dirty])];
  if (toSave.length) await db.repnodes.bulkPut(toSave);
}

/** Joue un coup depuis `parentId` (l'ajoute s'il n'existe pas). Retourne null si illégal. */
export async function addMove(
  repId: string,
  parentId: string,
  from: string,
  to: string,
  promotion = 'q',
): Promise<{ node: RepNode; created: boolean } | null> {
  const parent = parentId === ROOT ? rootParent : await db.repnodes.get(parentId).then((n) => (n ? asParent(n) : null));
  if (!parent) return null;
  const tree = await loadTree(repId);
  const node = extend(tree, repId, parent, { from, to, promotion });
  if (!node) return null;
  const created = tree.created.includes(node);
  await commit(tree);
  if (created) await syncCards(repId);
  return { node, created };
}

export async function setComment(nodeId: string, comment: string) {
  const node = await db.repnodes.get(nodeId);
  if (!node) return;
  const text = comment.trim();
  if (text) node.comment = text;
  else delete node.comment;
  await db.repnodes.put(node);
  await syncCards(node.repId);
}

/** Supprime un coup et toutes ses suites. */
export async function deleteNode(nodeId: string) {
  const node = await db.repnodes.get(nodeId);
  if (!node) return;
  const nodes = await loadNodes(node.repId);
  const kids = new Map<string, RepNode[]>();
  for (const n of nodes) kids.set(n.parentId, [...(kids.get(n.parentId) ?? []), n]);
  const ids: string[] = [];
  const stack = [node];
  while (stack.length) {
    const n = stack.pop()!;
    ids.push(n.id);
    stack.push(...(kids.get(n.id) ?? []));
  }
  await db.repnodes.bulkDelete(ids);
  await syncCards(node.repId);
}

export interface ImportSummary {
  games: number;
  added: number;
  skipped: number;
}

/** Fusionne un PGN (variantes comprises) dans le répertoire. */
export async function importPgn(repId: string, text: string): Promise<ImportSummary> {
  const games = parsePgn(text);
  if (!games.length) throw new Error('Aucune partie trouvée dans ce PGN');
  const tree = await loadTree(repId);
  let skipped = 0;

  const walk = (parent: Parent, children: PgnNode[]) => {
    for (const child of children) {
      const node = extend(tree, repId, parent, { san: child.san });
      if (!node) {
        skipped++;
        continue; // coup illégal : on ignore cette branche
      }
      if (child.comment && !node.comment) {
        node.comment = child.comment;
        tree.dirty.add(node);
      }
      walk(asParent(node), child.children);
    }
  };
  for (const g of games) walk(rootParent, g.root);

  const added = tree.created.length;
  await commit(tree);
  await syncCards(repId);
  return { games: games.length, added, skipped };
}

// ---------- Cartes ----------

/**
 * Une carte par position où c'est à toi de jouer : coup principal + variantes acceptées.
 * Les cartes existantes gardent leur planification FSRS ; celles dont le coup a disparu sont supprimées.
 */
export async function syncCards(repId: string) {
  const rep = await db.repertoires.get(repId);
  if (!rep) return;
  const nodes = await loadNodes(repId);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const pathTo = (id: string): RepNode[] => {
    const path: RepNode[] = [];
    for (let n = byId.get(id); n; n = byId.get(n.parentId)) path.unshift(n);
    return path;
  };

  const groups = new Map<string, RepNode[]>();
  for (const n of nodes) {
    if ((n.ply % 2 === 1) !== (rep.color === 'white')) continue;
    const key = posKey(n.fenBefore);
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }

  const decks = openingDecks(rep.name);
  const wanted = new Map<string, NewCardInput & { id: string }>();
  for (const group of groups.values()) {
    const main = group[0];
    const id = cardIdFor(repId, main.fenBefore);
    wanted.set(id, {
      id,
      type: 'opening',
      title: rep.name,
      fen: main.fenBefore,
      solution: [main.uci],
      alts: [...new Set(group.slice(1).map((n) => n.uci))].filter((u) => u !== main.uci),
      tags: [rep.color === 'white' ? 'blancs' : 'noirs'],
      lastMove: byId.get(main.parentId)?.uci,
      line: formatLine(pathTo(main.parentId)),
      note: main.comment,
      repId,
      source: 'repertoire',
      deck: decks.singles,
    });
  }

  await db.transaction('rw', db.cards, async () => {
    const all = await db.cards.where('repId').equals(repId).toArray();
    const existing = new Map(all.filter((c) => !c.lineMode).map((c) => [c.id, c]));
    // Cartes-lignes : supprimées si leur dernier coup a disparu, sinon rangées sous le bon paquet.
    const lines = all.filter((c) => c.lineMode);
    const deadLines = lines.filter((c) => !c.lineEnd || !byId.has(c.lineEnd)).map((c) => c.id);
    if (deadLines.length) await db.cards.bulkDelete(deadLines);
    await db.cards.bulkPut(lines.filter((c) => !deadLines.includes(c.id)).map((c) => ({ ...c, deck: decks.lines })));
    const now = Date.now();
    const toPut: StoredCard[] = [];
    for (const [id, input] of wanted) {
      const old = existing.get(id);
      if (old) {
        toPut.push({ ...old, ...input, note: input.note, alts: input.alts, lastMove: input.lastMove });
      } else {
        const card = makeCard(input);
        card.createdAt = now + groups.get(posKey(input.fen))![0].seq;
        toPut.push(card);
      }
    }
    await db.cards.bulkPut(toPut);
    const stale = [...existing.keys()].filter((id) => !wanted.has(id));
    if (stale.length) await db.cards.bulkDelete(stale);
  });
}

// ---------- Liste ----------

export interface RepertoireSummary {
  rep: Repertoire;
  moves: number;
  cards: number;
  due: number;
}

export async function listRepertoires(): Promise<RepertoireSummary[]> {
  const reps = await db.repertoires.orderBy('createdAt').toArray();
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return Promise.all(
    reps.map(async (rep) => {
      const cards = await db.cards.where('repId').equals(rep.id).toArray();
      return {
        rep,
        moves: await db.repnodes.where('repId').equals(rep.id).count(),
        cards: cards.length,
        due: cards.filter((c) => c.state !== State.New && c.due <= end.getTime()).length,
      };
    }),
  );
}

// ---------- Entraînement ----------

/**
 * Met à jour la carte FSRS de la position jouée pendant l'entraînement.
 * Une erreur compte toujours (Again). Une réussite n'est comptée que si la carte est nouvelle, en
 * apprentissage et échue, ou à revoir aujourd'hui : rejouer la même ligne ne gonfle pas les intervalles.
 */
export async function recordTraining(repId: string, node: RepNode, outcome: 'good' | 'hint' | 'wrong') {
  const card = await db.cards.get(cardIdFor(repId, node.fenBefore));
  if (!card) return;
  if (outcome === 'wrong') return applyReview(card, 'again', { durationMs: 0, correct: false });
  const now = Date.now();
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const counts =
    card.state === State.New ||
    (card.state === State.Review && card.due <= endOfDay.getTime()) ||
    (card.state !== State.Review && card.due <= now);
  if (counts) {
    await applyReview(card, outcome === 'hint' ? 'hard' : 'good', { durationMs: 0, correct: true });
  }
}

export async function renameRepertoire(repId: string, name: string) {
  const clean = name.trim();
  if (!clean) return;
  await db.repertoires.update(repId, { name: clean });
  await syncCards(repId);
}

// ---------- Cartes-lignes (suites de coups) ----------

type LineCard = NewCardInput & { id: string };

/** Carte-ligne finissant sur ton dernier coup du chemin menant à `end` (null si moins de 2 de tes coups). */
function buildLineCard(rep: Repertoire, byId: Map<string, RepNode>, end: RepNode): LineCard | null {
  const mine = (n: RepNode) => (n.ply % 2 === 1) === (rep.color === 'white');
  let path: RepNode[] = [];
  for (let n: RepNode | undefined = end; n; n = byId.get(n.parentId)) path.unshift(n);
  while (path.length && !mine(path[path.length - 1])) path = path.slice(0, -1);
  // Noirs : le premier coup (blanc) sert de point de départ, il n'est pas à jouer.
  const prefix = path.length && !mine(path[0]) ? [path[0]] : [];
  const played = path.slice(prefix.length);
  const userMoves = played.filter(mine).length;
  if (userMoves < 2) return null;
  const last = played[played.length - 1];
  return {
    id: `line:${rep.id}:${last.id}`,
    type: 'opening',
    title: `${rep.name} · ligne de ${userMoves} coups`,
    fen: prefix.length ? prefix[0].fenAfter : START_FEN,
    solution: played.map((n) => n.uci),
    tags: [rep.color === 'white' ? 'blancs' : 'noirs'],
    lastMove: prefix[0]?.uci,
    line: prefix.length ? formatLine(prefix) : '',
    repId: rep.id,
    source: 'repertoire',
    lineMode: true,
    lineEnd: last.id,
    deck: openingDecks(rep.name).lines,
  };
}

/** Carte-ligne depuis le début de l'arbre jusqu'au coup `endId`. */
export async function createLineCard(repId: string, endId: string): Promise<'created' | 'exists' | 'short'> {
  const rep = await db.repertoires.get(repId);
  const nodes = await loadNodes(repId);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const end = byId.get(endId);
  if (!rep || !end) return 'short';
  const card = buildLineCard(rep, byId, end);
  if (!card) return 'short';
  if (await db.cards.get(card.id)) return 'exists';
  await db.cards.add(makeCard(card));
  return 'created';
}

/** Une carte-ligne par ligne complète (jusqu'aux extrémités de l'arbre). */
export async function createAllLineCards(repId: string): Promise<{ created: number; existing: number; skipped: number }> {
  const rep = await db.repertoires.get(repId);
  const nodes = await loadNodes(repId);
  if (!rep) return { created: 0, existing: 0, skipped: 0 };
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parents = new Set(nodes.map((n) => n.parentId));
  const wanted = new Map<string, LineCard>();
  let skipped = 0;
  for (const leaf of nodes.filter((n) => !parents.has(n.id))) {
    const card = buildLineCard(rep, byId, leaf);
    if (card) wanted.set(card.id, card);
    else skipped++;
  }
  const have = new Set((await db.cards.bulkGet([...wanted.keys()])).filter(Boolean).map((c) => c!.id));
  const fresh = [...wanted.values()].filter((c) => !have.has(c.id));
  const now = Date.now();
  await db.cards.bulkAdd(fresh.map((c, i) => ({ ...makeCard(c), createdAt: now + i })));
  return { created: fresh.length, existing: wanted.size - fresh.length, skipped };
}
