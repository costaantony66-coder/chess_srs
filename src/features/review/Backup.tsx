import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { exportData, importData } from '../../db/backup';

export function Backup({ onImported }: { onImported: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

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

  return (
    <Card className="mt-6">
      <p className="text-sm text-muted">Sauvegarde (tes données restent sur cet appareil)</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={() => void exportData()}>
          <Download size={16} /> Exporter
        </Button>
        <Button onClick={() => input.current?.click()}>
          <Upload size={16} /> Importer
        </Button>
      </div>
      <input ref={input} type="file" accept="application/json" hidden onChange={(e) => void handleFile(e.target.files?.[0])} />
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </Card>
  );
}
