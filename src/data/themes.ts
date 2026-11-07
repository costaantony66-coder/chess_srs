import themes from './themes.json';

export interface Theme {
  key: string;
  label: string;
  group: string;
}

export const THEMES: Theme[] = themes;

const EXTRA: Record<string, string> = { opening: 'Ouverture', middlegame: 'Milieu de partie' };
const LABELS = new Map<string, string>([...THEMES.map((t) => [t.key, t.label] as const), ...Object.entries(EXTRA)]);

export const themeLabel = (key: string) => LABELS.get(key) ?? key;
export const isKnownTheme = (key: string) => LABELS.has(key);
