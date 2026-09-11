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

/**
 * Les propriétés personnalisées (`--x`) posées sur `:root` par une feuille.
 *
 * Elles sont aussi globales que les classes : deux feuilles qui déclarent la
 * même sur `:root` s'écrasent en silence, et la dernière chargée gagne. On ne
 * relève que les **déclarations** sur `:root` — `var(--erreur)` dans une règle
 * de jeu est un emploi, pas une définition, et le confondre ferait crier le
 * contrôle sur chaque feuille.
 */
function variablesRacine(chemin) {
  const texte = readFileSync(chemin, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const noms = new Set();
  for (const [, selecteurs, corps] of texte.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selecteurs.trim() !== ':root') continue;
    for (const [, nom] of corps.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) noms.add(nom);
  }
  return noms;
}

/** Les noms déclarés par les deux feuilles à la fois. */
function variablesCommunes(a, b) {
  return [...a].filter((v) => b.has(v)).sort();
}

/**
 * La valeur d'une propriété d'objet ou d'une affectation, à partir du texte qui
 * suit le `:` ou le `=`. On s'arrête à la première virgule, au premier
 * point-virgule ou à la première fermeture de niveau zéro, guillemets
 * respectés. Prendre le reste de la ligne ramasserait
 * `text: 'Ou une nouvelle grille :'` et ferait passer le mot « grille » pour la
 * classe de Motus ; ne pas s'arrêter du tout ramasserait la suite du fichier.
 */
