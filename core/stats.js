// Per-game counters plus one streak shared by every game.

import { todayKey } from './rng.js';

const RECENT = 10;

/**
 * A stored value that parses but has the wrong shape must never break the game.
 * `storage.get` only falls back when the text is unparseable, so a half-written
 * record, or one left behind by an older version of this file, would otherwise
 * throw out of `record()` the next time a game ends — the exact failure the
 * storage layer was built to prevent. Anything unrecognisable reads as no
 * history at all.
 */
function asHistory(saved) {
  if (typeof saved !== 'object' || saved === null) {
    return { played: 0, best: 0, recent: [], lastPlayed: null };
  }
  return {
    played: Number.isFinite(saved.played) ? saved.played : 0,
    best: Number.isFinite(saved.best) ? saved.best : 0,
    recent: Array.isArray(saved.recent) ? saved.recent.filter(Number.isFinite) : [],
    lastPlayed: typeof saved.lastPlayed === 'string' ? saved.lastPlayed : null,
  };
}

function asStreak(saved) {
  if (typeof saved !== 'object' || saved === null) {
    return { days: 0, lastDay: null };
  }
  return {
    days: Number.isFinite(saved.days) ? saved.days : 0,
    lastDay: typeof saved.lastDay === 'string' ? saved.lastDay : null,
  };
}

function previousDay(key) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return todayKey(date);
}

export function createStats(storage) {
  function read(gameId) {
    const saved = asHistory(storage.get(`stats.${gameId}`, null));
    const total = saved.recent.reduce((sum, score) => sum + score, 0);
    const average = saved.recent.length
      ? Math.round((total / saved.recent.length) * 10) / 10
      : 0;
    return {
      played: saved.played,
      best: saved.best,
      average,
      lastPlayed: saved.lastPlayed,
    };
  }

  function record(gameId, score, today = todayKey()) {
    const saved = asHistory(storage.get(`stats.${gameId}`, null));
    saved.played += 1;
    saved.best = Math.max(saved.best, score);
    saved.recent = [...saved.recent, score].slice(-RECENT);
    saved.lastPlayed = today;
    storage.set(`stats.${gameId}`, saved);
    updateStreak(today);
  }

  function updateStreak(today) {
    const streak = asStreak(storage.get('streak', null));
    if (streak.lastDay === today) return;
    streak.days = streak.lastDay === previousDay(today) ? streak.days + 1 : 1;
    streak.lastDay = today;
    storage.set('streak', streak);
  }

  function streak() {
    return asStreak(storage.get('streak', null)).days;
  }

  return { read, record, streak };
}
