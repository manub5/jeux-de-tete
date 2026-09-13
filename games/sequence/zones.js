// games/sequence/zones.js
// The four zones. Each carries a colour, a SHAPE and a SOUND, all three
// distinct: the spec forbids leaning on colour alone, and the four sounds must
// not differ by pitch alone either — an older ear loses the high end first, and
// four sine waves would then be indistinguishable. Hence one waveform each.
//
// The pitches sit between 200 and 800 Hz, where a phone speaker is loudest and
// hearing loss bites least, and are spaced at least two tones apart.
//
// Colours: each is used both ways — the shape traced in currentColor (white)
// on the zone's own colour tile in light theme, and read against the dark
// theme's page background --fond (css/base.css, dark block: #15171a). Every
// ratio below is computed from the WCAG relative-luminance formula (not
// eyeballed — this project has shipped a wrong estimate before: 2.43:1
// claimed, 7.54:1 real). Floor for an interface element is 3:1; the brief's
// first four colours (#1f6f4a, #1d4e89, #9a4f06, #5b3a8e) failed the
// dark-fond side (2.93, 2.14, 2.99, 2.09:1) and were replaced here, in the
// same hue family, with lighter shades that clear 3:1 on both sides.

export const ZONES = [
  {
    id: 'rond',
    libelle: 'le rond vert',
    couleur: '#288a5d', // vs #ffffff: 4.30:1 — vs --fond dark #15171a: 4.18:1
    corps: '<circle cx="50" cy="50" r="34" fill="currentColor"/>',
    hz: 262,
    onde: 'sine',
  },
  {
    id: 'carre',
    libelle: 'le carré bleu',
    couleur: '#3d7bc7', // vs #ffffff: 4.32:1 — vs --fond dark #15171a: 4.15:1
    corps: '<rect x="18" y="18" width="64" height="64" fill="currentColor"/>',
    hz: 330,
    onde: 'triangle',
  },
  {
    id: 'triangle',
    libelle: 'le triangle orange',
    couleur: '#aa6e31', // vs #ffffff: 4.21:1 — vs --fond dark #15171a: 4.26:1
    corps: '<path d="M50 14 L86 80 L14 80 Z" fill="currentColor"/>',
    hz: 415,
    onde: 'square',
  },
  {
    id: 'losange',
    libelle: 'le losange violet',
    couleur: '#8c63de', // vs #ffffff: 4.24:1 — vs --fond dark #15171a: 4.24:1
    corps: '<path d="M50 12 L88 50 L50 88 L12 50 Z" fill="currentColor"/>',
    hz: 523,
    onde: 'sawtooth',
  },
];
