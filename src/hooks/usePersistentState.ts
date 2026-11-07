import { useState } from 'react';

/** useState synchronisé avec localStorage (pseudo, préférences simples). */
export function usePersistentState(key: string, initial: string) {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });
  const set = (v: string) => {
    setValue(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      /* stockage indisponible */
    }
  };
  return [value, set] as const;
}
