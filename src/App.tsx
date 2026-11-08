import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Brain, Crown, Download, FileText, GitBranch, Puzzle, type LucideIcon } from 'lucide-react';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { Playground } from './features/playground/Playground';
import { GamesPage } from './features/games/GamesPage';
import { OpeningsPage } from './features/openings/OpeningsPage';
import { PuzzleImporter } from './features/puzzles/PuzzleImporter';
import { StatsPage } from './features/stats/StatsPage';
import { ReviewSession } from './features/review/ReviewSession';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { useTheme } from './hooks/useTheme';

type TabId = 'board' | 'review' | 'puzzles' | 'openings' | 'games' | 'stats';

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'board', label: 'Plateau', icon: Crown },
  { id: 'review', label: 'Réviser', icon: Brain },
  { id: 'puzzles', label: 'Puzzles', icon: Puzzle },
  { id: 'openings', label: 'Ouvertures', icon: GitBranch },
  { id: 'games', label: 'Parties', icon: FileText },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
];

function View({ tab, goReview }: { tab: TabId; goReview: () => void }) {
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
  }
}

export function App() {
  const [tab, setTab] = useState<TabId>('review');
  const { theme, toggle } = useTheme();
  const { canInstall, install } = useInstallPrompt();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="font-display text-2xl tracking-tight">Chess SRS</h1>
        <div className="flex items-center gap-2">
          {canInstall && (
            <button
              onClick={() => void install()}
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-accent px-3 text-sm font-medium text-accent-fg transition active:scale-95"
            >
              <Download size={16} /> Installer
            </button>
          )}
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.16 }}
          >
            <View tab={tab} goReview={() => setTab('review')} />
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
