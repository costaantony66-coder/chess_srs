import { describe, expect, it } from 'vitest';
import { ALL_SQUARES, accuracy, durationLabel, isDarkSquare, nextTarget, typedSquare, weightsFromStats } from './coords';

describe('coordonnées', () => {
  it('64 cases, de a1 à h8', () => {
    expect(ALL_SQUARES).toHaveLength(64);
    expect(ALL_SQUARES[0]).toBe('a1');
    expect(ALL_SQUARES[7]).toBe('h1');
    expect(ALL_SQUARES[63]).toBe('h8');
    expect(new Set(ALL_SQUARES).size).toBe(64);
  });

  it('couleurs des cases : a1 sombre, h1 claire, a8 claire, h8 sombre', () => {
    expect(isDarkSquare('a1')).toBe(true);
    expect(isDarkSquare('h1')).toBe(false);
    expect(isDarkSquare('a8')).toBe(false);
    expect(isDarkSquare('h8')).toBe(true);
    expect(isDarkSquare('e4')).toBe(false);
  });

  it('ne tire jamais deux fois la même case d’affilée', () => {
    for (let i = 0; i < 200; i++) expect(nextTarget('e4')).not.toBe('e4');
    expect(nextTarget(null, () => 0)).toBe('a1');
    expect(nextTarget('a1', () => 0)).toBe('b1');
    expect(nextTarget(null, () => 0.999999)).toBe('h8');
  });

  it('insiste sur les cases ratées quand on le demande', () => {
    const w = weightsFromStats({ f7: { ok: 0, ko: 8 }, a1: { ok: 10, ko: 0 } });
    expect(w.f7).toBeGreaterThan(6);
    expect(w.a1).toBe(1);
    expect(w.e4).toBe(1); // jamais vue
    // avec un tirage tout à la fin de la plage, on tombe sur la case lourde plutôt que la dernière du tableau
    const counts: Record<string, number> = {};
    let seed = 0;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 3000; i++) {
      const t = nextTarget(null, rnd, w);
      counts[t] = (counts[t] ?? 0) + 1;
    }
    expect(counts.f7).toBeGreaterThan(counts.e4 * 4);
  });

  it('saisie au clavier : lettre puis chiffre', () => {
    expect(typedSquare(null, 'f')).toEqual({ pending: 'f' });
    expect(typedSquare('f', '7')).toEqual({ pending: null, square: 'f7' });
    expect(typedSquare('f', 'G')).toEqual({ pending: 'g' }); // la nouvelle lettre remplace l'ancienne
    expect(typedSquare(null, '7')).toEqual({ pending: null }); // chiffre sans lettre : ignoré
    expect(typedSquare('f', 'Enter')).toEqual({ pending: 'f' });
    expect(typedSquare('f', '9')).toEqual({ pending: 'f' });
  });

  it('précision et libellés de durée', () => {
    expect(accuracy(0, 0)).toBe(0);
    expect(accuracy(18, 2)).toBe(90);
    expect(durationLabel(30)).toBe('30 s');
    expect(durationLabel(120)).toBe('2 min');
  });
});
