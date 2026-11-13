import { motion } from 'framer-motion';
import { FILES, RANKS, isDarkSquare } from '../../lib/coords';

export type SquareFlash = { square: string; kind: 'good' | 'bad'; id: number };

type Props = {
  orientation: 'white' | 'black';
  onSquare?: (square: string) => void;
  /** Affiche les lettres et chiffres (aide). */
  showCoords?: boolean;
  flash?: SquareFlash | null;
  /** Intensité de 0 à 1 par case : carte de chaleur des cases ratées. */
  heat?: Record<string, number>;
  disabled?: boolean;
  className?: string;
};

/** Échiquier vierge cliquable (sans pièces) pour s'entraîner aux coordonnées. */
export function SquareBoard({ orientation, onSquare, showCoords, flash, heat, disabled, className }: Props) {
  const white = orientation === 'white';
  const ranks = white ? [...RANKS].reverse() : [...RANKS];
  const files = white ? [...FILES] : [...FILES].reverse();
  const bottomRank = ranks[ranks.length - 1];
  const leftFile = files[0];

  return (
    <div className={`grid aspect-square w-full grid-cols-8 overflow-hidden rounded-xl ${className ?? ''}`} role="grid" aria-label="Échiquier vierge">
      {ranks.flatMap((r) =>
        files.map((f) => {
          const sq = `${f}${r}`;
          const h = heat?.[sq];
          return (
            <button
              key={sq}
              type="button"
              role="gridcell"
              aria-label={sq}
              data-square={sq}
              disabled={disabled || !onSquare}
              onClick={() => onSquare?.(sq)}
              className="relative aspect-square touch-manipulation select-none disabled:cursor-default"
              style={{ background: isDarkSquare(sq) ? 'var(--sq-dark)' : 'var(--sq-light)' }}
            >
              {h !== undefined && h > 0 && (
                <span className="pointer-events-none absolute inset-0" style={{ background: `color-mix(in srgb, var(--bad) ${Math.round(25 + 65 * h)}%, transparent)` }} />
              )}
              {flash?.square === sq && (
                <motion.span
                  key={flash.id}
                  initial={{ opacity: 0.75 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="pointer-events-none absolute inset-0"
                  style={{ background: flash.kind === 'good' ? 'var(--good)' : 'var(--bad)' }}
                />
              )}
              {showCoords && f === leftFile && <span className="sq-coord left-1 top-1">{r}</span>}
              {showCoords && r === bottomRank && <span className="sq-coord bottom-1 right-1 uppercase">{f}</span>}
            </button>
          );
        }),
      )}
    </div>
  );
}
