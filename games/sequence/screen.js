// games/sequence/screen.js
import { element, button } from '../../core/ui.js';
import { ZONES } from './zones.js';
import { VITESSES, createSequenceGame } from './game.js';
import { createSound } from './son.js';

const LIBELLES_VITESSE = { lente: 'Lente', normale: 'Normale', rapide: 'Rapide' };

export function mountSequence(container, { stats, storage, onQuit }) {
  let game = null;
  let vitesse = storage.get('sequence.vitesse', 'normale');
  if (!VITESSES[vitesse]) vitesse = 'normale';
  const son = createSound();
  son.setMuted(Boolean(storage.get('sequence.muet', false)));

  // The one pending FLOW timer (what shows next in the sequence, or what
  // happens after a press). Showing a sequence is a chain of them, and in
  // lot 3 a stale one ended a fresh game and revealed its answer. One at a
  // time, at mount scope, cancelled before another is set, and every
  // callback checks which game it belongs to.
  let timer = null;
  // The highlight fade-out is a second, purely cosmetic timer: it never
  // drives the game (only removes a CSS class), so it does not share
  // `timer`'s slot. But it is still a live setTimeout, and the cleanup rule
  // is absolute — annuler() below cancels this one too, not just `timer`.
  let allumeTimer = null;
  /** The current board's painters, replaced on every render, null at the menu. */
  let peindreCourant = null;
  let allumerCourant = null;
  // game.phase turns 'repete' the instant allonger() is called, before the
  // sequence has shown a single zone — the rules layer has no notion of "the
  // screen is still animating". Relying on game.phase alone to gate presses
  // would let a tap in the first instants of a round through as a real
  // answer. This screen-local flag is the actual "is the board currently
  // playing back the sequence" state; it is what press handling checks.
  let montreEnCours = false;
  let arreterConfirme = false;
  /** The current board's stop button, so resetArreter() can relabel it
      without rebuilding the screen — same pattern as the paires screen. */
  let arreterBouton = null;

  function resetArreter() {
    if (!arreterConfirme) return;
    arreterConfirme = false;
    if (arreterBouton) arreterBouton.textContent = 'Arrêter';
  }

  function annulerFlux() {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  function annulerAllume() {
    if (allumeTimer === null) return;
    clearTimeout(allumeTimer);
    allumeTimer = null;
  }

  function annuler() {
    annulerFlux();
    annulerAllume();
  }

  function plus_tard(delai, quoi) {
    annulerFlux();
    timer = setTimeout(() => { timer = null; quoi(); }, delai);
  }

  function render() {
    peindreCourant = null;
    allumerCourant = null;
    montreEnCours = false;
    arreterBouton = null;
    arreterConfirme = false;
    container.replaceChildren(game ? renderGame() : renderMenu());
  }

  function renderMenu() {
    const enfants = [
      element('h1', { text: 'La séquence' }),
      element('p', {
        class: 'sous-titre',
        text: 'Regardez la suite, puis répétez-la. Elle s’allonge à chaque réussite.',
      }),
      element('p', { text: `Vitesse\u00a0: ${LIBELLES_VITESSE[vitesse]}` }),
    ];
    for (const nom of Object.keys(VITESSES)) {
      enfants.push(button(LIBELLES_VITESSE[nom], () => {
        vitesse = nom;
        storage.set('sequence.vitesse', nom);
        render();
      }, nom === vitesse ? {} : { className: 'bouton bouton--discret' }));
    }
    enfants.push(button(`Son\u00a0: ${son.muted ? 'non' : 'oui'}`, () => {
      son.setMuted(!son.muted);
      storage.set('sequence.muet', son.muted);
      render();
    }, { className: 'bouton bouton--discret',
         'aria-pressed': String(!son.muted) }));
    // resume() must run inside a real tap handler: Android keeps the audio
    // context suspended until one. A headless browser does not enforce that, so
    // no test here can catch it being moved to mount time.
    enfants.push(button('Commencer', () => { son.resume(); start(); }));
    enfants.push(button('Retour', onQuit, { className: 'bouton bouton--discret' }));
    return element('div', {}, enfants);
  }

  function start() {
    annuler();
    game = createSequenceGame({ rng: Math.random });
    render();
    tourSuivant(game);
  }

  function renderGame() {
    const pourJeu = game;
    const compteur = element('p', { class: 'sous-titre', role: 'status' });
    const grille = element('div', { class: 'zones-sequence' });
    const boutons = new Map();

    for (const zone of ZONES) {
      const b = button('', () => repondre(zone.id), { className: 'zone-sequence' });
      b.style.background = zone.couleur;
      b.setAttribute('aria-label', zone.libelle);
      b.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${zone.corps}</svg>`;
      boutons.set(zone.id, b);
      grille.append(b);
    }

    function peindre() {
      const longueur = game.sequence.length;
      compteur.textContent = game.phase === 'montre' && longueur === 0
        ? 'Regardez bien…'
        : `Suite de ${longueur} — record du tour\u00a0: ${game.longueur}`;
      for (const b of boutons.values()) {
        b.disabled = montreEnCours || game.phase !== 'repete';
      }
    }

    function allumer(zoneId, duree) {
      const b = boutons.get(zoneId);
      if (!b) return;
      b.classList.add('zone-sequence--allumee');
      son.play(zoneId);
      annulerAllume();
      allumeTimer = setTimeout(() => {
        allumeTimer = null;
        b.classList.remove('zone-sequence--allumee');
      }, Math.max(120, duree - 120));
    }

    function repondre(zoneId) {
      resetArreter();
      if (game !== pourJeu || montreEnCours || game.phase !== 'repete') return;
      allumer(zoneId, 240);
      const verdict = game.press(zoneId);
      peindre();
      if (verdict === 'faux') { plus_tard(700, () => finir(pourJeu)); return; }
      if (verdict === 'fini') plus_tard(700, () => tourSuivant(pourJeu));
    }

    const arreter = button('Arrêter', () => {
      if (!arreterConfirme) {
        arreterConfirme = true;
        arreter.textContent = 'Confirmer l’arrêt';
        return;
      }
      annuler();
      game = null;
      render();
    }, { className: 'bouton bouton--discret' });
    arreterBouton = arreter;

    // Handed up to mount scope so tourSuivant() can drive the board without
    // stashing functions on the DOM node — which the next render would silently
    // leave dangling.
    peindreCourant = peindre;
    allumerCourant = allumer;
    peindre();
    return element('div', {}, [
      compteur,
      grille,
      element('div', { class: 'actions-sequence' }, [
        arreter,
      ]),
    ]);
  }

  /** Adds one zone, then plays the whole sequence back, one timer at a time. */
  function tourSuivant(pourJeu) {
    if (game !== pourJeu) return;
    game.allonger();
    montreEnCours = true;
    const pas = VITESSES[vitesse];
    let i = 0;
    const montrer = () => {
      if (game !== pourJeu) return;
      if (i >= game.sequence.length) {
        montreEnCours = false;
        peindreCourant?.();
        return;
      }
      allumerCourant?.(game.sequence[i], pas);
      i += 1;
      plus_tard(pas, montrer);
    };
    peindreCourant?.();
    plus_tard(500, montrer);
  }

  function finir(pourJeu) {
    // Identity checked before cancelling anything: the paires screen does it
    // in this order too. A stale finir() call must never be able to reach
    // in and cancel the CURRENT game's live timer as a side effect of
    // checking whether it still applies.
    if (game !== pourJeu) return;
    annuler();
    const longueur = pourJeu.longueur;
    stats.record('sequence', longueur);
    game = null;
    container.replaceChildren(element('div', {}, [
      element('h1', { text: 'Partie terminée' }),
      element('p', {
        class: 'score',
        text: longueur === 0
          ? 'Aucune suite complète cette fois.'
          : `Suite de ${longueur} zone${longueur > 1 ? 's' : ''} répétée sans faute.`,
      }),
      button('Nouvelle partie', () => { son.resume(); start(); }),
      button('Retour', onQuit, { className: 'bouton bouton--discret' }),
    ]));
  }

  render();
  return () => { annuler(); son.close(); };
}
