import { useState } from 'react';
import { Globe } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { START_FEN } from '../../db/repertoire';
import { fetchExplorer, getToken, setToken } from '../../lib/explorer';

/** Réglage optionnel : jeton Lichess pour compléter les réponses adverses de l'entraînement. */
export function ExternalSource() {
  const [value, setValue] = useState(getToken);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = () => {
    setToken(value);
    setMsg(value.trim() ? 'Jeton enregistré sur cet appareil.' : 'Jeton supprimé.');
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      setToken(value);
      const moves = await fetchExplorer(START_FEN, value.trim());
      setMsg(`Connexion réussie : ${moves.slice(0, 3).map((m) => `${m.san} ${Math.round(m.share * 100)} %`).join(', ')}.`);
    } catch (e) {
      setMsg(`Échec : ${e instanceof Error ? e.message : 'erreur inconnue'}.`);
    }
    setBusy(false);
  };

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Globe size={18} className="text-accent" />
        <h2 className="font-display text-xl">Source externe (optionnel)</h2>
      </div>
      <p className="mt-2 text-sm text-muted">
        Avec un jeton Lichess, l’entraînement complète les réponses adverses avec les coups réellement joués sur Lichess, et te signale les positions que tu n’as pas préparées.
        Crée un jeton sur lichess.org/account/oauth/token, <strong>sans cocher aucune autorisation</strong>, et colle-le ici. Il reste sur cet appareil.
      </p>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="lip_…"
        autoCapitalize="none"
        autoCorrect="off"
        className="mt-3 h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-fg"
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={save}>Enregistrer</Button>
        <Button variant="primary" onClick={() => void test()} disabled={!value.trim() || busy}>
          {busy ? 'Test…' : 'Tester'}
        </Button>
      </div>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </Card>
  );
}
