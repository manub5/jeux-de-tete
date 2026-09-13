// core/stats-screen.js
// The one screen the spec asks for: every game's numbers gathered in one
// place, in big readable digits, never a chart. Not a game, so it lives here
// rather than under games/ — same reasoning as core/router.js's `accueil`.

import { element, button } from './ui.js';
import { exportBackup, importBackup } from './backup.js';

const NOM_FICHIER = 'jeux-de-tete-sauvegarde.json';

export function mountStatistiques(container, { stats, storage, games, onQuit }) {
  const gameIds = games.map((g) => g.id);

  function ligneJeu(jeu) {
    const donnees = stats.read(jeu.id);
    const enfants = [element('h2', { text: jeu.title })];
    if (donnees.played === 0) {
      enfants.push(element('p', { class: 'sous-titre', text: 'Pas encore joué.' }));
    } else {
      enfants.push(element('div', { class: 'chiffres-stats' }, [
        element('div', { class: 'chiffre-stat' }, [
          element('strong', { text: String(donnees.played) }),
          element('span', { text: donnees.played > 1 ? 'parties' : 'partie' }),
        ]),
        element('div', { class: 'chiffre-stat' }, [
          element('strong', { text: String(donnees.best) }),
          element('span', { text: 'record' }),
        ]),
        element('div', { class: 'chiffre-stat' }, [
          element('strong', { text: String(donnees.average) }),
          element('span', { text: 'moyenne (10 dern.)' }),
        ]),
      ]));
    }
    return element('div', { class: 'ligne-stats' }, enfants);
  }

  function telecharger() {
    const donnees = exportBackup(storage, gameIds);
    const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const lien = element('a', { href: url, download: NOM_FICHIER });
    lien.click();
    URL.revokeObjectURL(url);
  }

  function restaurer(fichierInput, message) {
    const [fichier] = fichierInput.files;
    fichierInput.value = '';
    if (!fichier) return;
    fichier.text()
      .then((texte) => {
        let analyse;
        try {
          analyse = JSON.parse(texte);
        } catch {
          message.textContent = 'Ce fichier n’est pas une sauvegarde lisible.';
          return;
        }
        const ok = importBackup(storage, gameIds, analyse);
        if (ok) {
          // render() replaces the whole screen, including this very `message`
          // node: setting its textContent first and re-rendering right after
          // throws that text away before the browser ever paints it. The
          // confirmation has to be handed to the new node render() builds.
          render('Sauvegarde restaurée.');
        } else {
          message.textContent = 'Ce fichier n’a pas la forme d’une sauvegarde de ce jeu.';
        }
      })
      .catch(() => {
        message.textContent = 'Ce fichier n’a pas pu être lu.';
      });
  }

  function render(messageInitial = '') {
    const streak = stats.streak();
    const message = element('p', { class: 'sous-titre', role: 'status', text: messageInitial });
    const fichierInput = element('input', {
      type: 'file', accept: 'application/json',
    });
    fichierInput.hidden = true;
    fichierInput.addEventListener('change', () => restaurer(fichierInput, message));

    container.replaceChildren(
      element('div', {}, [
        element('h1', { text: 'Statistiques' }),
        streak > 1
          ? element('p', { text: `${streak} jours d’affilée.` })
          : element('p', { class: 'sous-titre', text: 'Reviens demain pour commencer une série.' }),
        element('div', { class: 'lignes-stats' }, games.map(ligneJeu)),
        message,
        fichierInput,
        element('div', { class: 'actions-stats' }, [
          button('Sauvegarder mes scores', telecharger,
            { className: 'bouton bouton--discret' }),
          button('Restaurer', () => fichierInput.click(),
            { className: 'bouton bouton--discret' }),
        ]),
        button('Retour', onQuit, { className: 'bouton bouton--discret' }),
      ])
    );
  }

  render();
  return () => {};
}
