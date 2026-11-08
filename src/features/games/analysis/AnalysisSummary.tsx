import type { Game } from '../../../db/db';
import { CLASS_META, CLASS_ORDER } from '../../../lib/analysis';

/** Précision et nombre de coups par catégorie, pour chaque camp. */
export function AnalysisSummary({ game }: { game: Game }) {
  const a = game.analysis;
  if (!a) return null;
  const count = (color: 'white' | 'black') => {
    const m = new Map<string, number>();
    a.classes.forEach((c, i) => {
      if ((i % 2 === 0) === (color === 'white')) m.set(c, (m.get(c) ?? 0) + 1);
    });
    return m;
  };
  const w = count('white');
  const b = count('black');
  const me = game.myColor;
  const head = (color: 'white' | 'black') => (
    <div className={`text-center ${me === color ? 'font-semibold' : 'text-muted'}`}>
      <div className="truncate text-sm">{color === 'white' ? game.white : game.black}</div>
      <div className="font-display text-2xl">{Math.round(a.accuracy[color])} %</div>
      <div className="text-xs text-muted">précision</div>
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {head('white')}
        {head('black')}
      </div>
      <div className="mt-3 flex flex-col gap-1 border-t border-border pt-2">
        {CLASS_ORDER.filter((c) => (w.get(c) ?? 0) + (b.get(c) ?? 0) > 0).map((c) => (
          <div key={c} className="grid grid-cols-[1fr_2rem_2rem] items-center gap-2 text-sm">
            <span className="flex items-center gap-2" title={CLASS_META[c].hint}>
              <span className="size-3 rounded-full" style={{ background: CLASS_META[c].color }} />
              {CLASS_META[c].label}
            </span>
            <span className={`text-right tabular-nums ${me === 'white' ? 'font-semibold' : 'text-muted'}`}>{w.get(c) ?? 0}</span>
            <span className={`text-right tabular-nums ${me === 'black' ? 'font-semibold' : 'text-muted'}`}>{b.get(c) ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
