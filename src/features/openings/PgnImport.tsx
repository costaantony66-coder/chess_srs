import { useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { importPgn } from '../../db/repertoire';

export function PgnImport({ repId, onDone }: { repId: string; onDone: () => void }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await importPgn(repId, text);
      setMsg(
        `${r.added} coup${r.added > 1 ? 's' : ''} ajouté${r.added > 1 ? 's' : ''} (${r.games} partie${r.games > 1 ? 's' : ''} lue${r.games > 1 ? 's' : ''})` +
          (r.skipped ? `, ${r.skipped} coup(s) illégal(aux) ignoré(s).` : '.'),
      );
      setText('');
      onDone();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Import impossible.');
    }
    setBusy(false);
  };

  const readFile = async (f?: File) => {
    if (!f) return;
    setText(await f.text());
    if (file.current) file.current.value = '';
  };

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Colle ici ton PGN (Lichess, ChessBase, Chessable…)\n1. e4 e5 2. Nf3 Nc6 (2... d6) 3. Bb5'}
        rows={6}
        className="w-full rounded-xl border border-border bg-surface-2 p-3 font-mono text-sm text-fg"
      />
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => file.current?.click()}>
          <FileUp size={16} /> Ouvrir un fichier
        </Button>
        <Button variant="primary" disabled={!text.trim() || busy} onClick={() => void run()}>
          {busy ? 'Import…' : 'Importer'}
        </Button>
      </div>
      <input ref={file} type="file" accept=".pgn,text/plain" hidden onChange={(e) => void readFile(e.target.files?.[0])} />
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
