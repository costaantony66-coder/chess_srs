import { db } from '../db/db';

const KEY = 'lastError';

export interface RecordedError {
  message: string;
  stack?: string;
  at: string;
  extra?: string;
}

/** Garde la dernière erreur pour pouvoir la copier dans un rapport de diagnostic. */
export function recordError(error: unknown, extra?: string) {
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    const rec: RecordedError = { message: e.message, stack: e.stack?.split('\n').slice(0, 8).join('\n'), at: new Date().toISOString(), extra };
    localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* stockage indisponible */
  }
}

export function getLastError(): RecordedError | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecordedError) : null;
  } catch {
    return null;
  }
}

/** Texte à coller dans un message pour décrire un problème (aucune donnée personnelle de jeu). */
export async function buildDiagnostics(): Promise<string> {
  let counts = 'indisponible';
  try {
    const [cards, reviews, games, reps] = await Promise.all([db.cards.count(), db.reviews.count(), db.games.count(), db.repertoires.count()]);
    counts = `${cards} cartes, ${reviews} révisions, ${games} parties, ${reps} répertoires`;
  } catch {
    /* base illisible */
  }
  const last = getLastError();
  return [
    `Chess SRS ${__APP_VERSION__}`,
    `Date : ${new Date().toISOString()}`,
    `Navigateur : ${typeof navigator !== 'undefined' ? navigator.userAgent : 'inconnu'}`,
    `Données : ${counts}`,
    last ? `Dernière erreur (${last.at}) : ${last.message}\n${last.stack ?? ''}${last.extra ? `\n${last.extra}` : ''}` : 'Aucune erreur enregistrée',
  ].join('\n');
}
