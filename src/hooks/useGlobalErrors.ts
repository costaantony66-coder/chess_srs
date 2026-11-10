import { useEffect, useState } from 'react';
import { recordError } from '../lib/diagnostics';

/** Erreurs sans importance (bruits connus des navigateurs) : on ne dérange pas l'utilisateur. */
const BENIGN = /ResizeObserver loop|AbortError|Script error|The user aborted|Load failed|Failed to fetch/i;

/** Erreurs inattendues hors affichage (promesses rejetées, erreurs d'événements) : message discret, jamais d'écran blanc. */
export function useGlobalErrors() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const handle = (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      if (BENIGN.test(msg)) return;
      recordError(e);
      setMessage(msg);
    };
    const onError = (ev: ErrorEvent) => handle(ev.error ?? ev.message);
    const onRejection = (ev: PromiseRejectionEvent) => handle(ev.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return { message, clear: () => setMessage(null) };
}
