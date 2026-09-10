// Every operation is wrapped: a browser that refuses to store must degrade the
// game to "nothing is kept", never break it.

const PREFIX = 'jp:';

export function createStorage(backend = globalThis.localStorage) {
  let available = false;
  try {
    const probe = `${PREFIX}__probe__`;
    backend.setItem(probe, '1');
    backend.removeItem(probe);
    available = true;
  } catch (error) {
    console.warn('stockage indisponible, les scores ne seront pas conservés', error);
  }

  function get(key, fallback) {
    if (!available) return fallback;
    try {
      const raw = backend.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      console.warn(`stockage : clé ${key} illisible`, error);
      return fallback;
    }
  }

  function set(key, value) {
    if (!available) return;
    try {
      backend.setItem(PREFIX + key, JSON.stringify(value));
    } catch (error) {
      console.warn(`stockage : écriture de ${key} impossible`, error);
    }
  }

  function remove(key) {
    if (!available) return;
    try {
      backend.removeItem(PREFIX + key);
    } catch (error) {
      console.warn(`stockage : suppression de ${key} impossible`, error);
    }
  }

  return { available, get, set, remove };
}
