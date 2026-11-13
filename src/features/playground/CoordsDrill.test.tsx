// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const saveDrill = vi.fn(async (_run: unknown) => 1);
let best: Record<number, number> = {};
vi.mock('../../db/drills', () => ({
  saveDrill: (r: unknown) => saveDrill(r),
  getBestByDuration: async () => best,
  getSquareStats: async () => ({}),
}));
vi.mock('../../lib/sounds', () => ({ playSound: vi.fn(), vibrate: vi.fn() }));

import { CoordsDrill } from './CoordsDrill';

beforeEach(() => {
  localStorage.clear();
  best = {};
  saveDrill.mockClear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.spyOn(Math, 'random').mockReturnValue(0); // première case : a1, puis b1, c1…
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const cell = (container: HTMLElement, sq: string) => container.querySelector(`[data-square="${sq}"]`) as HTMLElement;

/** Lance une manche de 30 s et attend la fin du décompte. */
async function startRun() {
  const utils = render(<CoordsDrill />);
  fireEvent.click(screen.getByText('30 s'));
  await act(async () => void fireEvent.click(screen.getByText('Commencer')));
  for (let i = 0; i < 3; i++) await advance(1000); // une seconde à la fois : React enchaîne le décompte entre deux `act`
  return utils;
}

describe('entraînement aux coordonnées', () => {
  it('compte les bonnes réponses et enchaîne les cases', async () => {
    const { container } = await startRun();
    expect(screen.getByTestId('target').textContent).toBe('a1');
    expect(screen.getByTestId('time').textContent).toBe('30');
    await act(async () => void fireEvent.click(cell(container, 'a1')));
    expect(screen.getByTestId('correct').textContent).toBe('1');
    expect(screen.getByTestId('target').textContent).toBe('b1'); // jamais deux fois la même d'affilée
    await act(async () => void fireEvent.click(cell(container, 'b1')));
    expect(screen.getByTestId('correct').textContent).toBe('2');
  });

  it('une erreur coûte 3 secondes, garde la même case et casse la série', async () => {
    const { container } = await startRun();
    await act(async () => void fireEvent.click(cell(container, 'a1')));
    await act(async () => void fireEvent.click(cell(container, 'h8'))); // la cible est b1
    expect(screen.getByTestId('errors').textContent).toBe('1');
    expect(screen.getByTestId('time').textContent).toBe('27');
    expect(screen.getByTestId('target').textContent).toBe('b1');
    expect(screen.getByTestId('correct').textContent).toBe('1');
  });

  it('à la fin du chrono : score affiché, manche enregistrée avec les cases ratées', async () => {
    const { container } = await startRun();
    await act(async () => void fireEvent.click(cell(container, 'a1')));
    await act(async () => void fireEvent.click(cell(container, 'h8')));
    await advance(27_500);
    expect(screen.getByTestId('final-score').textContent).toContain('1');
    expect(saveDrill).toHaveBeenCalledTimes(1);
    const run = saveDrill.mock.calls[0][0] as Record<string, unknown>;
    expect(run).toMatchObject({ kind: 'coords', durationSec: 30, orientation: 'white', correct: 1, errors: 1, ok: { a1: 1 }, ko: { b1: 1 } });
    expect(screen.getByText(/Premier score enregistré/)).toBeTruthy();
    expect(screen.getByText(/précision/)).toBeTruthy();
  });

  it('plusieurs erreurs peuvent vider le chrono : la manche se termine d’elle-même', async () => {
    const { container } = await startRun();
    await advance(21_000); // 9 s restantes
    for (let i = 0; i < 3; i++) await act(async () => void fireEvent.click(cell(container, 'h8')));
    expect(saveDrill).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('final-score').textContent).toContain('0');
  });

  it('on peut taper la case au clavier', async () => {
    await startRun();
    await act(async () => {
      fireEvent.keyDown(window, { key: 'a' });
      fireEvent.keyDown(window, { key: '1' });
    });
    expect(screen.getByTestId('correct').textContent).toBe('1');
  });

  it('« Arrêter » n’enregistre rien', async () => {
    const { container } = await startRun();
    await act(async () => void fireEvent.click(cell(container, 'a1')));
    await act(async () => void fireEvent.click(screen.getByText(/Arrêter/)));
    await advance(40_000);
    expect(saveDrill).not.toHaveBeenCalled();
    expect(screen.getByText('Retrouve les cases')).toBeTruthy();
  });

  it('affiche les records par durée sur l’écran de départ', async () => {
    best = { 60: 42 };
    render(<CoordsDrill />);
    await advance(0);
    expect(screen.getByText('Record 42')).toBeTruthy();
  });
});
