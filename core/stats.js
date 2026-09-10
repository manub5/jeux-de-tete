// Per-game counters plus one streak shared by every game.

import { todayKey } from './rng.js';

const RECENT = 10;

function previousDay(key) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return todayKey(date);
}

export function createStats(storage) {
  function read(gameId) {
    const saved = storage.get(`stats.${gameId}`, null);
    if (!saved) return { played: 0, best: 0, average: 0, lastPlayed: null };
    const recent = saved.recent ?? [];
    const total = recent.reduce((sum, score) => sum + score, 0);
    const average = recent.length
      ? Math.round((total / recent.length) * 10) / 10
      : 0;
    return {
      played: saved.played,
      best: saved.best,
      average,
      lastPlayed: saved.lastPlayed ?? null,
    };
  }

  function record(gameId, score, today = todayKey()) {
    const saved = storage.get(`stats.${gameId}`, {
      played: 0, best: 0, recent: [], lastPlayed: null,
    });
    saved.played += 1;
    saved.best = Math.max(saved.best, score);
    saved.recent = [...saved.recent, score].slice(-RECENT);
    saved.lastPlayed = today;
    storage.set(`stats.${gameId}`, saved);
    updateStreak(today);
  }

  function updateStreak(today) {
    const streak = storage.get('streak', { days: 0, lastDay: null });
    if (streak.lastDay === today) return;
    streak.days = streak.lastDay === previousDay(today) ? streak.days + 1 : 1;
    streak.lastDay = today;
    storage.set('streak', streak);
  }

  function streak() {
    return storage.get('streak', { days: 0 }).days;
  }

  return { read, record, streak };
}
