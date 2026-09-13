import test from 'node:test';
import assert from 'node:assert/strict';
import { createSound } from '../../../games/sequence/son.js';
import { ZONES } from '../../../games/sequence/zones.js';

/** A stand-in for AudioContext that records what would have been played. */
function fauxContexte({ etat = 'suspended' } = {}) {
  const joues = [];
  const contexte = {
    state: etat,
    currentTime: 0,
    resume() { contexte.state = 'running'; return Promise.resolve(); },
    createOscillator() {
      const o = { type: '', frequency: { value: 0 },
                  connect() {}, start() {}, stop() {} };
      o.start = () => joues.push({ type: o.type, hz: o.frequency.value });
      return o;
    },
    createGain() {
      return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {},
                       exponentialRampToValueAtTime() {} },
               connect() {} };
    },
    destination: {},
    fermetures: 0,
    close() { contexte.fermetures += 1; },
    joues,
  };
  return contexte;
}

test('sans Web Audio, tout marche quand même, en silence', () => {
  const son = createSound({ audioContext: null });
  assert.equal(son.disponible, false);
  son.play('rond');            // ne doit pas lever
  son.setMuted(true);
  assert.equal(son.muted, true);
});

test('chaque zone joue sa hauteur et son timbre', async () => {
  const contexte = fauxContexte();
  const son = createSound({ audioContext: contexte });
  await son.resume();
  for (const zone of ZONES) son.play(zone.id);
  assert.equal(contexte.joues.length, ZONES.length);
  for (const [i, zone] of ZONES.entries()) {
    assert.equal(contexte.joues[i].hz, zone.hz, zone.id);
    assert.equal(contexte.joues[i].type, zone.onde, zone.id);
  }
});

test('le son coupé ne joue rien du tout', async () => {
  const contexte = fauxContexte();
  const son = createSound({ audioContext: contexte });
  await son.resume();
  son.setMuted(true);
  son.play('rond');
  assert.equal(contexte.joues.length, 0);
  son.setMuted(false);
  son.play('rond');
  assert.equal(contexte.joues.length, 1);
});

test('resume() réveille un contexte suspendu — la règle d\'Android', async () => {
  const contexte = fauxContexte({ etat: 'suspended' });
  const son = createSound({ audioContext: contexte });
  assert.equal(contexte.state, 'suspended');
  await son.resume();
  assert.equal(contexte.state, 'running');
});

test('jouer sans avoir réveillé le contexte ne lève pas, et ne joue rien', () => {
  const contexte = fauxContexte({ etat: 'suspended' });
  const son = createSound({ audioContext: contexte });
  son.play('rond');   // silencieux, pas une exception
  assert.equal(contexte.joues.length, 0,
    'un contexte encore suspendu ne doit rien jouer — c’est la règle d’Android');
});

test('une zone inconnue ne joue rien et ne lève pas', async () => {
  const contexte = fauxContexte();
  const son = createSound({ audioContext: contexte });
  await son.resume();
  son.play('trompette');
  assert.equal(contexte.joues.length, 0);
});

test('un contexte qui refuse de démarrer laisse le jeu jouable', async () => {
  const contexte = fauxContexte();
  contexte.resume = () => Promise.reject(new Error('refusé'));
  const son = createSound({ audioContext: contexte });
  await son.resume();          // ne doit pas rejeter
  son.play('rond');            // ne doit pas lever
});

test('close() libère le contexte audio', () => {
  const contexte = fauxContexte();
  const son = createSound({ audioContext: contexte });
  son.close();
  assert.equal(contexte.fermetures, 1);
});

test('close() n’échappe pas si contexte.close() rejette (déjà fermé)', async () => {
  // AudioContext.close() rejette une InvalidStateError sur un contexte déjà
  // fermé — un simple try/catch synchrone ne garde pas ce rejet, seulement
  // un lever immédiat.
  const contexte = fauxContexte();
  contexte.close = () => Promise.reject(new Error('déjà fermé'));
  const son = createSound({ audioContext: contexte });
  await son.close();   // ne doit pas rejeter
});

test('close() sans contexte ne lève pas', () => {
  const son = createSound({ audioContext: null });
  son.close();   // silencieux, pas une exception
});
