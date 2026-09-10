// Seeded pseudo-random generator. Deterministic on purpose: the same seed must
// replay the same game, on any device, forever.

/** Mulberry32: small, fast, good enough for a word game. */
export function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a, folded to a 32 bit unsigned integer. */
export function seedFromString(text) {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Local calendar date as AAAA-MM-JJ. Deliberately not toISOString(), which
 * would shift the player's day whenever they play late in the evening.
 */
export function todayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Weighted pick. Items with weight 0 can never come out. */
export function pickWeighted(rng, items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) {
    throw new Error('pickWeighted: total weight must be positive');
  }
  let threshold = rng() * total;
  for (const item of items) {
    threshold -= item.weight;
    if (threshold < 0) return item.value;
  }
  // Only reachable through floating point drift on the very last item.
  return items[items.length - 1].value;
}
