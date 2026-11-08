import { useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { saveParsedGames, type SaveReport } from '../../db/games';
import { parseChessComGames, parseLichessNdjson, parsePgnGames } from '../../lib/games';
import { fetchChessCom, fetchLichess } from '../../lib/sources';
import { usePersistentState } from '../../hooks/usePersistentState';

type Source = 'lichess' | 'chesscom' | 'pgn';

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-10 rounded-full px-3 text-sm transition active:scale-95 ${active ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg'}`}
    >
      {children}
    </button>
  );
}

export function GameImport({ onDone }: { onDone: () => void }) {
  const [source, setSource] = useState<Source>('lichess');
  const [lichessUser, setLichessUser] = usePersistentState('user:lichess', '');
  const [chessUser, setChessUser] = usePersistentState('user:chesscom', '');
  const [pgnUser, setPgnUser] = usePersistentState('user:pgn', '');
  const [max, setMax] = useState(50);
  const [months, setMonths] = useState(1);
  const [side, setSide] = useState<'auto' | 'white' | 'black'>('auto');
  const [pgn, setPgn] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const summary = (r: SaveReport, extra = '') =>
    r.games === 0
      ? `Aucune partie trouvée.${extra}`
      : `${r.games} partie${r.games > 1 ? 's' : ''} lue${r.games > 1 ? 's' : ''} (${r.newGames} nouvelle${r.newGames > 1 ? 's' : ''}). Lance l’analyse Stockfish pour créer tes cartes d’erreurs.${extra}`;

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (source === 'lichess') {
        const games = parseLichessNdjson(await fetchLichess(lichessUser, max), lichessUser);
        setMsg(summary(await saveParsedGames(games, new Set())));
      } else if (source === 'chesscom') {
        const json = await fetchChessCom(chessUser, months);
        const games = parseChessComGames(json as Parameters<typeof parseChessComGames>[0], chessUser);
        setMsg(summary(await saveParsedGames(games, new Set())));
      } else {
        const { games, unresolved } = parsePgnGames(pgn, { username: pgnUser, side });
        const r = await saveParsedGames(games, new Set());
        setMsg(summary(r, unresolved ? ` ${unresolved} partie(s) ignorée(s) : camp inconnu (renseigne ton pseudo ou choisis ta couleur).` : ''));
        setPgn('');
      }
      onDone();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Import impossible.');
    }
    setBusy(false);
  };

  const input = (value: string, set: (v: string) => void, placeholder: string) => (
    <input
      value={value}
      onChange={(e) => set(e.target.value)}
      placeholder={placeholder}
      autoCapitalize="none"
      autoCorrect="off"
      className="h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-fg"
    />
  );

  const ready = source === 'lichess' ? lichessUser.trim() : source === 'chesscom' ? chessUser.trim() : pgn.trim() && (pgnUser.trim() || side !== 'auto');

  return (
    <Card>
      <h2 className="font-display text-xl">Importer des parties</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip active={source === 'lichess'} onClick={() => setSource('lichess')}>Lichess</Chip>
        <Chip active={source === 'chesscom'} onClick={() => setSource('chesscom')}>Chess.com</Chip>
        <Chip active={source === 'pgn'} onClick={() => setSource('pgn')}>PGN</Chip>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {source === 'lichess' && (
          <>
            {input(lichessUser, setLichessUser, 'Ton pseudo Lichess')}
            <div className="flex flex-wrap gap-2">
              {[20, 50, 100].map((n) => (
                <Chip key={n} active={max === n} onClick={() => setMax(n)}>{n} parties</Chip>
              ))}
            </div>
          </>
        )}
        {source === 'chesscom' && (
          <>
            {input(chessUser, setChessUser, 'Ton pseudo Chess.com')}
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((n) => (
                <Chip key={n} active={months === n} onClick={() => setMonths(n)}>{n} mois</Chip>
              ))}
            </div>
          </>
        )}
        {source === 'pgn' && (
          <>
            <textarea
              value={pgn}
              onChange={(e) => setPgn(e.target.value)}
              rows={5}
              placeholder="Colle ici un ou plusieurs PGN (Lichess, Chess.com, un livre, un tournoi…)"
              className="w-full rounded-xl border border-border bg-surface-2 p-3 font-mono text-sm text-fg"
            />
            <Button onClick={() => file.current?.click()}>
              <FileUp size={16} /> Ouvrir un fichier .pgn
            </Button>
            <input ref={file} type="file" accept=".pgn,text/plain" hidden onChange={(e) => void e.target.files?.[0]?.text().then(setPgn)} />
            {input(pgnUser, setPgnUser, 'Ton pseudo (pour trouver ton camp)')}
            <div className="flex flex-wrap gap-2">
              <Chip active={side === 'auto'} onClick={() => setSide('auto')}>Camp : selon le pseudo</Chip>
              <Chip active={side === 'white'} onClick={() => setSide('white')}>Blancs</Chip>
              <Chip active={side === 'black'} onClick={() => setSide('black')}>Noirs</Chip>
            </div>
          </>
        )}

        <Button variant="primary" disabled={busy || !ready} onClick={() => void run()}>
          {busy ? 'Import…' : 'Importer'}
        </Button>
        {msg && <p className="text-sm">{msg}</p>}
      </div>
    </Card>
  );
}
