/** Enregistre le service worker (production uniquement) et prépare l'usage hors ligne. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // Fichiers déjà chargés par la page (JS, CSS, polices…) : on les met en cache pour le hors-ligne.
        const urls = [location.href, ...performance.getEntriesByType('resource').map((e) => e.name)];
        reg.active?.postMessage({ type: 'CACHE_URLS', urls });
      })
      .catch(() => undefined);
  });
}
