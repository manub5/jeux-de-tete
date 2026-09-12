# tests/navigateur/essai_hauteurs.py
"""Aucun écran ne doit cacher une commande sous le pli, aux deux formats.

Le défaut N1 du lot 4 — deux boutons du sudoku invisibles sans faire défiler —
n'a été trouvé que parce qu'une assertion visait par hasard cet écran-là. Ce
script passe chaque écran de chaque jeu, aux deux formats du cahier des
charges, et mesure le bas réel de chaque bouton. Le destinataire ne saura
jamais qu'il faut faire défiler pour trouver une commande.
"""

from __future__ import annotations

from commun import BASE, MENU_PRET, Rapport, nettoyer
from playwright.sync_api import Error as ErreurPlaywright
from playwright.sync_api import sync_playwright

rapport = Rapport()
dit = rapport.dit

FORMATS = [(360, 780), (393, 851)]

#: The bottom edge of the page's content, and of every button on it.
BAS = """() => {
  const bas = Math.max(...[...document.querySelectorAll('#app *')]
    .filter(e => e.getBoundingClientRect().height > 0)
    .map(e => e.getBoundingClientRect().bottom));
  const boutons = [...document.querySelectorAll('#app button')]
    .map(b => ({ texte: b.textContent.trim(),
                 bas: Math.round(b.getBoundingClientRect().bottom) }));
  return { bas: Math.round(bas), boutons };
}"""

#: One screen: a name, and the taps that reach it from the home page.
ECRANS = [
    ("accueil", []),
    # These two games have no level screen: one tap opens the game.
    ("mot le plus long — partie", ["Le mot le plus long"]),
    ("mot le plus long — fin", ["Le mot le plus long", "J’ai terminé"]),
    ("anagrammes — niveaux", ["Anagrammes"]),
    ("anagrammes — partie", ["Anagrammes", "Facile"]),
    ("tous les mots — partie", ["Trouver tous les mots"]),
    ("tous les mots — fin", ["Trouver tous les mots", "Voir ce qui manque"]),
    ("motus — accueil", ["Motus"]),
    ("motus — partie", ["Motus", "Le mot du jour"]),
    ("sudoku — niveaux", ["Sudoku"]),
    ("sudoku — facile", ["Sudoku", "Facile"]),
    ("sudoku — moyen", ["Sudoku", "Moyen"]),
    ("sudoku — difficile", ["Sudoku", "Difficile"]),
    # The level screen grows a paragraph and a "Reprendre" button once a grid
    # is under way: it is not the same screen as the one above.
    (
        "sudoku — niveaux, grille en cours",
        ["Sudoku", "Facile", "Reprendre plus tard", "Sudoku"],
    ),
    ("paires — niveaux", ["Les paires"]),
    ("paires — difficile", ["Les paires", "Difficile — 30 paires"]),
    ("séquence — accueil", ["La séquence"]),
    ("séquence — partie", ["La séquence", "Commencer"]),
]

with sync_playwright() as pw:
    nav = pw.chromium.launch()
    for larg, haut in FORMATS:
        dit(f"=== {larg} x {haut} ===")
        ctx = nav.new_context(
            viewport={"width": larg, "height": haut}, is_mobile=True, has_touch=True
        )
        page = ctx.new_page()
        nettoyer(page)

        for nom, chemin in ECRANS:
            page.goto(BASE, wait_until="networkidle")
            page.wait_for_function(MENU_PRET, timeout=60000)
            try:
                for clic in chemin:
                    page.click(f"text={clic}")
                    page.wait_for_timeout(400)
            except ErreurPlaywright as erreur:
                rapport.echec(f"{nom} à {larg}x{haut} : chemin injouable ({erreur})")
                dit(f"  RATE {nom} : chemin injouable")
                continue

            mesure = page.evaluate(BAS)
            caches = [b for b in mesure["boutons"] if b["bas"] > haut]
            # The rule is not "everything fits": a list of results that scrolls
            # is legitimate, and a check that cries wolf ends up ignored. What
            # matters is that no COMMAND is out of sight — he will not know he
            # has to scroll to find one.
            defile = (
                ""
                if mesure["bas"] <= haut
                else f" (le contenu défile jusqu'à {mesure['bas']})"
            )
            if not caches:
                dit(f"  OK   {nom} : tous les boutons visibles{defile}")
            else:
                noms = ", ".join(f"« {b['texte']} »" for b in caches)
                dit(f"  RATE {nom} : sous le pli : {noms}{defile}")
                rapport.echec(f"{nom} à {larg}x{haut} — bouton hors de vue : {noms}")
        ctx.close()
    nav.close()

rapport.sortir("Aucune commande hors de vue, sur tous les écrans, aux deux formats.")
