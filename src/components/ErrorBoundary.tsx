import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { exportData } from '../db/backup';
import { buildDiagnostics, recordError } from '../lib/diagnostics';

function Fallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const btn = 'min-h-11 rounded-xl bg-surface-2 px-4 text-sm font-medium text-fg transition active:scale-95';

  const save = async () => {
    try {
      await exportData();
      setMsg('Sauvegarde téléchargée : tes données sont en sécurité.');
    } catch {
      setMsg('La sauvegarde a échoué. Recharge la page puis réessaie.');
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(await buildDiagnostics());
      setMsg('Détails copiés : colle-les dans ton message.');
    } catch {
      setMsg('Copie impossible : sélectionne le texte ci-dessous.');
    }
  };

  return (
    <div role="alert" className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="font-display text-2xl">Oups, quelque chose s’est mal passé</h1>
      <p className="text-sm leading-relaxed text-muted">
        L’application a rencontré une erreur inattendue. <strong className="text-fg">Tes données ne sont pas perdues</strong> : elles sont toujours sur cet appareil.
        Tu peux d’abord les sauvegarder, puis réessayer.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button className={`${btn} col-span-2 bg-accent text-accent-fg`} onClick={() => void save()}>
          Exporter mes données
        </button>
        <button className={btn} onClick={onRetry}>
          Réessayer
        </button>
        <button className={btn} onClick={() => location.reload()}>
          Recharger la page
        </button>
        <button className={`${btn} col-span-2`} onClick={() => void copy()}>
          Copier les détails techniques
        </button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
      <pre className="max-h-32 overflow-auto rounded-xl bg-surface-2 p-3 text-xs text-muted">{error.message}</pre>
    </div>
  );
}

/** Écran de secours : une erreur d'affichage n'efface pas l'application, elle propose de sauvegarder et de réessayer. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordError(error, info.componentStack?.split('\n').slice(0, 6).join('\n'));
  }

  render() {
    return this.state.error ? <Fallback error={this.state.error} onRetry={() => this.setState({ error: null })} /> : this.props.children;
  }
}
