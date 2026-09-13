// games/sequence/son.js
// The four sounds, synthesised. No audio files: nothing to download, nothing to
// cache, and the sound works offline like everything else.
//
// Sound must never be what breaks the game. On a device without Web Audio, or
// when the context refuses to start, the sequence plays silently and the colours
// and shapes carry it alone — which is why they exist.

import { ZONES } from './zones.js';

const PAR_ID = new Map(ZONES.map((z) => [z.id, z]));

export function createSound({ audioContext } = {}) {
  const contexte = audioContext === undefined
    ? creerContexte()
    : audioContext;
  let muted = false;

  function creerContexte() {
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    return Ctx ? new Ctx() : null;
  }

  /**
   * Android starts the context suspended until a real user gesture, so this
   * must be called from a tap handler. A refusal is not an error worth stopping
   * for: the game stays playable without sound.
   */
  async function resume() {
    if (!contexte) return;
    try {
      if (contexte.state !== 'running') await contexte.resume();
    } catch {
      // Silently silent.
    }
  }

  function play(zoneId, { duree = 0.35 } = {}) {
    if (!contexte || muted) return;
    if (contexte.state !== 'running') return;
    const zone = PAR_ID.get(zoneId);
    if (!zone) return;

    const maintenant = contexte.currentTime;
    const oscillateur = contexte.createOscillator();
    const volume = contexte.createGain();
    oscillateur.type = zone.onde;
    oscillateur.frequency.value = zone.hz;
    // A short fade at each end: a square wave switched on instantly clicks, and
    // a click is what an older ear hears instead of the note.
    volume.gain.setValueAtTime(0, maintenant);
    volume.gain.linearRampToValueAtTime(0.2, maintenant + 0.02);
    volume.gain.linearRampToValueAtTime(0, maintenant + duree);
    oscillateur.connect(volume);
    volume.connect(contexte.destination);
    oscillateur.start(maintenant);
    oscillateur.stop(maintenant + duree);
  }

  /**
   * Releases the audio device. mountSequence creates one of these per visit
   * to the screen and never reused it across mounts — without this, the
   * final review measured about fifty AudioContexts surviving in one
   * session before Chromium started refusing new ones and the game went
   * silently mute. The cleanup a screen returns must call this.
   */
  function close() {
    if (!contexte) return;
    try {
      // AudioContext.close() returns a promise that REJECTS if the context
      // is already closed — a plain try/catch only guards the synchronous
      // throw, not that later rejection. Wrapping the result in
      // Promise.resolve() lets the same .catch() swallow both, and
      // returning the chain lets a test await it instead of trusting that
      // no crash means no unhandled rejection escaped.
      return Promise.resolve(contexte.close()).catch(() => {});
    } catch {
      // Already closed, or closing isn't supported: nothing left to release.
    }
  }

  return {
    resume,
    play,
    close,
    setMuted(valeur) { muted = Boolean(valeur); },
    get muted() { return muted; },
    get disponible() { return Boolean(contexte); },
  };
}
