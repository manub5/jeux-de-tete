// core/update.js
// Registers the service worker and tells the page when a new version waits.

export function registerServiceWorker(onUpdateReady) {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('sw.js').then((registration) => {
    // A worker already waiting means an update arrived while the page was shut.
    if (registration.waiting && navigator.serviceWorker.controller) {
      onUpdateReady(() => registration.waiting.postMessage('passer-a-la-nouvelle-version'));
    }
    registration.addEventListener('updatefound', () => {
      const incoming = registration.installing;
      if (!incoming) return;
      incoming.addEventListener('statechange', () => {
        if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
          onUpdateReady(() => incoming.postMessage('passer-a-la-nouvelle-version'));
        }
      });
    });
  }).catch((error) => {
    // Not fatal: the app works, it just will not be available offline.
    console.warn('service worker non enregistré', error);
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    globalThis.location.reload();
  });
}
