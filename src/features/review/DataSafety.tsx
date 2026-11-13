import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FolderCheck, ShieldCheck, ShieldAlert, Upload } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
  autoBackupStatus,
  chooseBackupFolder,
  disableAutoBackup,
  grantAutoBackupPermission,
  runAutoBackup,
  supportsAutoBackup,
  type AutoBackupStatus,
} from '../../db/autobackup';
import { exportData, importData } from '../../db/backup';
import { describeAge, getLastBackupAt } from '../../lib/backupReminder';
import { formatBytes, getStorageStatus, requestPersistence, type StorageStatus } from '../../lib/storage';

/** Tout pour ne pas perdre tes données : stockage protégé, export, sauvegarde automatique, import. */
export function DataSafety({ onImported }: { onImported: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [auto, setAuto] = useState<AutoBackupStatus | null>(null);
  const [lastAt, setLastAt] = useState(getLastBackupAt);

  const refresh = useCallback(async () => {
    setStorage(await getStorageStatus());
    setAuto(await autoBackupStatus());
    setLastAt(getLastBackupAt());
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    try {
      const n = await importData(file);
      setMsg(`${n} cartes importées.`);
      onImported();
    } catch {
      setMsg('Import impossible : fichier non reconnu.');
    }
    if (input.current) input.current.value = '';
  };

  const protect = async () => {
    const ok = await requestPersistence();
    setMsg(ok ? 'Stockage protégé : ton navigateur ne supprimera plus tes données automatiquement.' : 'Ton navigateur a refusé. Garde une sauvegarde à jour avec « Exporter ».');
    await refresh();
  };

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setMsg('Opération impossible dans ce navigateur.');
    }
    await refresh();
  };

  return (
    <Card className="mt-6">
      <div className="flex items-center gap-2">
        {storage?.persisted ? <ShieldCheck size={18} className="text-good" /> : <ShieldAlert size={18} className="text-warn" />}
        <h2 className="font-display text-xl">Mes données</h2>
      </div>
      <p className="mt-1 text-sm text-muted">Tes cartes, parties et réglages restent uniquement sur cet appareil.</p>

      <div className="mt-3 flex flex-col gap-1 text-sm">
        <p>
          Stockage protégé :{' '}
          <strong className={storage?.persisted ? 'text-good' : 'text-warn'}>{storage?.persisted ? 'oui' : storage?.supported ? 'non' : 'non disponible'}</strong>
          {storage?.usage !== undefined && <span className="text-muted"> · {formatBytes(storage.usage)} utilisés</span>}
        </p>
        <p className="text-muted">{describeAge(lastAt, Date.now())}</p>
      </div>
      {storage?.supported && !storage.persisted && (
        <Button className="mt-3 w-full" onClick={() => void protect()}>
          <ShieldCheck size={16} /> Protéger mes données
        </Button>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={() => void run(exportData)}>
          <Download size={16} /> Exporter
        </Button>
        <Button onClick={() => input.current?.click()}>
          <Upload size={16} /> Importer
        </Button>
      </div>
      <input ref={input} type="file" accept="application/json" hidden onChange={(e) => void handleFile(e.target.files?.[0])} />

      <div className="mt-4 border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <FolderCheck size={16} className="text-accent" />
          <p className="text-sm font-medium">Sauvegarde automatique</p>
        </div>
        {!supportsAutoBackup() ? (
          <p className="mt-1 text-sm text-muted">
            Disponible sur Chrome ou Edge (ordinateur). Ailleurs, utilise « Exporter » : un rappel s’affiche chaque semaine.
          </p>
        ) : auto?.enabled ? (
          <div className="mt-1 flex flex-col gap-2 text-sm">
            <p className="text-muted">
              Dossier : <strong className="text-fg">{auto.folder}</strong> · une sauvegarde par jour, les 7 dernières sont gardées.
            </p>
            {auto.permission !== 'granted' ? (
              <Button variant="primary" onClick={() => void run(async () => setMsg((await grantAutoBackupPermission()) ? 'Sauvegarde automatique réactivée.' : 'Autorisation refusée.'))}>
                Autoriser l’écriture dans le dossier
              </Button>
            ) : (
              <p className="text-good">Active{auto.lastAt ? ` · dernière écriture : ${new Date(auto.lastAt).toLocaleString('fr-FR')}` : ''}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={auto.permission !== 'granted'}
                onClick={() => void run(async () => setMsg((await runAutoBackup({ force: true })) === 'done' ? 'Sauvegarde écrite dans le dossier.' : 'Rien à sauvegarder pour l’instant.'))}
              >
                Sauvegarder maintenant
              </Button>
              <Button onClick={() => void run(disableAutoBackup)}>Désactiver</Button>
            </div>
          </div>
        ) : (
          <div className="mt-1">
            <p className="text-sm text-muted">Choisis un dossier (de préférence synchronisé : OneDrive, Dropbox, Google Drive) : l’app y écrit une sauvegarde par jour.</p>
            <Button
              className="mt-2 w-full"
              onClick={() =>
                void run(async () => {
                  await chooseBackupFolder();
                  await runAutoBackup({ force: true });
                  setMsg('Sauvegarde automatique activée.');
                })
              }
            >
              Choisir un dossier
            </Button>
          </div>
        )}
      </div>

      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </Card>
  );
}
