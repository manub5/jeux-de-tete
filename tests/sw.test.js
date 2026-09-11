import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * `ASSETS`, in sw.js, is the whole offline application.
 *
 * A file missing from that list is fetched from the network and nowhere else:
 * online nobody notices, offline the game it belongs to opens on a blank
 * screen. That failure lands on him alone — the only player who runs this
 * without a network — and he has no way of naming it. An entry pointing at a
 * file that no longer exists is worse still: `cache.addAll` rejects as a
 * whole, so one stale line leaves *nothing* cached and the whole application
 * offline-dead.
 *
 * Both were checked by hand for four lots. That is exactly the arrangement
 * that put the stylesheet check in tests/css/collisions.test.js rather than in
 * a delivery ritual: a step you have to remember is a step you will forget.
 *
 * sw.js is not imported — it is a service worker, not a module: it reaches for
 * `self` and `caches` the moment it loads. The list is read from its text, the
 * way the stylesheets are read from theirs.
 */
function entreesDuCache(chemin = 'sw.js') {
  const texte = readFileSync(chemin, 'utf8');
  const bloc = /const ASSETS = \[([\s\S]*?)\];/.exec(texte);
  assert.ok(bloc, 'sw.js doit contenir un tableau ASSETS');
  return bloc[1]
    .split('\n')
    .map((ligne) => /^\s*'([^']*)',?\s*(?:\/\/.*)?$/.exec(ligne))
    .filter(Boolean)
    .map((trouve) => trouve[1]);
}

/** Les répertoires qui ne partent jamais au navigateur. */
const HORS_SITE = new Set(['.git', 'node_modules', 'tests', 'tools', 'docs', '.superpowers', '.github']);

/**
 * Ce que le navigateur peut aller chercher, par extension.
 *
 * `.gz` et non `.txt` : les données sont servies compressées, et
 * data/LICENCES.txt n'est lu par personne — c'est une note posée à côté des
 * fichiers, jamais une requête. De même `.png` et non `.svg` :
 * icons/icone.svg est la source dont les trois PNG sont tirés, et le
 * manifeste ne nomme que les PNG.
 */
const EXTENSIONS_SERVIES = ['.js', '.css', '.html', '.webmanifest', '.gz', '.png'];

/**
 * sw.js ne se met pas dans son propre cache : le navigateur va le chercher
 * lui-même, hors cache, pour savoir s'il a changé.
 */
const JAMAIS_EN_CACHE = new Set(['sw.js']);

function fichiersServis(dossier = '.') {
  const trouves = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    if (HORS_SITE.has(entree.name)) continue;
    const chemin = dossier === '.' ? entree.name : `${dossier}/${entree.name}`;
    if (entree.isDirectory()) trouves.push(...fichiersServis(chemin));
    else if (EXTENSIONS_SERVIES.some((fin) => entree.name.endsWith(fin))
      && !JAMAIS_EN_CACHE.has(chemin)) trouves.push(chemin);
  }
  return trouves.sort();
}

const ASSETS = entreesDuCache();
const SERVIS = fichiersServis();

test('tout fichier servi au navigateur est dans le cache hors ligne', () => {
  const listes = new Set(ASSETS);
  const oublies = SERVIS.filter((chemin) => !listes.has(chemin));
  assert.deepEqual(oublies, [],
    `sw.js ne met pas ces fichiers en cache : ${oublies.join(', ')}`);
});

test('toute entrée du cache hors ligne existe sur le disque', () => {
  // Une entrée morte ne rate pas toute seule : `cache.addAll` échoue en bloc,
  // et c'est l'application entière qui cesse de fonctionner hors ligne.
  const surDisque = new Set(SERVIS);
  // './' est la page d'accueil elle-même, la seule entrée qui ne nomme pas un
  // fichier ; index.html est listé à part et vérifié comme les autres.
  const fantomes = ASSETS.filter((chemin) => chemin !== './' && !surDisque.has(chemin));
  assert.deepEqual(fantomes, [],
    `sw.js met en cache des fichiers absents du dépôt : ${fantomes.join(', ')}`);
});

test('le contrôle sait lire sw.js et le dépôt', () => {
  // Sans cet auto-test, les deux précédents passeraient aussi bien si la
  // lecture d'ASSETS ou le parcours du dépôt ne rapportait rien du tout.
  assert.ok(ASSETS.length >= 40, `ASSETS doit être lu en entier, ${ASSETS.length} entrées lues`);
  assert.ok(ASSETS.includes('./'), 'la page d’accueil est une entrée à part entière');
  for (const attendu of ['index.html', 'main.js', 'css/sudoku.css', 'games/sudoku/screen.js']) {
    assert.ok(ASSETS.includes(attendu), `${attendu} doit être lu dans ASSETS`);
  }

  assert.ok(SERVIS.length >= 40, `le dépôt doit être parcouru, ${SERVIS.length} fichiers vus`);
  for (const attendu of ['index.html', 'main.js', 'css/sudoku.css', 'games/sudoku/screen.js',
    'manifest.webmanifest', 'data/frequences.txt.gz', 'icons/icone-192.png']) {
    assert.ok(SERVIS.includes(attendu), `${attendu} doit être vu sur le disque`);
  }
  assert.ok(!SERVIS.includes('sw.js'), 'sw.js ne se met pas dans son propre cache');
  assert.ok(!SERVIS.some((c) => c.startsWith('tests/')),
    'les fichiers d’essai ne sont pas servis au navigateur');
  assert.ok(!SERVIS.includes('data/LICENCES.txt'),
    'une note posée à côté des données n’est pas une requête du navigateur');
  assert.ok(!SERVIS.includes('icons/icone.svg'),
    'la source des icônes n’est pas servie : le manifeste ne nomme que les PNG');
});
