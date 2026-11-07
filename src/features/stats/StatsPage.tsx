import { useEffect, useMemo, useState } from 'react';
import { State } from 'ts-fsrs';
import { Flame } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { db, type ReviewLog } from '../../db/db';
import { computeStreak, dayKey, heatLevel, heatmap, retentionSince, reviewsPerDay, weeklyRetention } from '../../lib/stats';

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="py-3 text-center">
      <div className="font-display text-3xl">{value}</div>
      <div className="text-sm text-muted">{label}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </Card>
  );
}

const LEVEL = ['bg-surface-2', 'bg-accent/25', 'bg-accent/50', 'bg-accent/75', 'bg-accent'];

function RetentionChart({ points }: { points: { weekStart: string; rate: number; n: number }[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-muted">Pas encore assez de données : la courbe apparaît après des révisions de cartes « à revoir » sur au moins 2 semaines.</p>;
  }
  const W = 320;
  const H = 150;
  const pad = { l: 34, r: 8, t: 8, b: 22 };
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (r: number) => pad.t + (1 - r) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${x(i)},${y(p.rate)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Courbe de rétention par semaine">
      {[0, 0.5, 0.9, 1].map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="var(--border)" strokeDasharray={g === 0.9 ? '4 3' : undefined} />
          <text x={pad.l - 6} y={y(g) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
            {Math.round(g * 100)}%
          </text>
        </g>
      ))}
      <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={p.weekStart} cx={x(i)} cy={y(p.rate)} r="3.5" fill="var(--accent)">
          <title>{`Semaine du ${p.weekStart} : ${Math.round(p.rate * 100)} % (${p.n} révisions)`}</title>
        </circle>
      ))}
      <text x={pad.l} y={H - 6} fontSize="10" fill="var(--muted)">
        {points[0].weekStart.slice(5)}
      </text>
      <text x={W - pad.r} y={H - 6} textAnchor="end" fontSize="10" fill="var(--muted)">
        {points[points.length - 1].weekStart.slice(5)}
      </text>
    </svg>
  );
}

export function StatsPage() {
  const [reviews, setReviews] = useState<ReviewLog[] | null>(null);
  const [states, setStates] = useState({ new: 0, learning: 0, review: 0 });

  useEffect(() => {
    void db.reviews.toArray().then(setReviews);
    void db.cards.toArray().then((cards) =>
      setStates({
        new: cards.filter((c) => c.state === State.New).length,
        learning: cards.filter((c) => c.state === State.Learning || c.state === State.Relearning).length,
        review: cards.filter((c) => c.state === State.Review).length,
      }),
    );
  }, []);

  const data = useMemo(() => {
    if (!reviews) return null;
    const perDay = reviewsPerDay(reviews);
    const cells = heatmap(perDay);
    return {
      streak: computeStreak(perDay),
      today: perDay.get(dayKey(new Date())) ?? 0,
      cells,
      max: Math.max(0, ...cells.map((c) => c.count)),
      retention: weeklyRetention(reviews),
      retention30: retentionSince(reviews, 30),
    };
  }, [reviews]);

  if (!reviews || !data) return null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Kpi label="Série en cours" value={`${data.streak.current} j`} hint={`record : ${data.streak.best} j`} />
        <Kpi label="Révisions aujourd’hui" value={String(data.today)} hint={`${reviews.length} au total`} />
        <Kpi label="Rétention (30 j)" value={data.retention30 === null ? '—' : `${Math.round(data.retention30 * 100)} %`} hint="objectif : 90 %" />
        <Kpi label="Cartes" value={String(states.new + states.learning + states.review)} hint={`${states.review} mûres · ${states.learning} en cours · ${states.new} nouvelles`} />
      </div>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Flame size={18} className="text-warn" />
          <h2 className="font-display text-xl">Révisions (18 semaines)</h2>
        </div>
        <div className="overflow-x-auto">
          <div className="grid w-max grid-flow-col grid-rows-7 gap-1">
            {data.cells.map((c) => (
              <div
                key={c.key}
                title={`${c.key} : ${c.count} révision${c.count > 1 ? 's' : ''}`}
                className={`size-[15px] rounded-[3px] ${c.future ? 'opacity-0' : LEVEL[heatLevel(c.count, data.max)]}`}
              />
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">Lundi en haut, dimanche en bas. Plus la case est foncée, plus tu as révisé.</p>
      </Card>

      <Card>
        <h2 className="mb-1 font-display text-xl">Courbe de rétention</h2>
        <p className="mb-3 text-sm text-muted">Part des cartes « à revoir » réussies chaque semaine (la ligne pointillée marque 90 %).</p>
        <RetentionChart points={data.retention} />
      </Card>
    </div>
  );
}
