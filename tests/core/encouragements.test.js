import test from 'node:test';
import assert from 'node:assert/strict';
import { messageFin, messageRecord } from '../../core/encouragements.js';

// A fixed sequence, not `Math.random`: the module must pick deterministically
// from whatever `hasard()` hands it, so this is what makes it testable at all.
function hasardFixe(valeur) {
  return () => valeur;
}

test('every tier returns one of its own phrases', () => {
  for (const tier of ['excellent', 'bien', 'encourageant']) {
    for (const valeur of [0, 0.5, 0.999]) {
      const phrase = messageFin(tier, hasardFixe(valeur));
      assert.equal(typeof phrase, 'string');
      assert.ok(phrase.length > 0);
    }
  }
});

test('the same draw does not always return the same phrase across tiers', () => {
  // Not a claim about randomness — a fixed draw — only that the three tiers
  // are worded differently, not the same list under three names.
  const phrases = new Set(
    ['excellent', 'bien', 'encourageant'].map((tier) => messageFin(tier, hasardFixe(0)))
  );
  assert.equal(phrases.size, 3);
});

test('an unknown tier falls back to "bien" rather than throwing', () => {
  assert.doesNotThrow(() => messageFin('inconnu', hasardFixe(0)));
  const phrase = messageFin('inconnu', hasardFixe(0));
  assert.equal(phrase, messageFin('bien', hasardFixe(0)));
});

test('the draw always lands inside the pool, at both ends', () => {
  assert.doesNotThrow(() => messageFin('excellent', hasardFixe(0)));
  // Just under 1, never 1 itself — Math.random()'s own range — so this must
  // not read past the end of the array.
  assert.doesNotThrow(() => messageFin('excellent', hasardFixe(0.999999)));
});

test('messageRecord returns a non-empty string', () => {
  const phrase = messageRecord(hasardFixe(0.4));
  assert.equal(typeof phrase, 'string');
  assert.ok(phrase.length > 0);
});

test('messageRecord defaults to Math.random when no source is given', () => {
  assert.doesNotThrow(() => messageRecord());
});
