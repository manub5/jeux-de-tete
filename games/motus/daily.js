// games/motus/daily.js
// The day's game: drawn from the date, saved after every attempt, played once.
//
// "Once a day" only means anything if the game survives the app closing. He
// puts the phone down at the third attempt and comes back in the evening to the
// same grid — not to a lost day.

import { createMotus } from './game.js';
import { DAILY_LENGTH, dailyWord } from './pick.js';

export const SAVE_KEY = 'motus.jour';

/**
 * Only the attempts are stored, never the marks or the word: replaying the
 * attempts through the same rules rebuilds everything, and a save that cannot
 * disagree with the rules cannot show him a wrong grid.
 */
function asSaved(raw, day) {
  if (typeof raw !== 'object' || raw === null) return null;
  if (raw.day !== day) return null;
  // A `rows` of the wrong shape is not a save to be salvaged: reading it as an
  // empty game would leave the bad value sitting in storage. Refuse it outright
  // and let a fresh day overwrite it.
  if (!Array.isArray(raw.rows)) return null;
  const rows = raw.rows.filter((w) => typeof w === 'string');
  return { rows, finished: raw.finished === true };
}

export function createDaily({ lexicon, storage, frequencies, day, mayRestart = true }) {
  const word = dailyWord(frequencies, day);
  const game = createMotus({ lexicon, frequencies, length: DAILY_LENGTH, word });
  const saved = asSaved(storage.get(SAVE_KEY, null), day);

  function save() {
    storage.set(SAVE_KEY, {
      day,
      rows: game.rows.map((row) => row.word),
      finished: game.phase === 'terminée',
    });
  }

  if (saved) {
    for (const attempt of saved.rows) {
      if (game.phase === 'terminée') break;
      // A saved attempt that the rules refuse today is dropped rather than
      // forced in: the dictionary may have changed under the save.
      game.propose(attempt);
    }
    if (game.attempts !== saved.rows.length) {
      // Some saved attempt no longer replays — the dictionary changed under the
      // save, so the grid we could rebuild is not the grid he played. Closing
      // the game here would announce a loss he may not have had, and showing a
      // short grid would be a quiet lie. Start the day again: handing him back
      // a puzzle is honest, telling him he lost is not.
      storage.remove(SAVE_KEY);
      // One restart, never two. `storage.remove` swallows a failing backend
      // rather than throwing, so a browser that refuses to forget would send us
      // round this path for ever — and an application that will not open is the
      // one failure he could not diagnose. A second pass plays on with whatever
      // replayed instead.
      if (mayRestart) {
        return createDaily({ lexicon, storage, frequencies, day, mayRestart: false });
      }
    }
    // Every row replayed, so the save is faithful. A save marked finished whose
    // rows did not end the game means he gave up — that is what giveUp()
    // reconstructs, and it is the only thing it can mean here.
    if (saved.finished && game.phase !== 'terminée') game.giveUp();
  } else {
    save();
  }

  const propose = game.propose;
  const giveUp = game.giveUp;
  // Every change to the grid is written down straight away: he may close the
  // application between two attempts and there is no other moment to save.
  game.propose = (input) => {
    const answer = propose(input);
    if (answer.ok) save();
    return answer;
  };
  game.giveUp = () => {
    const answer = giveUp();
    save();
    return answer;
  };

  return {
    game,
    alreadyPlayed: game.phase === 'terminée',
    result: game.result,
  };
}
