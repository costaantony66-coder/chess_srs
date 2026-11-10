import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, BookOpen, Brain, Crown, Download, FileText, GitBranch, Puzzle, Volume2, VolumeX, type LucideIcon } from 'lucide-react';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { Playground } from './features/playground/Playground';
import { GamesPage } from './features/games/GamesPage';
import { OpeningsPage } from './features/openings/OpeningsPage';
import { PuzzleImporter } from './features/puzzles/PuzzleImporter';
import { StatsPage } from './features/stats/StatsPage';
import { TutoPage } from './features/tuto/TutoPage';
import type { TabId } from './lib/tabs';
import { Card } from './components/ui/Card';
import { Button } from './components/ui/Button';
import { ReviewSession } from './features/review/ReviewSession';
import { exportData } from './db/backup';
import { buildDiagnostics } from './lib/diagnostics';
import { useDataProtection } from './hooks/useDataProtection';
import { useGlobalErrors } from './hooks/useGlobalErrors';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { setSoundsEnabled, soundsEnabled } from './lib/sounds';
import { useTheme } from './hooks/useTheme';

const TABS: { id: Exclude<TabId, 'tuto'>; label: string; icon: LucideIcon }[] = [
  { id: 'board', label: 'Plateau', icon: Crown },
  { id: 'review', label: 'Réviser', icon: Brain },
  { id: 'puzzles', label: 'Puzzles', icon: Puzzle },
  { id: 'openings', label: 'Ouvertures', icon: GitBranch },
  { id: 'games', label: 'Parties', icon: FileText },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
];

function View({ tab, goReview, goTo }: { tab: TabId; goReview: () => void; goTo: (t: TabId) => void }) {
  switch (tab) {
    case 'board':
      return <Playground />;
    case 'review':
      return <ReviewSession />;
    case 'puzzles':
      return <PuzzleImporter onGoReview={goReview} />;
    case 'openings':
      return <OpeningsPage onGoReview={goReview} />;
    case 'games':
      return <GamesPage onGoReview={goReview} />;
    case 'stats':
      return <StatsPage />;
    case 'tuto':
      return <TutoPage onGo={goTo} />;
  }
}

export function App() {
  const [tab, setTab] = useState<TabId>('review');
  const { theme, toggle } = useTheme();
  const { canInstall, install } = useInstallPrompt();
  useDataProtection();
  const globalError = useGlobalErrors();
  const [sound, setSound] = useState(soundsEnabled);
  const [welcome, setWelcome] = useState(() => {
    try {
      return localStorage.getItem('welcomeSeen') !== '1';
    } catch {
      return false;
    }
  });
  const dismissWelcome = () => {
    setWelcome(false);
    try {
      localStorage.setItem('welcomeSeen', '1');
    } catch {
      /* stockage indisponible */
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="font-display text-2xl tracking-tight">Chess SRS</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSoundsEnabled(!sound);
              setSound(!sound);
            }}
            aria-label={sound ? 'Couper les sons' : 'Activer les sons'}
            aria-pressed={sound}
            className="grid size-11 place-items-center rounded-xl bg-surface-2 text-fg transition active:scale-95"
          >
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            onClick={() => (setTab('tuto'), dismissWelcome())}
            aria-label="Tuto"
            aria-current={tab === 'tuto' ? 'page' : undefined}
            className={`flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition active:scale-95 ${
              tab === 'tuto' ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg'
            }`}
          >
            <BookOpen size={16} /> Tuto
          </button>
          {canInstall && (
            <button
              onClick={() => void install()}
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-accent px-3 text-sm font-medium text-accent-fg transition active:scale-95"
            >
              <Download size={16} /> <span className="hidden sm:inline">Installer</span>
            </button>
          )}
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-4">
        {globalError.message && (
          <Card className="mx-auto mb-4 flex max-w-2xl flex-col gap-3 border-bad">
            <p className="font-medium">Une erreur inattendue s’est produite</p>
            <p className="text-sm text-muted">Tes données sont intactes. Si le problème se répète, sauvegarde-les et copie les détails pour me les envoyer.</p>
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={() => void exportData()}>Exporter</Button>
              <Button onClick={() => void buildDiagnostics().then((t) => navigator.clipboard?.writeText(t))}>Copier</Button>
              <Button onClick={globalError.clear}>Fermer</Button>
            </div>
          </Card>
        )}
        {welcome && tab !== 'tuto' && (
          <Card className="mx-auto mb-4 flex max-w-2xl flex-col gap-3 border-accent">
            <p className="font-display text-lg">Bienvenue sur Chess SRS !</p>
            <p className="text-sm text-muted">Nouveau ici ? Le tuto t’explique en quelques minutes comment fonctionne chaque partie du site.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={dismissWelcome}>Plus tard</Button>
              <Button variant="primary" onClick={() => (setTab('tuto'), dismissWelcome())}>
                Voir le tuto
              </Button>
            </div>
          </Card>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.16 }}
          >
            <View tab={tab} goReview={() => setTab('review')} goTo={setTab} />
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="grid grid-cols-6 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = id === tab;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] transition ${active ? 'text-accent' : 'text-muted'}`}
            >
              {active && (
                <motion.span layoutId="tab-pill" className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent" />
              )}
              <Icon size={20} />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
