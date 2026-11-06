import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Brain, Crown, GitBranch, Puzzle, type LucideIcon } from 'lucide-react';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { ComingSoon } from './components/ComingSoon';
import { Playground } from './features/playground/Playground';
import { ReviewSession } from './features/review/ReviewSession';
import { useTheme } from './hooks/useTheme';

type TabId = 'board' | 'review' | 'puzzles' | 'openings' | 'stats';

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'board', label: 'Plateau', icon: Crown },
  { id: 'review', label: 'Réviser', icon: Brain },
  { id: 'puzzles', label: 'Puzzles', icon: Puzzle },
  { id: 'openings', label: 'Ouvertures', icon: GitBranch },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
];

function View({ tab }: { tab: TabId }) {
  switch (tab) {
    case 'board':
      return <Playground />;
    case 'review':
      return <ReviewSession />;
    case 'puzzles':
      return <ComingSoon title="Puzzles" phase={3} text="Tactiques Lichess par thème et par niveau." />;
    case 'openings':
      return <ComingSoon title="Répertoire" phase={4} text="Ton arbre de variantes, côté blancs et noirs." />;
    case 'stats':
      return <ComingSoon title="Statistiques" phase={6} text="Streak, heatmap de révisions, courbe de rétention." />;
  }
}

export function App() {
  const [tab, setTab] = useState<TabId>('review');
  const { theme, toggle } = useTheme();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="font-display text-2xl tracking-tight">Chess SRS</h1>
        <ThemeToggle theme={theme} onToggle={toggle} />
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
            <View tab={tab} />
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = id === tab;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs transition ${active ? 'text-accent' : 'text-muted'}`}
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
