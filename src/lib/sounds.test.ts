// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { playSound, setSoundsEnabled, soundForSan, soundsEnabled } from './sounds';

beforeEach(() => localStorage.clear());

describe('sons', () => {
  it('choisit le son d’après le coup', () => {
    expect(soundForSan('e4')).toBe('move');
    expect(soundForSan('Nxe5')).toBe('capture');
    expect(soundForSan('Qh5+')).toBe('check');
    expect(soundForSan('Qxf7#')).toBe('check');
  });

  it('activés par défaut, désactivables, et jamais bloquants si l’audio est absent', () => {
    expect(soundsEnabled()).toBe(true);
    setSoundsEnabled(false);
    expect(soundsEnabled()).toBe(false);
    expect(() => playSound('move')).not.toThrow();
    setSoundsEnabled(true);
    expect(() => playSound('error')).not.toThrow(); // jsdom n'a pas d'AudioContext
  });

  it('crée bien des sons quand l’audio est disponible', () => {
    const osc = { type: '', frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    const gain = { gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
    const node = { connect: vi.fn(() => gain) };
    osc.connect = vi.fn(() => gain) as never;
    const ctxMock = {
      state: 'running',
      currentTime: 0,
      sampleRate: 8000,
      destination: {},
      createOscillator: vi.fn(() => osc),
      createGain: vi.fn(() => gain),
      createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(640) })),
      createBufferSource: vi.fn(() => ({ buffer: null, connect: vi.fn(() => node), start: vi.fn() })),
      createBiquadFilter: vi.fn(() => ({ type: '', frequency: { value: 0 }, connect: vi.fn(() => gain) })),
    };
    gain.connect = vi.fn(() => ({})) as never;
    (window as unknown as { AudioContext: unknown }).AudioContext = function AudioContextMock() {
      return ctxMock;
    };
    playSound('success');
    expect(ctxMock.createOscillator).toHaveBeenCalledTimes(3);
    setSoundsEnabled(false);
    ctxMock.createOscillator.mockClear();
    playSound('success');
    expect(ctxMock.createOscillator).not.toHaveBeenCalled();
  });
});
