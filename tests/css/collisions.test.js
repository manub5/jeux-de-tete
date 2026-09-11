import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * Deux feuilles de jeu ne doivent jamais définir la même classe.
 *
 * Toutes les feuilles sont liées globalement dans `index.html`, sans portée par
 * jeu : une classe définie deux fois est écrasée par la dernière chargée, en
 * silence. Le lot 4 l'a découvert en ajoutant le sudoku, dont `.grille` et
 * `.case` auraient mis les lignes d'essai de Motus côte à côte et fait tomber le
 * contraste de ses cases marquées — sur un jeu déjà livré.
 *
 * On ne compare que les **sujets de règles à classe unique** (`.x { }`). Un
 * sélecteur descendant comme `.retour .bouton` affine une classe partagée dans
 * un conteneur donné, ce qui est légitime et courant. Un contrôle qui crie à tort
 * finit par être ignoré, et alors il ne protège plus de rien.
 */
function classesDefinies(chemin) {
  const texte = readFileSync(chemin, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const classes = new Set();
  for (const [, selecteurs] of texte.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    for (const selecteur of selecteurs.split(',')) {
      const seule = /^\.([a-zA-Z0-9_-]+)(:[a-zA-Z-]+(\([^)]*\))?)?$/.exec(selecteur.trim());
      if (seule) classes.add(seule[1]);
    }
  }
  return classes;
}

const feuilles = readdirSync('css').filter((f) => f.endsWith('.css'));
const parFeuille = new Map(feuilles.map((f) => [f, classesDefinies(`css/${f}`)]));
const feuillesDeJeu = [...parFeuille].filter(([f]) => f !== 'base.css');

test('deux feuilles de jeu ne définissent jamais la même classe', () => {
  for (let i = 0; i < feuillesDeJeu.length; i++) {
    for (let j = i + 1; j < feuillesDeJeu.length; j++) {
      const [nomA, classesA] = feuillesDeJeu[i];
      const [nomB, classesB] = feuillesDeJeu[j];
      const communes = [...classesA].filter((c) => classesB.has(c));
      assert.deepEqual(communes, [],
        `${nomA} et ${nomB} définissent toutes deux : ${communes.join(', ')}`);
    }
  }
});

test('aucune feuille de jeu ne redéfinit une classe de base.css', () => {
  const communes = parFeuille.get('base.css');
  for (const [nom, classes] of feuillesDeJeu) {
    const ecrasees = [...classes].filter((c) => communes.has(c));
    assert.deepEqual(ecrasees, [],
      `${nom} redéfinit des classes partagées : ${ecrasees.join(', ')}`);
  }
});

test('le contrôle sait reconnaître une collision', () => {
  // Sans ce test, les deux précédents passeraient aussi bien si l'extraction
  // ne trouvait aucune classe du tout — le défaut exact que ce lot a traqué
  // partout ailleurs.
  const feuille = classesDefinies('css/sudoku.css');
  assert.ok(feuille.size > 0, 'l’extraction doit trouver des classes');
  assert.ok(feuille.has('grille-sudoku'), 'elle doit trouver une classe connue');
});

test('un sélecteur descendant n’est pas une définition', () => {
  // `.retour .bouton` affine une classe partagée : ce n'est pas une collision,
  // et le confondre ferait crier le contrôle sur du code correct.
  assert.ok(!classesDefinies('css/mot-le-plus-long.css').has('bouton'));
});
