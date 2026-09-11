import test from 'node:test';
import assert from 'node:assert/strict';
import { SYMBOLES } from '../../../games/paires/symboles.js';

test('il y a exactement trente symboles', () => {
  assert.equal(SYMBOLES.length, 30);
});

test('aucun identifiant ni libellé en double', () => {
  assert.equal(new Set(SYMBOLES.map((s) => s.id)).size, 30);
  assert.equal(new Set(SYMBOLES.map((s) => s.libelle)).size, 30);
});

test('chaque symbole porte un libellé français lisible à voix haute', () => {
  for (const symbole of SYMBOLES) {
    assert.match(symbole.libelle, /^[a-zàâçéèêëîïôûùüÿñæœ0-9 '’-]+$/,
      `« ${symbole.libelle} » doit être un mot français en minuscules`);
    assert.ok(symbole.libelle.length >= 3, `« ${symbole.libelle} » est trop court`);
  }
});

test('chaque tracé est du SVG, et rien d’autre', () => {
  for (const symbole of SYMBOLES) {
    assert.match(symbole.corps, /<(path|circle|rect|g|polygon)\b/,
      `${symbole.id} ne trace rien`);
    assert.doesNotMatch(symbole.corps, /<script|onload|href/i,
      `${symbole.id} contient autre chose qu’un tracé`);
    assert.doesNotMatch(symbole.corps, /fill="(?!currentColor|none)/,
      `${symbole.id} fixe une couleur au lieu d’hériter de currentColor`);
  }
});
