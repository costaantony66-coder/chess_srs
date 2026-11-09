import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Flag, Save, Undo2 } from 'lucide-react';
import { Chess } from 'chess.js';
import { Board, type Feedback } from '../../components/board/Board';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { saveParsedGames } from '../../db/games';
import { useChessGame } from '../../hooks/useChessGame';
import { usePersistentState } from '../../hooks/usePersistentState';
import { BOT_MAX_ELO, BOT_MIN_ELO, botMove, prepareBot } from '../../lib/bot';
import { Uci, stockfishWorker } from '../../lib/engine';
import { MoveList } from './TwoSides';

const PRESETS = [600, 800, 1000, 1200, 1500, 1800, 2000, 2400, 2800];

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

/** Partie contre Stockfish à force réglable (Elo approximatif). */
export function BotGame() {
  const game = useChessGame();
  const [elo, setEloState] = useState(() => Number(localStorage.getItem('bot:elo')) || 1200);
  const [choice, setChoice] = usePersistentState('bot:color', 'white');
  const [side, setSide] = useState<'white' | 'black'>('white');
  const [started, setStarted] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [resigned, setResigned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const engine = useRef<Uci | null>(null);
  const ready = useRef<Promise<void> | null>(null);
  const token = useRef(0); // invalide les coups du bot d'une partie abandonnée

  const setElo = (n: number) => {
    const v = Math.max(BOT_MIN_ELO, Math.min(BOT_MAX_ELO, n));
    setEloState(v);
    try {
      localStorage.setItem('bot:elo', String(v));
    } catch {
      /* stockage indisponible */
    }
  };

  useEffect(
    () => () => {
      engine.current?.terminate();
      engine.current = null;
    },
    [],
  );

  const ensureEngine = useCallback(async () => {
    if (!engine.current) {
      const e = new Uci(stockfishWorker());
      engine.current = e;
      ready.current = e.init();
    }
    await ready.current;
    return engine.current!;
  }, []);

  /** Le bot joue le coup qui suit la position actuelle. */
  const botPlay = useCallback(
    async (fen: string, forGame: number) => {
      setThinking(true);
      try {
        const e = await ensureEngine();
        const [uci] = await Promise.all([botMove(e, fen, elo), new Promise((r) => setTimeout(r, 400))]);
        if (forGame !== token.current) return;
        const move = game.play(uci.slice(0, 2), uci.slice(2, 4), uci[4] ?? 'q');
        if (move?.san.endsWith('+') || move?.san.endsWith('#')) setFeedback({ kind: move.san.endsWith('#') ? 'bad' : 'warn', id: Date.now() });
      } catch {
        if (forGame === token.current) setError('Impossible de lancer Stockfish. Vérifie ta connexion au premier lancement (le moteur de 2 Mo est ensuite gardé en cache).');
      } finally {
        if (forGame === token.current) setThinking(false);
      }
    },
    [ensureEngine, elo, game],
  );

  const start = async () => {
    token.current++;
    setError(null);
    setSaved(false);
    setResigned(false);
    setFeedback(null);
    game.reset();
    const mine = choice === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : (choice as 'white' | 'black');
    setSide(mine);
    setStarted(true);
    try {
      await prepareBot(await ensureEngine(), elo);
    } catch {
      setError('Impossible de lancer Stockfish. Vérifie ta connexion au premier lancement.');
      return;
    }
    if (mine === 'black') void botPlay(new Chess().fen(), token.current);
  };

  const myTurn = started && !game.isGameOver && !resigned && (game.turn === 'w') === (side === 'white');
  const over = started && (game.isGameOver || resigned);

  const handleMove = (from: string, to: string) => {
    if (!myTurn || thinking) return;
    const move = game.play(from, to);
    if (!move) return;
    if (move.san.endsWith('#')) {
      setFeedback({ kind: 'good', id: Date.now() });
      return;
    }
    if (move.san.endsWith('+')) setFeedback({ kind: 'warn', id: Date.now() });
    if (!new Chess(move.after).isGameOver()) void botPlay(move.after, token.current);
  };

  const undo = () => {
    if (thinking || !myTurn || game.history.length < 2) return;
    game.undo();
    game.undo();
  };

  const resign = () => {
    token.current++;
    setThinking(false);
    setResigned(true);
  };

  const result = resigned
    ? side === 'white' ? '0-1' : '1-0'
    : game.isCheckmate
      ? game.turn === 'w' ? '0-1' : '1-0'
      : '1/2-1/2';
  const iWon = (result === '1-0') === (side === 'white') && result !== '1/2-1/2';
  const verdict = result === '1/2-1/2' ? 'Partie nulle.' : iWon ? 'Tu as gagné !' : resigned ? 'Tu as abandonné.' : 'Le bot a gagné.';

  const save = async () => {
    const me = 'Moi';
    const bot = `Stockfish (~${elo})`;
    await saveParsedGames(
      [
        {
          id: `bot:${Date.now()}`,
          source: 'bot',
          white: side === 'white' ? me : bot,
          black: side === 'white' ? bot : me,
          myColor: side,
          result,
          playedAt: Date.now(),
          moves: game.history.map((m) => m.san),
          analysed: false,
          errors: [],
        },
      ],
      new Set(),
    );
    setSaved(true);
  };

  const status = !started
    ? 'Choisis ta couleur et l’Elo du bot, puis lance la partie.'
    : over
      ? verdict
      : thinking
        ? 'Le bot réfléchit…'
        : `À toi de jouer (${side === 'white' ? 'blancs' : 'noirs'})${game.inCheck ? ' · échec' : ''}`;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,560px)_1fr]">
      <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-16rem))] xl:max-w-none">
        <Board
          fen={game.fen}
          orientation={side}
          lastMove={game.lastMove}
          onMove={handleMove}
          viewOnly={!myTurn || thinking}
          feedback={feedback}
        />
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-accent" />
            <p className="font-display text-lg">{status}</p>
          </div>
          {error && <p className="mt-2 text-sm text-bad">{error}</p>}
          {started && !over && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button onClick={undo} disabled={thinking || !myTurn || game.history.length < 2}>
                <Undo2 size={16} /> Annuler mon coup
              </Button>
              <Button variant="bad" onClick={resign}>
                <Flag size={16} /> Abandonner
              </Button>
            </div>
          )}
          {over && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button onClick={() => void save()} disabled={saved || game.history.length === 0}>
                <Save size={16} /> {saved ? 'Enregistrée' : 'Enregistrer dans mes parties'}
              </Button>
              <Button variant="primary" onClick={() => void start()}>
                Nouvelle partie
              </Button>
            </div>
          )}
          {saved && <p className="mt-2 text-sm text-good">Partie enregistrée : analyse-la dans l’onglet Parties.</p>}
        </Card>

        {(!started || over) && (
          <Card>
            <p className="text-sm text-muted">Ta couleur</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip active={choice === 'white'} onClick={() => setChoice('white')}>Blancs</Chip>
              <Chip active={choice === 'black'} onClick={() => setChoice('black')}>Noirs</Chip>
              <Chip active={choice === 'random'} onClick={() => setChoice('random')}>Au hasard</Chip>
            </div>

            <p className="mt-4 text-sm text-muted">
              Force du bot : <strong className="text-fg">≈ {elo} Elo</strong> (approximatif)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Chip key={p} active={elo === p} onClick={() => setElo(p)}>
                  {p}
                </Chip>
              ))}
            </div>
            <input
              type="range"
              min={BOT_MIN_ELO}
              max={BOT_MAX_ELO}
              step={50}
              value={elo}
              onChange={(e) => setElo(Number(e.target.value))}
              aria-label="Elo du bot"
              className="mt-3 w-full accent-[var(--accent)]"
            />
            <div className="flex justify-between text-xs text-muted">
              <span>{BOT_MIN_ELO}</span>
              <span>{BOT_MAX_ELO}</span>
            </div>

            <Button variant="primary" className="mt-4 w-full" onClick={() => void start()}>
              {over ? 'Nouvelle partie' : 'Commencer la partie'}
            </Button>
          </Card>
        )}

        <MoveList history={game.history.map((m) => m.san)} />
      </div>
    </div>
  );
}
