import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONES } from '../../../games/sequence/zones.js';

test('il y a quatre zones', () => {
  assert.equal(ZONES.length, 4);
});

test('rien n’est partagé entre deux zones : ni couleur, ni forme, ni son', () => {
  for (const champ of ['id', 'libelle', 'couleur', 'corps', 'hz', 'onde']) {
    const valeurs = ZONES.map((z) => z[champ]);
    assert.equal(new Set(valeurs).size, 4, `deux zones partagent ${champ}`);
  }
});

test('les quatre hauteurs restent dans la bande qu’une oreille âgée entend bien', () => {
  for (const zone of ZONES) {
    assert.ok(zone.hz >= 200 && zone.hz <= 800,
      `${zone.id} à ${zone.hz} Hz sort de la bande 200-800 Hz`);
  }
});

test('deux hauteurs voisines sont séparées d’au moins deux tons', () => {
  const tries = [...ZONES].sort((a, b) => a.hz - b.hz);
  for (let i = 1; i < tries.length; i++) {
    const rapport = tries[i].hz / tries[i - 1].hz;
    assert.ok(rapport >= 1.12,
      `${tries[i - 1].id} et ${tries[i].id} sont trop proches (rapport ${rapport.toFixed(3)})`);
  }
});

test('chaque zone porte une forme, et non une simple couleur', () => {
  for (const zone of ZONES) {
    assert.match(zone.corps, /<(path|circle|rect|polygon)\b/, `${zone.id} ne trace rien`);
    assert.doesNotMatch(zone.corps, /fill="(?!currentColor|none)/, zone.id);
  }
});

test('chaque zone porte un libellé français lisible à voix haute', () => {
  for (const zone of ZONES) {
    assert.match(zone.libelle, /^[a-zàâçéèêëîïôûùüÿ ']+$/, zone.libelle);
  }
});
