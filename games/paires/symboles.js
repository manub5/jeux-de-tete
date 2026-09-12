// games/paires/symboles.js
// The thirty symbols, drawn by the code: no image files to cache, crisp at any
// size, and the contrast follows the theme because every stroke inherits
// currentColor.
//
// Distinctness is a human judgement. A pixel-difference check between pairs was
// tried before this file existed and discarded: it ranked `rond / hexagone` as
// the riskiest pair — which nobody confuses — and missed the two the eye caught.
// Whoever changes this list must look at it rendered at 33px, not trust a test.

/** A stroked path: thick enough to read as a silhouette at 33px. */
const T = (d) =>
  `<path d="${d}" fill="none" stroke="currentColor" stroke-width="14" ` +
  `stroke-linecap="round" stroke-linejoin="round"/>`;

/** A filled path. */
const P = (d) => `<path d="${d}" fill="currentColor"/>`;

/**
 * A stroked path with a chosen width: the shapes made of several parallel
 * strokes need a thinner line, otherwise the gaps between them close up and
 * the whole symbol turns into one blob at 33px.
 */
const TF = (d, epaisseur) =>
  `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${epaisseur}" ` +
  `stroke-linecap="round" stroke-linejoin="round"/>`;

export const SYMBOLES = [
  // Les vingt-cinq qui ont passé le regard à 33 px. Tracés tels quels :
  // ne les redessine pas, ils ont déjà été vérifiés à l'œil.
  { id: 'rond', libelle: 'rond', corps: '<circle cx="50" cy="50" r="38" fill="currentColor"/>' },
  { id: 'carre', libelle: 'carré', corps: '<rect x="14" y="14" width="72" height="72" fill="currentColor"/>' },
  { id: 'triangle', libelle: 'triangle', corps: P('M50 10 L90 84 L10 84 Z') },
  { id: 'losange', libelle: 'losange', corps: P('M50 8 L92 50 L50 92 L8 50 Z') },
  { id: 'etoile', libelle: 'étoile', corps: P('M50 6 L62 38 L96 38 L68 58 L79 92 L50 71 L21 92 L32 58 L4 38 L38 38 Z') },
  { id: 'coeur', libelle: 'cœur', corps: P('M50 88 C10 58 8 30 28 20 C40 14 50 24 50 32 C50 24 60 14 72 20 C92 30 90 58 50 88 Z') },
  { id: 'croix', libelle: 'croix', corps: P('M36 8 h28 v28 h28 v28 h-28 v28 h-28 v-28 h-28 v-28 h28 Z') },
  { id: 'lune', libelle: 'lune', corps: P('M68 12 A42 42 0 1 0 68 88 A34 34 0 1 1 68 12 Z') },
  { id: 'goutte', libelle: 'goutte', corps: P('M50 6 C78 40 86 56 86 66 A36 36 0 0 1 14 66 C14 56 22 40 50 6 Z') },
  { id: 'eclair', libelle: 'éclair', corps: P('M58 4 L22 54 h24 l-8 42 l38 -54 h-24 Z') },
  { id: 'hexagone', libelle: 'hexagone', corps: P('M50 6 L88 28 v44 L50 94 L12 72 V28 Z') },
  { id: 'fleche-haut', libelle: 'flèche haut', corps: P('M50 8 L88 48 H66 v40 H34 V48 H12 Z') },
  { id: 'anneau', libelle: 'anneau', corps: '<circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" stroke-width="18"/>' },
  { id: 'barre', libelle: 'barre', corps: '<rect x="10" y="38" width="80" height="24" rx="12" fill="currentColor"/>' },
  { id: 'sablier', libelle: 'sablier', corps: P('M16 10 h68 L54 50 l30 40 H16 l30 -40 Z') },
  { id: 'nuage', libelle: 'nuage', corps: P('M28 78 a20 20 0 0 1 2 -40 a24 24 0 0 1 46 6 a18 18 0 0 1 -4 34 Z') },
  { id: 'soleil', libelle: 'soleil', corps: '<circle cx="50" cy="50" r="22" fill="currentColor"/><g stroke="currentColor" stroke-width="10" stroke-linecap="round"><path d="M50 4v14M50 82v14M4 50h14M82 50h14M17 17l10 10M73 73l10 10M83 17L73 27M27 73L17 83"/></g>' },
  { id: 'fanion', libelle: 'fanion', corps: T('M20 8 v84 M20 12 h60 l-16 20 l16 20 h-60') },
  { id: 'trefle', libelle: 'trèfle', corps: P('M50 92 V58 M50 58 a17 17 0 1 1 -14 -26 a17 17 0 1 1 28 0 a17 17 0 1 1 -14 26 Z') },
  { id: 'note', libelle: 'note', corps: P('M40 74 V18 l36 -10 v56 M40 74 a12 10 0 1 1 -24 0 a12 10 0 1 1 24 0 M76 64 a12 10 0 1 1 -24 0 a12 10 0 1 1 24 0 Z') },
  { id: 'ancre', libelle: 'ancre', corps: T('M50 20 v70 M22 62 a28 28 0 0 0 56 0 M26 34 h48') },
  { id: 'poisson', libelle: 'poisson', corps: P('M8 50 C28 22 66 22 82 50 C66 78 28 78 8 50 Z M82 50 l14 -18 v36 Z') },
  { id: 'parapluie', libelle: 'parapluie', corps: T('M50 90 V44 M8 46 a42 42 0 0 1 84 0 Z M50 90 a12 12 0 0 0 20 -8') },
  { id: 'montagne', libelle: 'montagne', corps: P('M4 84 L34 30 L52 58 L66 40 L96 84 Z') },
  // « dé » seul fait deux lettres, et le test exige trois caractères au moins :
  // le libellé est allongé, le tracé n'est pas touché.
  { id: 'de', libelle: 'dé à jouer', corps: '<rect x="12" y="12" width="76" height="76" rx="12" fill="none" stroke="currentColor" stroke-width="10"/><g fill="currentColor"><circle cx="32" cy="32" r="7"/><circle cx="50" cy="50" r="7"/><circle cx="68" cy="68" r="7"/></g>' },
  // Les cinq de mon cru, regardés à 33 px (étape 5). Ils remplacent la spirale
  // ronde, la maison, l'engrenage, la feuille et la clé. Chacun occupe la boîte
  // autrement que les vingt-cinq précédents : une grille 2×2 à cases alternées,
  // un rectangle couché, un tracé à angles droits, une échelle de barreaux,
  // une ondulation.
  { id: 'damier', libelle: 'damier', corps: '<rect x="10" y="10" width="80" height="80" fill="none" stroke="currentColor" stroke-width="8"/>' + TF('M50 10 V90 M10 50 H90', 8) + '<rect x="14" y="14" width="32" height="32" fill="currentColor"/><rect x="54" y="54" width="32" height="32" fill="currentColor"/>' },
  { id: 'enveloppe', libelle: 'enveloppe', corps: '<rect x="8" y="24" width="84" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="11"/>' + TF('M14 30 L50 58 L86 30', 11) },
  // Named a hook, not a maze or a spiral: this single right-angled line has
  // no branch (not a maze) and, checked at real render size, still reads
  // more like a stray letter than a coil (not a spiral either) — but a
  // bent line that doubles back on itself is exactly what a hook is, so
  // the name carries no promise the shape can fail to keep.
  { id: 'crochet', libelle: 'crochet', corps: TF('M86 14 H22 V86 H78 V44 H48 V66', 12) },
  { id: 'echelle', libelle: 'échelle', corps: TF('M26 8 V92 M74 8 V92 M26 30 H74 M26 70 H74', 12) },
  { id: 'vague', libelle: 'vague', corps: T('M10 66 C24 22 40 22 50 50 C60 78 76 78 90 34') },
];

export function svgDuSymbole(symbole, { taille = '100%' } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('width', taille);
  svg.setAttribute('height', taille);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', symbole.libelle);
  svg.innerHTML = symbole.corps;
  return svg;
}
