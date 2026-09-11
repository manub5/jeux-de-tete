import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * No two game stylesheets may ever define the same class.
 *
 * Every sheet is linked globally from `index.html`, with no per-game scope: a
 * class defined twice is silently overwritten by whichever loads last. Lot 4
 * found this out by adding the sudoku, whose `.grille` and `.case` would have
 * laid Motus's attempt rows side by side and dropped the contrast of its
 * marked squares — on a game already in his hands.
 *
 * Only **single-class rule subjects** (`.x { }`) are compared. A descendant
 * selector like `.retour .bouton` refines a shared class inside one container,
 * which is legitimate and common. A check that cries wolf ends up ignored, and
 * then it protects nothing at all.
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
 * The custom properties (`--x`) a sheet sets on `:root`.
 *
 * They are every bit as global as classes: two sheets declaring the same one
 * on `:root` silently overwrite each other, and the last loaded wins. Only
 * **declarations** on `:root` count — `var(--erreur)` inside a game's rule is
 * a use, not a definition, and confusing the two would set the check
 * screaming at every sheet in the project.
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

/** The names both sheets declare. */
function variablesCommunes(a, b) {
  return [...a].filter((v) => b.has(v)).sort();
}

/**
 * The value of an object property or an assignment, read from the text that
 * follows the `:` or the `=`. It stops at the first comma, semicolon or
 * closing bracket at depth zero, quotes respected. Taking the rest of the line
 * would swallow `text: 'Ou une nouvelle grille :'` and pass the word "grille"
 * off as Motus's class; stopping nowhere at all would swallow the rest of the
 * file.
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

/** The class names held in an expression's string literals. */
function classesLitterales(expression) {
  const noms = new Set();
  const morceaux = [];
  for (const trouve of expression.matchAll(/'([^']*)'|"([^"]*)"/g)) {
    morceaux.push(trouve[1] ?? trouve[2]);
  }
  for (const [, valeur] of expression.matchAll(/`([^`]*)`/g)) {
    // An interpolation turns into an impossible name rather than vanishing:
    // `case--${mark}` must not read as the class "case--". The marker is `{}`,
    // whose braces are outside the character set of a class name. Do not
    // replace it with a null byte: git would call the file binary and its diff
    // would stop being readable.
    //
    // Honesty about its reach: **no test falls if you remove it**, and that is
    // verified. The check only reports borrowings — a class defined in ANOTHER
    // game's sheet — and "case--" is defined nowhere, so it would be ignored
    // either way. This marker guards against the day some game does define
    // "case--"; it is not a tested behaviour. Do not present it as one.
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
 * The classes a JavaScript file puts on the DOM.
 *
 * The four shapes this project uses are read: `class:` / `className:` in an
 * object literal, the `.className =` assignment, `classList.add()` and its
 * neighbours, and the array of classes assembled before being joined
 * (`const classes = [...]`, `classes.push(...)` — the shape of
 * games/sudoku/screen.js). A class whose name is built around an interpolation
 * is not seen: it comes out under an impossible name, so it raises neither
 * noise nor a false alarm.
 *
 * Known hole, left open on purpose: a class that travels through a variable —
 * `const c = 'actions'; element('div', { class: c })` — goes unseen. Catching
 * it means following assignments across a file, a small interpreter's worth of
 * work for a shape this project does not write. Naming the hole here is worth
 * more than a half-built tracker that would let the next reader believe the
 * cover is complete. That belief is the defect this project has paid for four
 * lots running.
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
 * The classes an HTML file puts on the DOM, read from its `class="…"`
 * attributes.
 *
 * A separate reader rather than classesEmployees(): that one matches `class=`
 * and then takes everything up to the next comma, semicolon or closing
 * bracket, which in markup means swallowing the rest of the document and
 * mistaking every quoted attribute in it — `type="module"` and the like — for
 * a class name.
 */
function classesEmployeesHtml(chemin) {
  const texte = readFileSync(chemin, 'utf8');
  const noms = new Set();
  for (const trouve of texte.matchAll(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    for (const nom of (trouve[1] ?? trouve[2]).trim().split(/\s+/)) {
      if (/^[a-zA-Z0-9_-]+$/.test(nom)) noms.add(nom);
    }
  }
  return noms;
}

/**
 * The classes a game uses that are not its own: neither in `css/base.css` nor
 * in its own sheet, but sitting in another game's. This is the silent
 * borrowing — the sudoku lived on `.actions`, defined only in
 * `css/mot-le-plus-long.css`, where it looked like a dead rule.
 *
 * A class defined **nowhere** is not a borrowing: `.lettre`, put on by Motus,
 * only names a landmark in the markup and depends on no sheet at all.
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

/**
 * The files every game shares. They are entitled to `css/base.css` and to
 * nothing else: a class borrowed here does not cross one boundary, it crosses
 * all five games at once, which makes it worse than a game reaching into its
 * neighbour's sheet, not lighter.
 *
 * Until now the check only read `games/<jeu>/*.js`, so the three classes
 * `main.js` and `index.html` put on the page escaped it entirely.
 */
