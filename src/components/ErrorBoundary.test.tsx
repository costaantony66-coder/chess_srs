// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const exportData = vi.fn(async () => undefined);
vi.mock('../db/backup', () => ({ exportData: () => exportData() }));
vi.mock('../lib/diagnostics', () => ({ recordError: vi.fn(), buildDiagnostics: vi.fn(async () => 'DIAG') }));

import { ErrorBoundary } from './ErrorBoundary';

let shouldThrow = true;
function Bomb() {
  if (shouldThrow) throw new Error('boum de test');
  return <p>Tout va bien</p>;
}

beforeEach(() => {
  shouldThrow = true;
  exportData.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('écran de secours', () => {
  it('remplace l’écran blanc par un message clair et propose d’exporter les données', async () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Tes données ne sont pas perdues/)).toBeTruthy();
    expect(screen.getByText('boum de test')).toBeTruthy();
    fireEvent.click(screen.getByText('Exporter mes données'));
    await waitFor(() => expect(exportData).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/Sauvegarde téléchargée/)).toBeTruthy());
  });

  it('« Réessayer » ré-affiche l’application une fois le problème disparu', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    shouldThrow = false;
    fireEvent.click(screen.getByText('Réessayer'));
    expect(screen.getByText('Tout va bien')).toBeTruthy();
  });
});
