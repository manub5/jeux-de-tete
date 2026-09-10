// core/router.js
// Hash routing. The read/write functions are injected so the router can be
// tested without a browser.

export function createRouter({
  routes,
  container,
  fallback,
  readHash = () => globalThis.location.hash,
  writeHash = (value) => { globalThis.location.hash = value; },
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
    if (cleanup) cleanup();
    container.replaceChildren();
    current = route;
    // Only a function is a cleanup. An arrow function written without braces
    // returns whatever its expression evaluates to, and keeping that as the
    // cleanup would crash on the next navigation — a long way from the mistake.
    const result = routes[route](container);
    cleanup = typeof result === 'function' ? result : null;
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
