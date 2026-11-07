import type { ReactNode } from 'react';
import { ROOT } from '../../db/repertoire';
import type { RepNode } from '../../db/db';

type Props = {
  children: Map<string, RepNode[]>;
  currentId: string;
  /** Couleur du répertoire : tes coups sont en gras. */
  color: 'white' | 'black';
  onSelect: (id: string) => void;
};

export function MoveTree({ children, currentId, color, onSelect }: Props) {
  const mine = (n: RepNode) => (n.ply % 2 === 1) === (color === 'white');

  const btn = (n: RepNode, forceNumber: boolean) => {
    const label = n.ply % 2 === 1 ? `${(n.ply + 1) / 2}.${n.san}` : forceNumber ? `${n.ply / 2}...${n.san}` : n.san;
    const active = n.id === currentId;
    return (
      <button
        key={n.id}
        onClick={() => onSelect(n.id)}
        className={`rounded px-1 py-0.5 font-mono text-sm transition ${
          active ? 'bg-accent text-accent-fg' : mine(n) ? 'font-semibold text-fg hover:bg-surface-2' : 'text-muted hover:bg-surface-2'
        }`}
      >
        {label}
        {n.comment && <span className="ml-0.5 text-xs">✎</span>}
      </button>
    );
  };

  const chain = (parentId: string, force: boolean): ReactNode[] => {
    const out: ReactNode[] = [];
    let pid = parentId;
    let need = force;
    for (;;) {
      const kids = children.get(pid);
      if (!kids?.length) break;
      const [main, ...alts] = kids;
      out.push(btn(main, need));
      need = false;
      for (const alt of alts) {
        out.push(
          <div key={`v-${alt.id}`} className="my-1 ml-3 border-l border-border pl-2">
            {btn(alt, true)} {chain(alt.id, false)}
          </div>,
        );
        need = true;
      }
      pid = main.id;
    }
    return out;
  };

  return <div className="flex flex-wrap items-center gap-x-0.5 gap-y-0.5 leading-7">{chain(ROOT, false)}</div>;
}
