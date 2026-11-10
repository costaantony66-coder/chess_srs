import type { RatingId } from '../../lib/fsrs';
import { Button } from './Button';

const RATINGS: { id: RatingId; label: string; variant: 'bad' | 'warn' | 'good' | 'primary' }[] = [
  { id: 'again', label: 'Again', variant: 'bad' },
  { id: 'hard', label: 'Hard', variant: 'warn' },
  { id: 'good', label: 'Good', variant: 'good' },
  { id: 'easy', label: 'Easy', variant: 'primary' },
];

type Props = {
  onRate?: (r: RatingId) => void;
  /** Désactive tout. */
  disabled?: boolean;
  /** Notes autorisées (toutes par défaut). */
  enabled?: RatingId[];
  /** Délai avant la prochaine révision, affiché sous chaque note. */
  intervals?: Record<RatingId, string>;
  /** Affiche la touche du clavier (1 à 4) sous chaque note, sur ordinateur. */
  showKeys?: boolean;
};

export function RatingButtons({ onRate, disabled, enabled, intervals, showKeys }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {RATINGS.map((r, i) => (
        <Button
          key={r.id}
          variant={r.variant}
          disabled={disabled || (enabled ? !enabled.includes(r.id) : false)}
          onClick={() => onRate?.(r.id)}
          className="h-auto flex-col gap-0 py-2"
        >
          <span>{r.label}</span>
          {intervals && <span className="text-xs font-normal opacity-70">{intervals[r.id]}</span>}
          {showKeys && <span className="hidden text-[10px] font-normal opacity-60 md:block">touche {i + 1}</span>}
        </Button>
      ))}
    </div>
  );
}
