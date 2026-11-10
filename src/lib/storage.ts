/** Stockage persistant : demande au navigateur de ne pas effacer les données de l'app quand l'espace manque. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export interface StorageStatus {
  supported: boolean;
  persisted: boolean;
  usage?: number;
  quota?: number;
}

export async function getStorageStatus(): Promise<StorageStatus> {
  try {
    const supported = !!navigator.storage?.persist;
    const persisted = supported ? ((await navigator.storage.persisted?.()) ?? false) : false;
    const est = await navigator.storage?.estimate?.();
    return { supported, persisted, usage: est?.usage, quota: est?.quota };
  } catch {
    return { supported: false, persisted: false };
  }
}

export const formatBytes = (n?: number) => {
  if (n === undefined) return '—';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} Ko`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
};
