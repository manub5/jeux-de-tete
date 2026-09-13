import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../../core/storage.js';
import { exportBackup, importBackup } from '../../core/backup.js';

const IDS = ['mot-le-plus-long', 'sudoku', 'paires'];

function fakeBackend(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test('un export relu par l\'import redonne exactement l\'état de départ', () => {
  const depart = createStorage(fakeBackend());
  depart.set('stats.sudoku', { played: 4, best: 2, recent: [2, 3, 2], lastPlayed: '2026-09-01' });
  depart.set('stats.paires', { played: 1, best: 30, recent: [30], lastPlayed: '2026-09-02' });
  depart.set('streak', { days: 5, lastDay: '2026-09-02' });
  depart.set('corrections', { accepted: ['zzz'], rejected: ['qqq'] });
  depart.set('sequence.vitesse', 'rapide');
  depart.set('sequence.muet', true);
  // Une partie en cours, jamais sauvegardée : présente dans le stockage de
  // départ pour prouver qu'elle ne traverse pas l'export.
  depart.set('paires.partie', { niveau: 'facile', flips: 2, phase: 'en cours', cards: [] });

  const sauvegarde = JSON.parse(JSON.stringify(exportBackup(depart, IDS)));
  assert.ok(!JSON.stringify(sauvegarde).includes('paires.partie'),
    'une partie en cours ne doit apparaître nulle part dans le fichier exporté');

  const arrivee = createStorage(fakeBackend());
  const ok = importBackup(arrivee, IDS, sauvegarde);
  assert.equal(ok, true);

  assert.deepEqual(arrivee.get('stats.sudoku', null), depart.get('stats.sudoku', null));
  assert.deepEqual(arrivee.get('stats.paires', null), depart.get('stats.paires', null));
  assert.deepEqual(arrivee.get('streak', null), depart.get('streak', null));
  assert.deepEqual(arrivee.get('corrections', null), depart.get('corrections', null));
  assert.equal(arrivee.get('sequence.vitesse', null), 'rapide');
  assert.equal(arrivee.get('sequence.muet', null), true);
  assert.equal(arrivee.get('paires.partie', null), null,
    'la partie en cours ne doit jamais être écrite par une restauration');
});

test('un jeu jamais joué est absent de l\'export, pas mis à zéro', () => {
  const storage = createStorage(fakeBackend());
  storage.set('stats.sudoku', { played: 1, best: 5, recent: [5], lastPlayed: '2026-09-01' });
  const sauvegarde = exportBackup(storage, IDS);
  assert.ok(!('mot-le-plus-long' in sauvegarde.stats));
  assert.ok(!('paires' in sauvegarde.stats));
  assert.ok('sudoku' in sauvegarde.stats);
});

test('importBackup refuse un fichier qui n\'a pas la forme d\'une sauvegarde', () => {
  const storage = createStorage(fakeBackend());
  storage.set('stats.sudoku', { played: 9, best: 1, recent: [1], lastPlayed: '2026-09-01' });
  for (const bogus of [null, 42, 'bonjour', [], {}, { version: 2, stats: {}, preferences: {} },
                       { version: 1, stats: 'non', preferences: {} },
                       { version: 1, stats: {}, preferences: null }]) {
    assert.equal(importBackup(storage, IDS, bogus), false, JSON.stringify(bogus));
  }
  // Rien n'a été touché par les tentatives refusées.
  assert.deepEqual(storage.get('stats.sudoku', null),
    { played: 9, best: 1, recent: [1], lastPlayed: '2026-09-01' });
});

test('importer une sauvegarde sans corrections ni préférences n\'écrit pas de valeurs vides à leur place', () => {
  const storage = createStorage(fakeBackend());
  storage.set('corrections', { accepted: ['deja-la'], rejected: [] });
  const sauvegardeMinimale = { version: 1, stats: {}, preferences: {} };
  assert.equal(importBackup(storage, IDS, sauvegardeMinimale), true);
  assert.deepEqual(storage.get('corrections', null), { accepted: ['deja-la'], rejected: [] },
    'une sauvegarde qui ne parle pas des corrections ne doit pas les effacer');
});
