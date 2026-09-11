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

    children.push(element('p', { class: 'sous-titre', text: 'Ou une partie libre :' }));
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

    function refresh() {
      const lignes = game.rows.map((row) =>
        element('div', { class: 'ligne' },
          [...row.word].map((letter, i) => {
            const { sign, label } = SIGNS[row.marks[i]];
            return element('span', {
              class: `case case--${row.marks[i]}`,
              'aria-label': `${letter.toUpperCase()}, ${label}`,
            }, [
              element('span', { class: 'lettre', text: letter.toUpperCase() }),
              element('span', { class: 'signe', 'aria-hidden': 'true', text: sign }),
            ]);
          })
        )
      );
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

    const feedback = element('p', { class: 'retour', role: 'status' });

    function submit() {
      const essai = field.value.trim();
      const retour = game.propose(essai);
      if (!retour.ok) {
        feedback.className = 'retour erreur';
        feedback.textContent = MESSAGES[retour.reason] ?? MESSAGES.inconnu;
        return;
      }
      feedback.className = 'retour';
      feedback.textContent = '';
      field.value = game.firstLetter.toUpperCase();
      field.focus();
      refresh();
      if (game.phase === 'terminée') finish();
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
    if (game.phase !== 'terminée') game.giveUp();
    const resultat = game.result;
    stats.record('motus', resultat.score, { lowerIsBetter: true });

    const enfants = [
      element('h1', { text: resultat.won ? 'Trouvé !' : 'Partie terminée' }),
      element('p', {
        class: 'score',
        text: resultat.won
          ? `En ${resultat.attempts} essai${resultat.attempts > 1 ? 's' : ''}.`
          : `Le mot était « ${resultat.word.toUpperCase()} ».`,
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
  return () => {};
}
