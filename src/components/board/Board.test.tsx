// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Board } from './Board';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E3 = 'rnbqkbnr/pppppppp/8/8/8/4P3/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

type Listener = [EventTarget, string];
let listeners: Listener[] = [];
const realAdd = EventTarget.prototype.addEventListener;

beforeEach(() => {
  listeners = [];
  EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: [EventListenerOrEventListenerObject | null, (AddEventListenerOptions | boolean)?]) {
    listeners.push([this, type]);
    return realAdd.call(this, type, ...(rest as [EventListenerOrEventListenerObject]));
  } as typeof realAdd;
});
afterEach(() => {
  EventTarget.prototype.addEventListener = realAdd;
  cleanup();
});

const hasClicks = (container: HTMLElement) => {
  const board = container.querySelector('cg-board');
  return !!board && listeners.some(([el, type]) => el === board && type === 'mousedown');
};

describe('Board', () => {
  it('reste cliquable quand l’orientation change pendant qu’il est en lecture seule (jouer les noirs contre le bot)', () => {
    const { container, rerender } = render(<Board fen={START} orientation="white" viewOnly />);
    rerender(<Board fen={START} orientation="black" viewOnly />); // la partie démarre, aux blancs de jouer
    rerender(<Board fen={AFTER_E3} orientation="black" />); // le bot a joué : à toi
    expect(hasClicks(container)).toBe(true);
  });

  it('reste cliquable après un changement d’orientation à l’état normal', () => {
    const { container, rerender } = render(<Board fen={START} orientation="white" />);
    rerender(<Board fen={START} orientation="black" />);
    expect(hasClicks(container)).toBe(true);
  });
});
