// Everything precious that is not the dictionary: scores, the shared streak,
// personal corrections, and the two per-game preferences that exist today.
// In-progress game saves are deliberately excluded — restoring a half-played
// board onto another device, weeks later, would show a state nobody chose,
// and none of it is precious the way a streak or a record is. The closed
// list of keys below was read off the actual codebase (a grep of every
// `storage.get`/`storage.set` call), not guessed.

const VERSION = 1;

const PREFERENCE_KEYS = ['sequence.vitesse', 'sequence.muet'];

export function exportBackup(storage, gameIds) {
  const stats = {};
  for (const id of gameIds) {
    const saved = storage.get(`stats.${id}`, null);
    if (saved !== null) stats[id] = saved;
  }
  const preferences = {};
  for (const key of PREFERENCE_KEYS) {
    const saved = storage.get(key, undefined);
    if (saved !== undefined) preferences[key] = saved;
  }
  return {
    version: VERSION,
    exportedAt: new Date().toISOString(),
    stats,
    streak: storage.get('streak', null),
    corrections: storage.get('corrections', null),
    preferences,
  };
}

/**
 * The shape check that decides whether to trust a file at all. Every value
 * this then writes through is re-validated by its own reader downstream
 * (core/stats.js's asHistory/asStreak, main.js's correctionsFrom, each
 * screen's own preference guard) — this function only has to reject
 * something that is not recognisably a backup, not re-implement each of
 * those readers' own rules.
 */
function asBackup(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  if (raw.version !== VERSION) return null;
  if (typeof raw.stats !== 'object' || raw.stats === null || Array.isArray(raw.stats)) return null;
  if (typeof raw.preferences !== 'object' || raw.preferences === null
      || Array.isArray(raw.preferences)) return null;
  return raw;
}

export function importBackup(storage, gameIds, raw) {
  const backup = asBackup(raw);
  if (!backup) return false;

  for (const id of gameIds) {
    if (id in backup.stats) storage.set(`stats.${id}`, backup.stats[id]);
  }
  if (backup.streak !== null && backup.streak !== undefined) {
    storage.set('streak', backup.streak);
  }
  if (backup.corrections !== null && backup.corrections !== undefined) {
    storage.set('corrections', backup.corrections);
  }
  for (const key of PREFERENCE_KEYS) {
    if (key in backup.preferences) storage.set(key, backup.preferences[key]);
  }
  return true;
}
