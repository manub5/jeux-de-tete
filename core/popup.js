// core/popup.js
// A small notification that pops in at the top of the screen, announces
// itself, and goes away on its own — never a modal. It must never stand
// between him and a button he can already see: several screens are measured
// to the pixel by tests/navigateur/essai_hauteurs.py, and a backdrop that
// blocks a tap is the one thing this file must not become. It is appended to
// `document.body`, outside `#app` entirely, so nothing it does can move a
// single button that screen measures.

const DELAI_AFFICHAGE = 2600; // ms before it dismisses itself
const DUREE_ANIMATION = 220; // ms — matches the CSS keyframes below

/**
 * Shows `texte` in a pill at the top of the screen. Dismisses itself after a
 * few seconds, or right away on a tap. Returns a function that closes it
 * early — a screen navigated away from must be able to take its own popup
 * down with it, the same way every screen already cancels its own timers on
 * the way out.
 */
export function showPopup(texte, { className = '' } = {}) {
  const reduitMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const popup = document.createElement('div');
  popup.className = `popup${className ? ` ${className}` : ''}`;
  popup.setAttribute('role', 'status');
  popup.textContent = texte;
  document.body.append(popup);

  let fermee = false;
  let partie = false;
  function partir() {
    if (partie) return;
    partie = true;
    popup.remove();
  }
  function fermer() {
    if (fermee) return;
    fermee = true;
    clearTimeout(minuterie);
    if (reduitMotion) {
      partir();
      return;
    }
    popup.classList.add('popup--sort');
    popup.addEventListener('animationend', partir, { once: true });
    // Belt and braces: a display:none ancestor, or any path that skips
    // `animationend`, must still take the popup down eventually.
    setTimeout(partir, DUREE_ANIMATION + 50);
  }

  popup.addEventListener('click', fermer);
  const minuterie = setTimeout(fermer, DELAI_AFFICHAGE);

  return fermer;
}
