import { useState } from 'react';
import { Bot, Users, type LucideIcon } from 'lucide-react';
import { BotGame } from './BotGame';
import { TwoSides } from './TwoSides';

type Mode = 'two' | 'bot';

const MODES: { id: Mode; label: string; hint: string; icon: LucideIcon }[] = [
  { id: 'two', label: 'Deux côtés', hint: 'Tu joues les deux camps', icon: Users },
  { id: 'bot', label: 'Contre un bot', hint: 'Choisis son Elo', icon: Bot },
];

/** Onglet Plateau : deux boutons à gauche (deux côtés / bot), l'échiquier à droite. */
export function Playground() {
  const [mode, setMode] = useState<Mode>('two');
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 md:grid-cols-[190px_minmax(0,1fr)]">
      <aside className="grid grid-cols-2 gap-2 md:grid-cols-1 md:content-start">
        {MODES.map(({ id, label, hint, icon: Icon }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              onClick={() => setMode(id)}
              aria-pressed={active}
              className={`flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-2xl border px-4 py-2 text-left transition active:scale-[0.98] ${
                active ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-surface text-fg hover:bg-surface-2'
              }`}
            >
              <span className="flex items-center gap-2 font-medium">
                <Icon size={18} /> {label}
              </span>
              <span className={`hidden text-xs md:block ${active ? 'opacity-80' : 'text-muted'}`}>{hint}</span>
            </button>
          );
        })}
      </aside>

      <section key={mode} className="min-w-0">
        {mode === 'two' ? <TwoSides /> : <BotGame />}
      </section>
    </div>
  );
}
