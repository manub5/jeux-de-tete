// core/router.js
// Hash routing. The read/write functions are injected so the router can be
// tested without a browser.

export function createRouter({
  routes,
  container,
  fallback,
  readHash = () => globalThis.location.hash,
  writeHash = (value) => { globalThis.location.hash = value; },
  onError = () => {},
}) {
  let cleanup = null;
  let current = null;

  function open(name) {
    const route = routes[name] ? name : fallback;
    // Opening the route that is already open would tear it down and rebuild it,
    // which on the game screen means destroying the game in progress. It would
    // happen on every navigation: `go()` opens the route, then writes the hash,
    // and the hashchange listener arrives here a second time with the same name.
    if (route === current) return;
    if (cleanup) {
      const leaving = cleanup;
      // Forget it before running it: a screen that fails to tear itself down
      // must not be run again, and must not trap the player on it either.
      cleanup = null;
      try {
        leaving();
      } catch (error) {
        console.error('nettoyage de route', error);
      }
    }
    // Forget the old route before mounting the new one. If the mount throws,
    // the router must not be left pointing at a screen that never appeared —
    // the guard above would then refuse every attempt to open it again, and
    // the player would be stuck with no way back.
    current = null;
    container.replaceChildren();
    // Only a function is a cleanup. An arrow function written without braces
    // returns whatever its expression evaluates to, and keeping that as the
    // cleanup would crash on the next navigation — a long way from the mistake.
    try {
      const result = routes[route](container);
      cleanup = typeof result === 'function' ? result : null;
      current = route;
    } catch (error) {
      // The router has no UI of its own: it logs the technical detail once,
      // here, and hands the failure to the caller's onError so a real screen
      // (with a way out) can be shown. `current` is left as the `null` it was
      // set to above, so the route can be tried again — a screen that never
      // appeared must not be remembered as open. `cleanup` is left as the
      // `null` it was set to above too: nothing mounted, so there is nothing
      // to tear down on the next navigation. The container is cleared again
      // in case the failing mount partially built a screen before throwing —
      // he must never be left staring at a fragment of a broken page.
      console.error('montage de route', error);
      container.replaceChildren();
      onError(error, container);
    }
  }

  return {
    start() {
      open(readHash().replace(/^#/, ''));
    },
    go(name) {
      writeHash(`#${name}`);
      open(name);
    },
  };
}
