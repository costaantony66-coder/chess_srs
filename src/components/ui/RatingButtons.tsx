import { Button } from './Button';

export type Rating = 'again' | 'hard' | 'good' | 'easy';

const RATINGS: { id: Rating; label: string; variant: 'bad' | 'warn' | 'good' | 'primary' }[] = [
  { id: 'again', label: 'Again', variant: 'bad' },
  { id: 'hard', label: 'Hard', variant: 'warn' },
  { id: 'good', label: 'Good', variant: 'good' },
  { id: 'easy', label: 'Easy', variant: 'primary' },
];

/** Les 4 notes FSRS. Branchées sur le planificateur en phase 2. */
export function RatingButtons({ onRate, disabled }: { onRate?: (r: Rating) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {RATINGS.map((r) => (
        <Button key={r.id} variant={r.variant} disabled={disabled} onClick={() => onRate?.(r.id)}>
          {r.label}
        </Button>
      ))}
    </div>
  );
}
