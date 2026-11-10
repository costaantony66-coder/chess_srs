// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chess } from 'chess.js';
import type { UciTransport } from '../../lib/engine';

/** Dernières propriétés reçues par l'échiquier (simulé). */
const board: { props: Record<string, any> } = { props: {} };

vi.mock('../../components/board/Board', () => ({
  Board: (props: Record<string, unknown>) => {
    board.props = props;
    return null;
  },
}));

/** Faux Stockfish : répond au premier coup légal de la position reçue. */
vi.mock('../../lib/engine', async (orig) => {
  const real = await orig<typeof import('../../lib/engine')>();
  return {
    ...real,
    stockfishWorker: (): UciTransport => {
      let cb: (l: string) => void = () => {};
      let fen = '';
      return {
        onLine: (f) => (cb = f),
        terminate: () => {},
        send: (cmd) => {
          queueMicrotask(() => {
            if (cmd === 'uci') cb('uciok');
            else if (cmd === 'isready') cb('readyok');
            else if (cmd.startsWith('position fen ')) fen = cmd.slice('position fen '.length);
            else if (cmd.startsWith('go')) {
              const m = new Chess(fen).moves({ verbose: true })[0];
              cb(`bestmove ${m.from}${m.to}${m.promotion ?? ''}`);
            }
          });
        },
      };
    },
  };
});

vi.mock('../../db/games', () => ({ saveParsedGames: vi.fn(async () => ({ games: 1, newGames: 1, cards: 0, unanalysed: 1 })) }));

import { BotGame } from './BotGame';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const startAs = async (colorLabel: string) => {
  render(<BotGame />);
  fireEvent.click(screen.getByText(colorLabel));
  await act(async () => {
    fireEvent.click(screen.getByText('Commencer la partie'));
  });
};

describe('partie contre le bot', () => {
  it('blancs : tu peux jouer tout de suite, puis le bot répond', async () => {
    await startAs('Blancs');
    await waitFor(() => expect(board.props.viewOnly).toBe(false));
    expect(board.props.orientation).toBe('white');
    await act(async () => board.props.onMove('e2', 'e4'));
    await waitFor(() => expect(new Chess(board.props.fen).history().length).toBe(0)); // fen seulement
    await waitFor(() => expect(board.props.viewOnly).toBe(false), { timeout: 3000 });
    expect(new Chess(board.props.fen).turn()).toBe('w'); // le bot a répondu, c'est de nouveau à toi
  });

  it('noirs : le bot joue le premier coup, puis tu peux déplacer une pièce noire', async () => {
    await startAs('Noirs');
    expect(board.props.orientation).toBe('black');
    // le bot (blancs) joue en premier
    await waitFor(() => expect(new Chess(board.props.fen).turn()).toBe('b'), { timeout: 3000 });
    // c'est à toi : l'échiquier doit être jouable
    await waitFor(() => expect(board.props.viewOnly).toBe(false), { timeout: 3000 });
    await act(async () => board.props.onMove('e7', 'e6'));
    // le coup est joué (e6) puis le bot (blancs) répond : retour à ton tour
    await waitFor(() => expect(new Chess(board.props.fen).get('e6')?.type).toBe('p'), { timeout: 3000 });
    await waitFor(() => expect(new Chess(board.props.fen).turn()).toBe('b'), { timeout: 3000 });
    await waitFor(() => expect(board.props.viewOnly).toBe(false), { timeout: 3000 });
  });
});
