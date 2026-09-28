// games/tous-les-mots/screen.js
// The only file of this game that touches the DOM.

import { button, element } from '../../core/ui.js';
import { createRng, seedFromString } from '../../core/rng.js';
import { messageFin, messageRecord } from '../../core/encouragements.js';
import { showPopup } from '../../core/popup.js';
import { createAllWords } from './game.js';

/**
 * French noun/participle agreement. Zero takes the singular, like one: he opens
 * on "0 mot sur 43", not "0 mots sur 43". The plural starts at two.
 */
function agree(count, word) {
  return `${word}${count >= 2 ? 's' : ''}`;
}

export function mountAllWords(container, { solver, lexicon, stats, storage, frequencies, onQuit }) {
  let game;
  let fermerPopup = null;

  function render() {
    const tiles = element('div', { class: 'tirage', 'aria-label': 'Vos sept lettres' },
      game.letters.map((letter, rang) =>
        element('span', { class: 'jeton', style: `--rang: ${rang}`, text: letter.toUpperCase() })
      )
    );

    // A single live region on the screen (the feedback line, below): a second
    // one on the counter would announce twice on every accepted word.
    const compteur = element('p', { class: 'compteur' });
    const liste = element('ul', { class: 'trouves' });
    function refresh() {
      compteur.textContent = `${game.found.length} ${agree(game.found.length, 'mot')} sur ${game.total}`;
      liste.replaceChildren(
        ...game.found.map((word) =>
          element('li', { text: `${word} (${solver.playedLength(word)})` })
        )
      );
    }

    const field = element('input', {
      type: 'text', class: 'saisie', autocomplete: 'off',
      autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Un mot',
    });
    const feedback = element('p', { class: 'retour', role: 'status' });

    const MESSAGES = {
      court: 'Il faut au moins trois lettres.',
      lettres: 'Ce mot n’est pas dans ces lettres.',
      'déjà': 'Vous l’avez déjà trouvé.',
      // No game still offers a button to strike a word out — see
      // lexicon/lexicon.js — but a backup made before that change can still
      // hold one in `corrections.rejected`. Naming it, rather than pretending
      // the dictionary itself ignores it, stays the honest message for that
      // word until such a backup is restored.
      'refusé': 'Vous avez écarté ce mot du dictionnaire.',
    };

    // Leaving these seven letters behind is a two-step action: a game can
    // represent days of play, and a stray tap must not destroy it. The first
    // tap only relabels the button; any other action on the screen (typing a
    // word, in practice — the two other buttons navigate away) puts it back.
    let abandonConfirm = false;
    const abandonButton = button('Abandonner ces lettres', () => {
      if (abandonConfirm) {
        game.abandon();
        startGame();
        return;
      }
      abandonConfirm = true;
      abandonButton.textContent = 'Confirmer l’abandon';
    }, { className: 'bouton bouton--discret' });

    // The armed button must never survive another action. That holds today
    // because every control staying on this screen goes through `submit()`, and
    // every control leaving it tears the button down with the DOM. Any new
    // in-place control has to call this too.
    function resetAbandon() {
      if (!abandonConfirm) return;
      abandonConfirm = false;
      abandonButton.textContent = 'Abandonner ces lettres';
    }

    function submit() {
      resetAbandon();
      const attempt = field.value.trim();
      if (!attempt) return;
      const result = game.propose(attempt);
      if (result.ok) {
        feedback.className = 'retour succes';
        feedback.textContent = `${result.word} — ${result.length} lettres.`;
      } else {
        feedback.className = 'retour erreur';
        feedback.textContent =
          MESSAGES[result.reason] ?? `«\u00a0${attempt}\u00a0» n’est pas dans le dictionnaire.`;
      }
      field.value = '';
      field.focus();
      refresh();
    }

    field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') submit();
    });
    refresh();

    container.replaceChildren(
      element('h1', { text: 'Trouver tous les mots' }),
      tiles,
      compteur,
      field,
      button('Proposer', submit),
      feedback,
      liste,
      button('Voir ce qui manque', finish, { className: 'bouton bouton--discret' }),
      button('Reprendre plus tard', onQuit, { className: 'bouton bouton--discret' }),
      abandonButton
    );
  }

  function finish() {
    fermerPopup?.();
    const result = game.finish();
    const { isRecord } = stats.record('tous-les-mots', result.found);
    // Every word in the rack found, some of them, or none — the ratio is what
    // decides the tone, since "found 4" means something different on a rack
    // of 5 than on a rack of 40.
    const tier = result.found === 0 ? 'encourageant'
      : result.found === result.total ? 'excellent' : 'bien';
    fermerPopup = showPopup(
      isRecord ? `${messageRecord()} ${messageFin(tier)}` : messageFin(tier)
    );
    const scoreText =
      `${result.found} ${agree(result.found, 'mot')} ${agree(result.found, 'trouvé')} ` +
      `sur ${result.total}`;
    // He may find every word there is: an empty disclosure with a "0 mots
    // manqués" label would be a failed ending, not a celebration.
    const missedSection = result.missed.length === 0
      ? element('p', { text: 'Vous les avez tous trouvés.' })
      : element('details', {}, [
          element('summary', {
            // French takes the article or the numeral, never both: "le 1 mot
            // manqué" is not a sentence anyone writes.
            text:
              result.missed.length === 1
                ? 'Voir le mot manqué'
                : `Voir les ${result.missed.length} mots manqués`,
          }),
          element('p', { class: 'manques', text: result.missed.join(', ') }),
        ]);
    container.replaceChildren(
      element('h1', { text: 'Partie terminée' }),
      element('p', { class: 'score', text: scoreText }),
      missedSection,
      button('Nouvelle partie', startGame),
      button('Retour', onQuit, { className: 'bouton bouton--discret' })
    );
  }

  // Named for what it actually does: `createAllWords` resumes a saved game at
  // least as often as it starts one, whenever a save is found in storage.
  function startGame() {
    game = createAllWords({
      solver, lexicon, storage, frequencies,
      rng: createRng(seedFromString(String(Date.now()))),
    });
    render();
  }

  startGame();
  return () => { fermerPopup?.(); };
}
