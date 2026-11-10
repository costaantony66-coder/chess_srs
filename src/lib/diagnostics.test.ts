// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDiagnostics, getLastError, recordError } from './diagnostics';

vi.stubGlobal('__APP_VERSION__', '9.9.9');
beforeEach(() => localStorage.clear());

describe('diagnostic', () => {
  it('garde la dernière erreur et la restitue dans le rapport', async () => {
    expect(getLastError()).toBeNull();
    recordError(new Error('quelque chose a cassé'), 'Composant X');
    expect(getLastError()?.message).toBe('quelque chose a cassé');
    const text = await buildDiagnostics();
    expect(text).toContain('Chess SRS 9.9.9');
    expect(text).toContain('quelque chose a cassé');
    expect(text).toContain('Composant X');
    expect(text).toMatch(/0 cartes, 0 révisions/);
  });
});
