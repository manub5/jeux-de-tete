// games/motus/screen.js
// The only file of this game that touches the DOM.

import { button, element } from '../../core/ui.js';
import { createRng, seedFromString, todayKey } from '../../core/rng.js';
import { MARKS } from './marking.js';
import { DEFAULT_LENGTH, LENGTHS } from './pick.js';
import { MAX_ATTEMPTS, createMotus } from './game.js';
import { createDaily } from './daily.js';
import { summary } from './share.js';

// A symbol beside every colour: the marking must not rest on colour alone.
const SIGNS = {
  [MARKS.placed]: { sign: '▪', label: 'bien placée' },
  [MARKS.present]: { sign: '▸', label: 'dans le mot, ailleurs' },
  [MARKS.absent]: { sign: '', label: 'absente' },
};

const MESSAGES = {
  inconnu: 'Ce mot n’est pas dans le dictionnaire.',
  longueur: 'Il faut un mot de la bonne longueur.',
  'refusé': 'Vous avez écarté ce mot du dictionnaire.',
};

export function mountMotus(container, { lexicon, stats, storage, frequencies, onQuit }) {
  let game = null;
  let daily = false;
  // The id of the pending "show the end screen" timer, if any — see
  // scheduleFinish() and finish() below. Kept at this scope because both
  // "Nouvelle partie" and the router's cleanup need to reach it.
  let finTimer = null;

  /**
   * Defers finish() so the player sees the last row land (and, on a win, its
   * bounce) before the end screen replaces it. `pourJeu` pins down which game
   * this timer belongs to: by the time it fires, `game` may already be a
   * different instance — a new game started, or the daily game reloaded — and
   * finish() must not act on a game the player never asked to end. Do not
   * "simplify" this identity check away: it is the only thing standing between
   * a stale timer and someone else's game.
   */
  function scheduleFinish(delay, pourJeu) {
    finTimer = setTimeout(() => {
      finTimer = null;
      if (game !== pourJeu) return;
      finish();
    }, delay);
  }

  function render() {
    container.replaceChildren(
      element('h1', { text: 'Motus' }),
      game ? renderGame() : renderMenu()
    );
  }

  /**
   * The squares and their send button, identical wherever they appear: the
   * end screen and the menu once the day is done. Written once so the two
   * cannot drift apart.
   */
  function squaresBlock(rows, meta) {
    const texte = summary(rows, meta);
    const retourPartage = element('p', { class: 'retour', role: 'status' });
    return [
      element('pre', { class: 'carres', text: texte }),
      button('Envoyer ce résumé', () => share(texte, retourPartage),
        { className: 'bouton bouton--discret' }),
      retourPartage,
    ];
  }

  function renderMenu() {
    const jour = createDaily({ lexicon, storage, frequencies, day: todayKey() });
    const children = [];

    if (jour.alreadyPlayed) {
      children.push(
        element('p', {
          text: jour.result.won
            ? `Le mot du jour est trouvé, en ${jour.result.attempts} ` +
              `essai${jour.result.attempts > 1 ? 's' : ''}. À demain.`
            : 'Le mot du jour est passé pour aujourd’hui. À demain.',
        }),
        // The evening, thinking back on the morning's game, is exactly when
        // he would want to see and send his squares again.
        ...squaresBlock(jour.game.rows, {
          day: todayKey(), won: jour.result.won, attempts: jour.result.attempts,
        })
      );
    } else {
      children.push(
        button('Le mot du jour', () => {
          daily = true;
          game = jour.game;
          render();
        })
      );
    }

    children.push(element('p', { class: 'sous-titre', text: 'Ou une partie libre\u00a0:' }));
    for (const length of LENGTHS) {
      children.push(
        button(`${length} lettres`, () => {
          daily = false;
          game = createMotus({
            lexicon,
            frequencies,
            length,
            rng: createRng(seedFromString(String(Date.now()))),
          });
          render();
        }, length === DEFAULT_LENGTH ? {} : { className: 'bouton bouton--discret' })
      );
    }
    children.push(button('Retour', onQuit, { className: 'bouton bouton--discret' }));
    return element('div', {}, children);
  }

  function renderGame() {
    const grille = element('div', { class: 'grille', 'aria-label': 'Vos essais' });

    // `rowToAnimate` names the row just played, if any: `refresh` rebuilds
    // every row on every call, so without this only that one row may carry
    // the landing animation. Left undefined (the initial call on mount), no
    // index matches and a resumed saved game stays still.
    function refresh(rowToAnimate) {
      const lignes = game.rows.map((row, index) => {
        const estNouvelle = index === rowToAnimate;
        const gagnee = estNouvelle && game.phase === 'terminée' && game.result.won;
        const attrsLigne = { class: gagnee ? 'ligne ligne--victoire' : 'ligne' };
        // `--longueur` lets the winning row's bounce wait for its own last
        // cell to land, whatever the word's length.
        if (gagnee) attrsLigne.style = `--longueur: ${game.length}`;
        return element('div', attrsLigne,
          [...row.word].map((letter, i) => {
            const { sign, label } = SIGNS[row.marks[i]];
            const attrsCase = {
              class: `case case--${row.marks[i]}${estNouvelle ? ' case--arrive' : ''}`,
              'aria-label': `${letter.toUpperCase()}, ${label}`,
            };
            // Same idiom as the falling tiles: `--rang` staggers the cells.
            if (estNouvelle) attrsCase.style = `--rang: ${i}`;
            return element('span', attrsCase, [
              element('span', { class: 'lettre', text: letter.toUpperCase() }),
              element('span', { class: 'signe', 'aria-hidden': 'true', text: sign }),
            ]);
          })
        );
      });
      // The attempts he has left, drawn empty, so the six are visible from the
      // start rather than appearing one by one.
      for (let i = game.rows.length; i < MAX_ATTEMPTS; i++) {
        lignes.push(
          element('div', { class: 'ligne' },
            Array.from({ length: game.length }, () =>
              element('span', { class: 'case case--vide' })
            )
          )
        );
      }
      grille.replaceChildren(...lignes);
    }
    refresh();

    const field = element('input', {
      type: 'text', class: 'saisie', autocomplete: 'off',
      autocapitalize: 'characters', spellcheck: 'false',
      maxlength: String(game.length), 'aria-label': 'Votre essai',
    });
    // The first letter is given, and cannot be removed: faithful to the show,
    // and he cannot lose an attempt by forgetting it.
    field.value = game.firstLetter.toUpperCase();
    field.addEventListener('input', () => {
      const attendu = game.firstLetter.toUpperCase();
      if (!field.value.toUpperCase().startsWith(attendu)) {
        field.value = attendu + field.value.replace(new RegExp(`^${attendu}`, 'i'), '');
      }
    });
    // Lets a second refusal in a row retrigger the shake (see submit below).
    field.addEventListener('animationend', (event) => {
      if (event.animationName === 'secousse') field.classList.remove('saisie--secoue');
    });

    const feedback = element('p', { class: 'retour', role: 'status' });

    function submit() {
      // The window between a winning (or losing) row landing and finish()
      // replacing the screen: the field is refocused and refilled right
      // before it opens, which invites exactly this. Without this guard,
      // Entrée or "Proposer" would call game.propose on a finished game,
      // which throws — the button would silently do nothing worse than
      // crash unheard.
      if (game.phase === 'terminée') return;
      const essai = field.value.trim();
      const retour = game.propose(essai);
      if (!retour.ok) {
        feedback.className = 'retour erreur';
        feedback.textContent = MESSAGES[retour.reason] ?? MESSAGES.inconnu;
        // A short shake says "no" before he has read the message, and does
        // not lean on colour. Remove, force a reflow, then re-add: without
        // that a second refusal in a row would not retrigger the animation.
        field.classList.remove('saisie--secoue');
        void field.offsetWidth;
        field.classList.add('saisie--secoue');
        return;
      }
      feedback.className = 'retour';
      feedback.textContent = '';
      field.value = game.firstLetter.toUpperCase();
      field.focus();
      refresh(game.rows.length - 1);
      if (game.phase === 'terminée') {
        const reduitMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        // The row's cells stagger in over (length - 1) * 80ms, each taking a
        // further 260ms to land; the winning row then bounces for 320ms more.
        const finCases = (game.length - 1) * 80 + 260;
        const attente = reduitMotion ? 0 : finCases + (game.result.won ? 320 : 0);
        // Not the timer this project forbids: the outcome is already
        // decided, so nothing here pressures the player mid-turn. It only
        // delays finish() so he sees the last row land — and, on a win, its
        // bounce — before the end screen replaces it. With reduced motion
        // nothing plays, so the delay is zero and the end screen is not
        // simply late for no reason.
        scheduleFinish(attente, game);
      }
    }

    field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') submit();
    });

    return element('div', {}, [
      element('p', {
        class: 'objectif',
        text: daily
          ? `Le mot du jour, ${game.length} lettres.`
          : `Un mot de ${game.length} lettres.`,
      }),
      grille,
      field,
      button('Proposer', submit),
      feedback,
      button('Je donne ma langue au chat', finish, { className: 'bouton bouton--discret' }),
    ]);
  }

  function finish() {
    // Whichever path reaches the end first wins: "Je donne ma langue au
    // chat" can fire while a scheduleFinish() timer from a just-landed
    // winning row is still pending. Cancel it here so the other path can
    // never also run finish() — on this game (double stats) or, once the
    // player has moved on, on whatever is on screen next.
    if (finTimer !== null) {
      clearTimeout(finTimer);
      finTimer = null;
    }
    if (game.phase !== 'terminée') game.giveUp();
    const resultat = game.result;
    stats.record('motus', resultat.score, { lowerIsBetter: true });

    const enfants = [
      element('h1', { text: resultat.won ? 'Trouvé\u00a0!' : 'Partie terminée' }),
      element('p', {
        class: 'score',
        text: resultat.won
          ? `En ${resultat.attempts} essai${resultat.attempts > 1 ? 's' : ''}.`
          : `Le mot était «\u00a0${resultat.word.toUpperCase()}\u00a0».`,
      }),
    ];

    if (daily) {
      enfants.push(...squaresBlock(game.rows, {
        day: todayKey(), won: resultat.won, attempts: resultat.attempts,
      }));
    }

    enfants.push(
      button('Nouvelle partie', () => { game = null; render(); }),
      button('Retour', onQuit, { className: 'bouton bouton--discret' })
    );
    container.replaceChildren(...enfants);
  }

  /**
   * Three ways out, in order of comfort. The squares are on screen either way,
   * so even if all three fail he can still copy them by hand — a silent failure
   * is the one outcome he could not diagnose.
   */
  async function share(texte, retour) {
    try {
      if (navigator.share) {
        await navigator.share({ text: texte });
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(texte);
        retour.textContent = 'Résumé copié.';
        return;
      }
      retour.textContent = 'Copiez le résumé ci-dessus.';
    } catch (error) {
      // Includes the player simply cancelling the share sheet.
      console.error('partage du résumé', error);
      retour.textContent = 'Copiez le résumé ci-dessus.';
    }
  }

  render();
  // A real cleanup, not a no-op: leaving the screen (back button, another
  // route) while a scheduleFinish() timer is pending must not leave that
  // timer alive to overwrite whatever the router mounts next.
  return () => {
    if (finTimer !== null) {
      clearTimeout(finTimer);
      finTimer = null;
    }
  };
}
