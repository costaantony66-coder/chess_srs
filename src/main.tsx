import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerServiceWorker } from './pwa';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Le jeton Lichess de l'ancienne « source externe » n'est plus utilisé : on l'efface.
try {
  localStorage.removeItem('lichessToken');
} catch {
  /* stockage indisponible */
}

registerServiceWorker();
