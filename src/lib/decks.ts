/** Chemins de paquets façon Anki : "Ouvertures::Système de Londres::Lignes". */
export const DECK_SEP = '::';

const clean = (s: string) => s.replaceAll(DECK_SEP, ':').trim() || 'Sans nom';
export const deckPath = (...parts: string[]) => parts.map(clean).join(DECK_SEP);

export const SOURCE_LABEL: Record<string, string> = { lichess: 'Lichess', chesscom: 'Chess.com', pgn: 'PGN' };

/** La carte appartient-elle au paquet (ou à l'un de ses sous-paquets) ? */
export const inDeck = (cardDeck: string | undefined, scope: string) =>
  cardDeck === scope || !!cardDeck?.startsWith(scope + DECK_SEP);

/** 'A::B::C' → ['A', 'A::B', 'A::B::C'] */
export function prefixes(path: string): string[] {
  const parts = path.split(DECK_SEP);
  return parts.map((_, i) => parts.slice(0, i + 1).join(DECK_SEP));
}

export function defaultDeck(card: { type: string }): string {
  switch (card.type) {
    case 'tactic':
      return 'Puzzles::Divers';
    case 'opening':
      return 'Ouvertures::Divers';
    case 'endgame':
      return 'Finales';
    case 'mistake':
      return 'Parties::Divers';
    default:
      return 'Divers';
  }
}

/** Range une carte créée avant les paquets (migration et anciens exports). */
export function legacyDeck(
  card: { id: string; type: string; source?: string; title: string },
  ctx: { repName?: string; gameSource?: string } = {},
): string {
  if (card.id.startsWith('demo-')) return 'Démo';
  if (card.source === 'repertoire') return deckPath('Ouvertures', ctx.repName ?? 'Divers');
  if (card.source === 'lichess') {
    const m = /^Puzzle · (.+)$/.exec(card.title);
    return deckPath('Puzzles', m?.[1] ?? 'Divers');
  }
  if (card.source === 'game') return deckPath('Parties', ctx.gameSource ? (SOURCE_LABEL[ctx.gameSource] ?? ctx.gameSource) : 'Divers');
  return defaultDeck(card);
}
