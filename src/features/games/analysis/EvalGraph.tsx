import type { GameAnalysis } from '../../../db/db';
import { CLASS_META } from '../../../lib/analysis';

type Props = {
  analysis: GameAnalysis;
  myColor: 'white' | 'black';
  ply: number;
  onSelect: (ply: number) => void;
};

const W = 320;
const H = 90;
const CLIP = 600;

/** Courbe d'évaluation de la partie (haut = avantage blanc). Un clic ou un glissement change de coup. */
export function EvalGraph({ analysis, myColor, ply, onSelect }: Props) {
  const n = analysis.evals.length - 1;
  if (n < 1) return null;
  const x = (i: number) => (i / n) * W;
  const y = (cp: number) => H / 2 - (Math.max(-CLIP, Math.min(CLIP, cp)) / CLIP) * (H / 2 - 4);
  const line = analysis.evals.map((cp, i) => `${x(i)},${y(cp)}`).join(' ');
  const area = `0,${H / 2} ${line} ${W},${H / 2}`;

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onSelect(Math.max(0, Math.min(n, Math.round(((e.clientX - r.left) / r.width) * n))));
  };

  const marks = analysis.classes
    .map((c, i) => ({ c, ply: i + 1 }))
    .filter(({ c, ply: p }) => ['inaccuracy', 'mistake', 'miss', 'blunder', 'brilliant'].includes(c) && (p % 2 === 1) === (myColor === 'white'));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full touch-none select-none rounded-lg bg-surface-2"
      role="img"
      aria-label="Courbe d’évaluation de la partie"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e);
      }}
      onPointerMove={(e) => e.buttons === 1 && pick(e)}
    >
      <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="var(--border)" />
      <polygon points={area} fill="var(--accent)" fillOpacity={0.18} />
      <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
      {marks.map(({ c, ply: p }) => (
        <circle key={p} cx={x(p)} cy={y(analysis.evals[p])} r={3.5} fill={CLASS_META[c].color} stroke="var(--surface)" strokeWidth={1} />
      ))}
      <line x1={x(ply)} x2={x(ply)} y1={0} y2={H} stroke="var(--fg)" strokeWidth={1.5} strokeOpacity={0.7} />
    </svg>
  );
}
