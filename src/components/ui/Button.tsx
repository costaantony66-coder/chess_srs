import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'good' | 'bad' | 'warn';

const styles: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-110',
  ghost: 'bg-surface-2 text-fg hover:brightness-95 dark:hover:brightness-125',
  good: 'bg-good/15 text-good hover:bg-good/25',
  bad: 'bg-bad/15 text-bad hover:bg-bad/25',
  warn: 'bg-warn/15 text-warn hover:bg-warn/25',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export function Button({ variant = 'ghost', className = '', ...props }: Props) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${styles[variant]} ${className}`}
    />
  );
}
