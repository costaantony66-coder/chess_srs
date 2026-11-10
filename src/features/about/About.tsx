import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { buildDiagnostics } from '../../lib/diagnostics';

const REPO = import.meta.env.VITE_REPO_URL as string | undefined;

const CREDITS: { name: string; what: string; licence: string; url: string }[] = [
  { name: 'Base de puzzles Lichess', what: 'les puzzles', licence: 'CC0', url: 'https://database.lichess.org/#puzzles' },
  { name: 'lichess-org/chess-openings', what: 'noms et théorie des ouvertures', licence: 'CC0', url: 'https://github.com/lichess-org/chess-openings' },
  { name: 'chessground', what: 'l’échiquier', licence: 'GPL-3.0 ou ultérieure', url: 'https://github.com/lichess-org/chessground' },
  { name: 'Jeu de pièces « cburnett »', what: 'le dessin des pièces (Colin M.L. Burnett)', licence: 'GPL-2.0 ou ultérieure', url: 'https://commons.wikimedia.org/wiki/Template:SVG_chess_pieces' },
  { name: 'Stockfish', what: 'le moteur d’analyse et le bot (via stockfish.js)', licence: 'GPL-3.0', url: 'https://github.com/official-stockfish/Stockfish' },
  { name: 'chess.js', what: 'les règles du jeu', licence: 'BSD-2-Clause', url: 'https://github.com/jhlywa/chess.js' },
  { name: 'FSRS / ts-fsrs', what: 'la répétition espacée', licence: 'MIT', url: 'https://github.com/open-spaced-repetition/ts-fsrs' },
  { name: 'Dexie', what: 'le stockage local', licence: 'Apache-2.0', url: 'https://dexie.org' },
  { name: 'React, Framer Motion, Lucide', what: 'l’interface', licence: 'MIT / MIT / ISC', url: 'https://react.dev' },
];

/** Licence, crédits et informations de diagnostic. */
export function About() {
  const [msg, setMsg] = useState<string | null>(null);
  const base = import.meta.env.BASE_URL;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(await buildDiagnostics());
      setMsg('Informations copiées : colle-les dans ton message.');
    } catch {
      setMsg('Copie impossible dans ce navigateur.');
    }
  };

  return (
    <>
      <p>
        Chess SRS est un <strong>logiciel libre</strong>, publié sous licence <strong>GNU GPL version 3 ou ultérieure</strong> : tu peux l’utiliser, l’étudier, le modifier et le
        partager, à condition de conserver cette licence.
      </p>
      <ul className="list-disc space-y-1.5 pl-5">
        {REPO && (
          <li>
            Code source :{' '}
            <a className="text-accent underline" href={REPO} target="_blank" rel="noreferrer">
              {REPO.replace('https://', '')}
            </a>
          </li>
        )}
        <li>
          Texte de la licence :{' '}
          <a className="text-accent underline" href={`${base}LICENSE.txt`} target="_blank" rel="noreferrer">
            LICENSE.txt
          </a>
        </li>
        <li>Version : {__APP_VERSION__}</li>
      </ul>

      <p className="font-medium">Ce projet repose sur le travail de :</p>
      <ul className="space-y-1.5 text-sm">
        {CREDITS.map((c) => (
          <li key={c.name}>
            <a className="font-medium text-accent underline" href={c.url} target="_blank" rel="noreferrer">
              {c.name}
            </a>{' '}
            — {c.what} <span className="text-muted">({c.licence})</span>
          </li>
        ))}
      </ul>

      <div className="rounded-xl bg-surface-2 p-3">
        <p className="text-sm font-medium">Un problème ?</p>
        <p className="mt-1 text-sm text-muted">Copie les informations de diagnostic (version, navigateur, nombre de cartes, dernière erreur) et colle-les dans ton message. Aucune donnée de jeu n’y figure.</p>
        <Button className="mt-2" onClick={() => void copy()}>
          Copier les informations de diagnostic
        </Button>
        {msg && <p className="mt-2 text-sm">{msg}</p>}
      </div>
    </>
  );
}
