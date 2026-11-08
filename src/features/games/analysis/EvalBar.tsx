import { formatEval } from '../../../lib/analysis';
import { expectedPoints } from '../../../lib/engine';

/** Barre d'évaluation verticale : la part blanche suit les chances des blancs. */
export function EvalBar({ cp, orientation }: { cp: number; orientation: 'white' | 'black' }) {
  const whitePct = Math.round(expectedPoints(cp) * 100);
  const whiteAtBottom = orientation === 'white';
  const whiteBetter = cp >= 0;
  return (
    <div
      className="relative w-6 shrink-0 self-stretch overflow-hidden rounded-md bg-neutral-800"
      role="img"
      aria-label={`Évaluation ${formatEval(cp)}`}
      title={formatEval(cp)}
    >
      <div
        className="absolute inset-x-0 bg-neutral-50 transition-all duration-300"
        style={{ height: `${whitePct}%`, [whiteAtBottom ? 'bottom' : 'top']: 0 }}
      />
      <span
        className={`absolute inset-x-0 text-center text-[10px] font-semibold ${whiteBetter ? 'text-neutral-800' : 'text-neutral-100'}`}
        style={{ [whiteBetter === whiteAtBottom ? 'bottom' : 'top']: 2 }}
      >
        {formatEval(cp).replace(/^[+-]/, '')}
      </span>
    </div>
  );
}