const FICHIERS_PARTAGES = [
  'main.js',
  'index.html',
  ...readdirSync('core').filter((f) => f.endsWith('.js')).map((f) => `core/${f}`),
];

/**
 * The name classesEmpruntees() is given for a shared file. There is no
 * `css/socle.css` — the self-test below checks that — so "its own sheet" is
 * empty and only base.css counts as its own. Exactly the rule wanted here.
 */
const SOCLE = 'socle';

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
  // Without this test, the two above would pass just as happily if the
  // extraction found no class whatsoever — the very defect this lot hunted
  // down everywhere else.
  const feuille = classesDefinies('css/sudoku.css');
  assert.ok(feuille.size > 0, 'l’extraction doit trouver des classes');
  assert.ok(feuille.has('grille-sudoku'), 'elle doit trouver une classe connue');
});

test('un sélecteur descendant n’est pas une définition', () => {
  // `.retour .bouton` refines a shared class: that is not a collision, and
  // confusing the two would set the check screaming at correct code.
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
  // Without this test, the one above would pass just as happily if the
  // extraction found no class, or if the comparison compared nothing.
  const employees = classesEmployees('games/sudoku/screen.js');
  assert.ok(employees.has('actions-sudoku'), 'un littéral `class:` doit être vu');
  assert.ok(employees.has('bouton--discret'), 'une classe parmi plusieurs doit être vue');
  assert.ok(employees.has('case-sudoku--conflit'),
    'une classe assemblée en tableau doit être vue');
  assert.ok(!employees.has('grille'),
    'un mot d’un texte affiché ne doit pas passer pour une classe');
  // The mutant, built right here: a sudoku using `.grille`, defined in Motus's
  // sheet alone, must be denounced — and not `.bouton`, which belongs to the
  // socle, nor `.lettre`, which is defined nowhere, nor its own classes.
  //
  // The guinea pig must not be a class anyone wants gone: the last one was
  // `.actions`, left dead in the longest-word sheet, and deleting that dead
  // rule broke the self-test instead of letting it do its job.
  assert.deepEqual(
    classesEmpruntees(new Set(['grille', 'grille-sudoku', 'bouton', 'lettre']), 'sudoku'),
    ['grille']);
});

test('aucun fichier partagé n’emprunte une classe à la feuille d’un jeu', () => {
  for (const chemin of FICHIERS_PARTAGES) {
    const employees = chemin.endsWith('.html')
      ? classesEmployeesHtml(chemin)
      : classesEmployees(chemin);
    const empruntees = classesEmpruntees(employees, SOCLE);
    assert.deepEqual(empruntees, [],
      `${chemin} emploie des classes définies seulement dans la feuille d’un jeu : ${empruntees.join(', ')}`);
  }
});

test('le contrôle sait lire les fichiers partagés', () => {
  // Sans ce test, le précédent passerait aussi bien si l'extraction ne trouvait
  // aucune classe dans main.js, dans core/ ou dans le balisage.
  assert.ok(!parFeuille.has('socle.css'),
    'le socle n’a pas de feuille à lui : sinon SOCLE désignerait autre chose');
  const partage = classesEmployees('main.js');
  assert.ok(partage.has('chargement'), 'une classe posée par main.js doit être vue');
  assert.ok(partage.has('bandeau'), 'et celle du bandeau de nouvelle version');
  assert.ok(classesEmployees('core/ui.js').has('bouton'),
    'la classe par défaut de core/ui.js doit être vue');
  const balisage = classesEmployeesHtml('index.html');
  assert.ok(balisage.has('chargement'), 'un attribut class= du balisage doit être vu');
  assert.ok(!balisage.has('module'),
    'un autre attribut ne doit pas passer pour une classe');
  // Le mutant, fabriqué ici : un fichier partagé qui emploierait `.grille`,
  // définie dans la seule feuille de Motus, la traînerait à travers les cinq
  // jeux — et pas `.bouton`, qui est au socle.
  assert.deepEqual(classesEmpruntees(new Set(['grille', 'bouton']), SOCLE), ['grille']);
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
  // The mutant, built right here: two sheets both declaring `--erreur`.
  assert.deepEqual(
    variablesCommunes(new Set(['--erreur', '--marge']), new Set(['--erreur', '--rayon'])),
    ['--erreur']);
});
