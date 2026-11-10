import { State } from 'ts-fsrs';
import { db } from './db';
import { bucketOf, endOfDay, startOfDay } from './queue';
import { DECK_SEP, openingDecks, prefixes, topLevel } from '../lib/decks';
import { getNewPerDay } from '../lib/settings';

export interface DeckNode {
  name: string;
  path: string;
  children: DeckNode[];
  total: number;
  new: number;
  learning: number;
  review: number;
}

export interface Budget {
  limit: number;
  /** Nouvelles cartes déjà vues aujourd'hui dans cette catégorie. */
  done: number;
  left: number;
}

export interface DeckTree {
  roots: DeckNode[];
  all: { total: number; new: number; learning: number; review: number };
  /** Budget quotidien de nouvelles cartes de chaque catégorie (Ouvertures, Puzzles…). */
  budgets: Record<string, Budget>;
}

const TOP_ORDER = ['Ouvertures', 'Puzzles', 'Parties', 'Finales', 'Démo'];

const sortNodes = (nodes: DeckNode[], top: boolean) => {
  nodes.sort((a, b) => {
    if (top) {
      const ia = TOP_ORDER.indexOf(a.name);
      const ib = TOP_ORDER.indexOf(b.name);
      if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    }
    return a.name.localeCompare(b.name, 'fr');
  });
  nodes.forEach((n) => sortNodes(n.children, false));
};

/** Arbre des paquets avec les compteurs façon Anki (le plafond de nouvelles est un budget par catégorie). */
export async function loadDeckTree(now = new Date()): Promise<DeckTree> {
  const nowMs = now.getTime();
  const endMs = endOfDay(now).getTime();
  const [cards, reps, today] = await Promise.all([
    db.cards.toArray(),
    db.repertoires.toArray(),
    db.reviews.where('ts').aboveOrEqual(startOfDay(now).getTime()).toArray(),
  ]);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const limit = getNewPerDay();

  const nodes = new Map<string, DeckNode>();
  const rawNew = new Map<string, number>();
  const doneNew = new Map<string, number>(); // par catégorie de premier niveau
  const roots: DeckNode[] = [];

  const node = (path: string): DeckNode => {
    let n = nodes.get(path);
    if (!n) {
      n = { name: path.split(DECK_SEP).pop()!, path, children: [], total: 0, new: 0, learning: 0, review: 0 };
      nodes.set(path, n);
      const parent = path.includes(DECK_SEP) ? node(path.slice(0, path.lastIndexOf(DECK_SEP))) : null;
      (parent ? parent.children : roots).push(n);
    }
    return n;
  };

  for (const c of cards) {
    const bucket = bucketOf(c, nowMs, endMs);
    for (const p of prefixes(c.deck)) {
      const n = node(p);
      n.total++;
      if (bucket === 'new') rawNew.set(p, (rawNew.get(p) ?? 0) + 1);
      else if (bucket === 'learning') n.learning++;
      else if (bucket === 'review') n.review++;
    }
  }
  // Chaque ouverture affiche toujours « Coups seuls » et « Lignes », même vides.
  for (const rep of reps) {
    const d = openingDecks(rep.name);
    node(d.singles);
    node(d.lines);
  }
  for (const r of today) {
    const c = byId.get(r.cardId);
    if (!c || r.prevState !== State.New) continue;
    doneNew.set(topLevel(c.deck), (doneNew.get(topLevel(c.deck)) ?? 0) + 1);
  }
  const left = (top: string) => Math.max(0, limit - (doneNew.get(top) ?? 0));
  for (const [path, n] of nodes) n.new = Math.min(rawNew.get(path) ?? 0, left(topLevel(path)));
  sortNodes(roots, true);

  let learning = 0;
  let review = 0;
  for (const c of cards) {
    const b = bucketOf(c, nowMs, endMs);
    if (b === 'learning') learning++;
    else if (b === 'review') review++;
  }
  const budgets: Record<string, Budget> = {};
  for (const root of roots) budgets[root.name] = { limit, done: doneNew.get(root.name) ?? 0, left: left(root.name) };
  const newAll = roots.reduce((n, r) => n + r.new, 0);
  return { roots, all: { total: cards.length, new: newAll, learning, review }, budgets };
}
