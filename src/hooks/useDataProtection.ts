import { useEffect } from 'react';
import { runAutoBackup } from '../db/autobackup';
import { hasData } from '../db/backup';
import { getFirstSeenAt } from '../lib/backupReminder';
import { requestPersistence } from '../lib/storage';

/**
 * Au démarrage : demande le stockage persistant (s'il y a des données) et lance la sauvegarde automatique du jour.
 * Ensuite : sauvegarde quand l'onglet passe en arrière-plan, puis toutes les 30 minutes.
 */
export function useDataProtection() {
  useEffect(() => {
    getFirstSeenAt();
    const auto = () => void runAutoBackup().catch(() => undefined);
    void (async () => {
      if (await hasData()) await requestPersistence();
      auto();
    })();
    const onHide = () => document.visibilityState === 'hidden' && auto();
    document.addEventListener('visibilitychange', onHide);
    const id = window.setInterval(auto, 30 * 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.clearInterval(id);
    };
  }, []);
}
