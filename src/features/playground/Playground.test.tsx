// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Playground } from './Playground';

afterEach(cleanup);

describe('onglet Plateau', () => {
  it('propose trois modes : deux côtés, contre un bot, positions', () => {
    render(<Playground />);
    expect(screen.getByText('Deux côtés')).toBeTruthy();
    expect(screen.getByText('Contre un bot')).toBeTruthy();
    expect(screen.getByText('Positions')).toBeTruthy();
    expect(screen.getByText(/Joue un coup sur l’échiquier/)).toBeTruthy(); // mode par défaut
  });

  it('« Positions » ouvre l’entraînement aux coordonnées avec les 4 durées', () => {
    render(<Playground />);
    fireEvent.click(screen.getByText('Positions'));
    expect(screen.getByText('Retrouve les cases')).toBeTruthy();
    for (const d of ['30 s', '1 min', '2 min', '3 min']) expect(screen.getByText(d)).toBeTruthy();
    expect(screen.getByText(/Chaque erreur te coûte 3 secondes/)).toBeTruthy();
  });
});