function valeurExpression(fragment) {
  let profondeur = 0;
  let guillemet = null;
  for (let i = 0; i < fragment.length; i++) {
    const c = fragment[i];
    if (guillemet) {
      if (c === '\\') i++;
      else if (c === guillemet) guillemet = null;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') { guillemet = c; continue; }
    if (c === '(' || c === '[' || c === '{') profondeur++;
    else if (c === ')' || c === ']' || c === '}') {
      if (profondeur === 0) return fragment.slice(0, i);
      profondeur--;
    } else if ((c === ',' || c === ';') && profondeur === 0) return fragment.slice(0, i);
  }
  return fragment;
}

/** Les noms de classe contenus dans les littéraux d'une expression. */
function classesLitterales(expression) {
  const noms = new Set();
  const morceaux = [];
  for (const trouve of expression.matchAll(/'([^']*)'|"([^"]*)"/g)) {
    morceaux.push(trouve[1] ?? trouve[2]);
  }
  for (const [, valeur] of expression.matchAll(/`([^`]*)`/g)) {
    // Une interpolation devient un nom impossible plutôt que de disparaître :
    // `case--${mark}` ne doit pas se lire comme la classe « case-- ». Le
    // marqueur est `{}`, dont les accolades sont hors du jeu de caractères d'un
    // nom de classe. Ne pas le remplacer par un octet nul : le fichier devient
    // binaire pour git et son diff cesse d'être relisible.
    //
    // Honnêteté sur sa portée : **aucun test ne tombe si on l'enlève**, et c'est
    // vérifié. Le contrôle ne signale que les emprunts — une classe définie dans
    // la feuille d'un AUTRE jeu — et « case-- » n'est définie nulle part, donc
    // elle serait ignorée de toute façon. Ce marqueur est une précaution contre
    // le jour où un autre jeu définirait « case-- », pas un comportement testé.
    // Ne pas le présenter comme tel.
    morceaux.push(valeur.replace(/\$\{[^{}]*\}/g, '{}'));
  }
  for (const morceau of morceaux) {
    for (const nom of morceau.trim().split(/\s+/)) {
      if (/^[a-zA-Z0-9_-]+$/.test(nom)) noms.add(nom);
    }
  }
  return noms;
}

/**
 * Les classes qu'un fichier de jeu pose sur le DOM.
 *
 * On lit les quatre formes que ce projet emploie : `class:` / `className:` dans
 * un littéral d'objet, l'affectation `.className =`, `classList.add()` et ses
 * voisines, et le tableau de classes qu'on assemble avant de le joindre
 * (`const classes = [...]`, `classes.push(...)` — la forme de
 * games/sudoku/screen.js). Une classe dont le nom est construit autour d'une
 * interpolation n'est pas vue : elle sort avec un nom impossible, donc sans
 * bruit ni fausse alerte.
 */
function classesEmployees(chemin) {
  const texte = readFileSync(chemin, 'utf8');
  const employees = new Set();
  const marqueur = /\bclass(?:Name)?\s*[:=]|\bclassList\.(?:add|remove|toggle)\(|\bclass\w*\.push\(|\bclass\w*\s*=\s*\[/g;
  for (const trouve of texte.matchAll(marqueur)) {
    const suite = texte.slice(trouve.index + trouve[0].length);
    for (const nom of classesLitterales(valeurExpression(suite))) employees.add(nom);
  }
  return employees;
}

/**
 * Les classes qu'un jeu emploie sans qu'elles soient à lui : ni dans
 * `css/base.css`, ni dans sa propre feuille, mais bien dans celle d'un autre
 * jeu. C'est l'emprunt silencieux — le sudoku a vécu sur `.actions`, définie
 * uniquement dans `css/mot-le-plus-long.css`, où elle avait l'air morte.
 *
 * Une classe définie **nulle part** n'est pas un emprunt : `.lettre`, posée par
 * Motus, ne nomme qu'un repère dans le balisage et ne dépend d'aucune feuille.
 */
function classesEmpruntees(employees, jeu) {
  const propres = new Set([
    ...(parFeuille.get(`${jeu}.css`) ?? []),
    ...parFeuille.get('base.css'),
  ]);
  const ailleurs = new Set(
    feuillesDeJeu.filter(([f]) => f !== `${jeu}.css`).flatMap(([, classes]) => [...classes])
  );
  return [...employees].filter((c) => !propres.has(c) && ailleurs.has(c)).sort();
}

const feuilles = readdirSync('css').filter((f) => f.endsWith('.css'));
const parFeuille = new Map(feuilles.map((f) => [f, classesDefinies(`css/${f}`)]));
const feuillesDeJeu = [...parFeuille].filter(([f]) => f !== 'base.css');
const jeux = readdirSync('games', { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

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

test('aucun jeu n’emprunte une classe à la feuille d’un autre jeu', () => {
  for (const jeu of jeux) {
    const employees = new Set(
      readdirSync(`games/${jeu}`)
        .filter((f) => f.endsWith('.js'))
        .flatMap((f) => [...classesEmployees(`games/${jeu}/${f}`)])
    );
    const empruntees = classesEmpruntees(employees, jeu);
    assert.deepEqual(empruntees, [],
      `${jeu} emploie des classes définies seulement dans la feuille d’un autre jeu : ${empruntees.join(', ')}`);
  }
});

test('le contrôle sait reconnaître une classe empruntée', () => {
  // Sans ce test, le précédent passerait aussi bien si l'extraction ne trouvait
  // aucune classe, ou si la comparaison ne comparait rien.
  const employees = classesEmployees('games/sudoku/screen.js');
  assert.ok(employees.has('actions-sudoku'), 'un littéral `class:` doit être vu');
  assert.ok(employees.has('bouton--discret'), 'une classe parmi plusieurs doit être vue');
  assert.ok(employees.has('case-sudoku--conflit'),
    'une classe assemblée en tableau doit être vue');
  assert.ok(!employees.has('grille'),
    'un mot d’un texte affiché ne doit pas passer pour une classe');
  // Le mutant, fabriqué ici : un sudoku qui emploierait `.grille`, définie dans
  // la seule feuille de Motus, doit être dénoncé — et pas `.bouton`, qui est au
  // socle, ni `.lettre`, qui n'est définie nulle part, ni ses propres classes.
  //
  // Le cobaye ne doit pas être une classe qu'on souhaite voir disparaître :
  // celui d'avant était `.actions`, restée morte dans la feuille du mot le plus
  // long, et supprimer cette règle morte cassait l'auto-test au lieu de le
  // laisser faire son travail.
  assert.deepEqual(
    classesEmpruntees(new Set(['grille', 'grille-sudoku', 'bouton', 'lettre']), 'sudoku'),
    ['grille']);
});

test('deux feuilles ne déclarent jamais la même variable sur :root', () => {
  const parRacine = feuilles.map((f) => [f, variablesRacine(`css/${f}`)]);
  for (let i = 0; i < parRacine.length; i++) {
    for (let j = i + 1; j < parRacine.length; j++) {
      const [nomA, varsA] = parRacine[i];
      const [nomB, varsB] = parRacine[j];
      const communes = variablesCommunes(varsA, varsB);
      assert.deepEqual(communes, [],
        `${nomA} et ${nomB} déclarent toutes deux : ${communes.join(', ')}`);
    }
  }
});

test('le contrôle sait reconnaître une variable partagée', () => {
  const base = variablesRacine('css/base.css');
  assert.ok(base.has('--corps'), 'l’extraction doit trouver une variable connue');
  assert.ok(base.has('--texte'), 'et celles du bloc sombre, déclarées plus bas');
  assert.ok(!variablesRacine('css/motus.css').has('--erreur'),
    'employer `var(--erreur)` dans une règle n’est pas la déclarer');
  assert.ok(variablesRacine('css/motus.css').has('--case-present-texte'),
    'une feuille de jeu déclare bien les siennes');
  // Le mutant, fabriqué ici : deux feuilles qui déclareraient `--erreur`.
  assert.deepEqual(
    variablesCommunes(new Set(['--erreur', '--marge']), new Set(['--erreur', '--rayon'])),
    ['--erreur']);
});
