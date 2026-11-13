import { useEffect, useMemo, useState } from 'react';
import { Grid3x3 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { listDrills } from '../../db/drills';
import type { DrillRun } from '../../db/db';
import { DURATIONS, accuracy, durationLabel } from '../../lib/coords';
import { bestByDuration, recentAverages, seriesFor, squareStats, weakSquares } from '../../lib/drills';
import { SquareBoard } from '../playground/SquareBoard';

function ScoreChart({ points }: { points: { ts: number; score: number }[] }) {
  if (points.length < 2) return <p className="text-sm text-muted">Fais au moins 2 manches de cette durée pour voir ta progression.</p>;
  const W = 320;
  const H = 120;
  const pad = { l: 28, r: 8, t: 10, b: 20 };
  const max = Math.max(...points.map((p) => p.score), 1);
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (s: number) => pad.t + (1 - s / max) * (H - pad.t - pad.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Progression des scores">
      {[0, 0.5, 1].map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={W - pad.r} y1={y(g * max)} y2={y(g * max)} stroke="var(--border)" />
          <text x={pad.l - 6} y={y(g * max) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
            {Math.round(g * max)}
          </text>
        </g>
      ))}
      <polyline points={points.map((p, i) => `${x(i)},${y(p.score)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={p.ts} cx={x(i)} cy={y(p.score)} r="3.5" fill="var(--accent)">
          <title>{`${new Date(p.ts).toLocaleDateString('fr-FR')} : ${p.score}`}</title>
        </circle>
      ))}
      <text x={pad.l} y={H - 5} fontSize="10" fill="var(--muted)">
        {new Date(points[0].ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
      </text>
      <text x={W - pad.r} y={H - 5} textAnchor="end" fontSize="10" fill="var(--muted)">
        {new Date(points[points.length - 1].ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
      </text>
    </svg>
  );
}

/** Bloc « Vision de l'échiquier » : résultats de l'entraînement aux coordonnées (séparés des révisions de cartes). */
export function VisionStats() {
  const [runs, setRuns] = useState<DrillRun[] | null>(null);
  const [dur, setDur] = useState<number | null>(null);

  useEffect(() => {
    void listDrills().then((r) => {
      setRuns(r);
      const latest = r[r.length - 1];
      setDur(latest ? latest.durationSec : null);
    });
  }, []);

  const data = useMemo(() => {
    if (!runs || runs.length === 0) return null;
    const stats = squareStats(runs);
    const weak = weakSquares(stats, { min: 3, top: 5 });
    const heat: Record<string, number> = {};
    for (const [sq, s] of Object.entries(stats)) if (s.ok + s.ko >= 3 && s.ko > 0) heat[sq] = s.ko / (s.ok + s.ko);
    const totalSec = runs.reduce((n, r) => n + r.durationSec, 0);
    return { best: bestByDuration(runs), averages: recentAverages(runs, 10), weak, heat, totalMin: Math.round(totalSec / 60) };
  }, [runs]);

  if (!runs) return null;

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Grid3x3 size={18} className="text-accent" />
        <h2 className="font-display text-xl">Vision de l’échiquier</h2>
      </div>

      {!data ? (
        <p className="mt-2 text-sm text-muted">Aucune manche pour l’instant. Lance un entraînement dans Plateau › Positions : tes scores et tes cases difficiles apparaîtront ici.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            {runs.length} manche{runs.length > 1 ? 's' : ''} · {data.totalMin} min d’entraînement
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-2 py-3 text-center">
              <div className="font-display text-3xl">{data.averages.accuracy === null ? '—' : `${data.averages.accuracy} %`}</div>
              <div className="text-xs text-muted">précision (10 dernières manches)</div>
            </div>
            <div className="rounded-xl bg-surface-2 py-3 text-center">
              <div className="font-display text-3xl">{data.averages.avgMs === null ? '—' : `${(data.averages.avgMs / 1000).toFixed(1).replace('.', ',')} s`}</div>
              <div className="text-xs text-muted">par case trouvée</div>
            </div>
          </div>

          <p className="mt-4 text-sm text-muted">Records (bonnes réponses)</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => data.best[d] !== undefined && setDur(d)}
                aria-pressed={dur === d}
                className={`rounded-xl px-2 py-2 text-center ${dur === d ? 'bg-accent text-accent-fg' : 'bg-surface-2'}`}
              >
                <div className="text-xs opacity-80">{durationLabel(d)}</div>
                <div className="font-display text-xl">{data.best[d] ?? '—'}</div>
              </button>
            ))}
          </div>

          {dur !== null && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-muted">Progression · manches de {durationLabel(dur)}</p>
              <ScoreChart points={seriesFor(runs, dur)} />
            </div>
          )}

          <p className="mt-4 text-sm text-muted">Cases les plus ratées</p>
          {data.weak.length === 0 ? (
            <p className="mt-1 text-sm text-muted">Pas encore de case clairement difficile : continue à t’entraîner.</p>
          ) : (
            <div className="mt-2 grid items-start gap-4 sm:grid-cols-2">
              <SquareBoard orientation="white" heat={data.heat} showCoords />
              <ul className="space-y-1.5 text-sm">
                {data.weak.map((w) => (
                  <li key={w.square} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
                    <strong className="uppercase">{w.square}</strong>
                    <span className="text-muted">
                      {accuracy(w.attempts - Math.round(w.missRate * w.attempts), Math.round(w.missRate * w.attempts))} % de réussite · {w.attempts} essais
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
