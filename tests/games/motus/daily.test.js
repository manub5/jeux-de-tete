import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../../../core/storage.js';
import { createLexicon } from '../../../lexicon/lexicon.js';
import { signature } from '../../../lexicon/signature.js';
import { SAVE_KEY, createDaily } from '../../../games/motus/daily.js';

const MOTS = ['bonjour', 'comment', 'regarde', 'appelle', 'attends', 'certain'];
// `certain` is in the dictionary but never in the frequencies, so it is always a
// legal attempt and can never be the answer. The resume test needs an attempt
// that is guaranteed not to end the game.
const FREQUENTS = ['bonjour', 'comment', 'regarde', 'appelle', 'attends'];

function backend() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function outils(storage) {
  const index = new Map();
  for (const mot of MOTS) {
    const clef = signature(mot);
    if (!index.has(clef)) index.set(clef, []);
    index.get(clef).push(mot);
  }
  return {
    lexicon: createLexicon(index, { accepted: new Set(), rejected: new Set(), save() {} }),
    storage,
    frequencies: new Map(FREQUENTS.map((mot) => [mot, 10])),
  };
}

test('a fresh day opens a game that has not been played', () => {
  const jour = createDaily({ ...outils(createStorage(backend())), day: '2026-09-11' });
  assert.equal(jour.alreadyPlayed, false);
  assert.equal(jour.result, null);
  assert.equal(jour.game.phase, 'recherche');
});

test('the same day gives the same word to two openings', () => {
  const store = createStorage(backend());
  const premier = createDaily({ ...outils(store), day: '2026-09-11' });
  const second = createDaily({ ...outils(store), day: '2026-09-11' });
  assert.equal(premier.game.firstLetter, second.game.firstLetter);
  assert.equal(premier.game.length, second.game.length);
});

test('a game in progress comes back with its rows', () => {
  const store = createStorage(backend());
  const premier = createDaily({ ...outils(store), day: '2026-09-11' });
  const essai = 'certain';
  premier.game.propose(essai);

  const reprise = createDaily({ ...outils(store), day: '2026-09-11' });
  assert.equal(reprise.alreadyPlayed, false);
  assert.equal(reprise.game.attempts, 1);
  assert.equal(reprise.game.rows[0].word, essai);
});

test('a finished day stays finished, and hands back its result', () => {
  const store = createStorage(backend());
  const premier = createDaily({ ...outils(store), day: '2026-09-11' });
  premier.game.giveUp();

  const reprise = createDaily({ ...outils(store), day: '2026-09-11' });
  assert.equal(reprise.alreadyPlayed, true);
  assert.equal(reprise.result.won, false);
  assert.equal(reprise.result.score, 7);
});

test('the next day is a new game, and the old save is gone', () => {
  const store = createStorage(backend());
  createDaily({ ...outils(store), day: '2026-09-11' }).game.giveUp();
  const lendemain = createDaily({ ...outils(store), day: '2026-09-12' });
  assert.equal(lendemain.alreadyPlayed, false);
  assert.equal(lendemain.game.attempts, 0);
  assert.equal(store.get(SAVE_KEY, null).day, '2026-09-12');
});

test('a save of the wrong shape is ignored rather than crashing', () => {
  const back = backend();
  back.setItem('jp:motus.jour', '{"day":"2026-09-11","rows":"pas un tableau"}');
  const jour = createDaily({ ...outils(createStorage(back)), day: '2026-09-11' });
  assert.equal(jour.game.attempts, 0);
  assert.equal(jour.alreadyPlayed, false);
});

test('a saved row that is no longer a valid attempt is dropped, not replayed', () => {
  const back = backend();
  back.setItem('jp:motus.jour',
    JSON.stringify({ day: '2026-09-11', rows: ['zzzzzzz'], finished: false }));
  const jour = createDaily({ ...outils(createStorage(back)), day: '2026-09-11' });
  assert.equal(jour.game.attempts, 0);
});
