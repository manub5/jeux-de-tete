# tests/navigateur/essai_ensemble.py
"""Les jeux des lots 1 et 2, et ce que les cinq écrans partagent.

Les cibles tactiles, la largeur, le corps de texte et l'ouverture hors ligne
sont les règles du cahier des charges qu'aucun jeu ne peut enfreindre seul :
elles sont vérifiées ici une fois pour tous.
"""

from __future__ import annotations

from commun import BASE, Rapport, au_menu, bruit, nettoyer, surveiller_console
from playwright.sync_api import sync_playwright

rapport = Rapport()
dit = rapport.dit
exige = rapport.exige

#: Everything clickable, with the size it actually occupies on screen.
CIBLES = """() => [...document.querySelectorAll('button, summary, input')]
  .map(e => ({ t: (e.textContent || e.tagName).trim().slice(0, 26),
               h: Math.round(e.getBoundingClientRect().height),
               w: Math.round(e.getBoundingClientRect().width) }))
  .filter(e => e.h < 48 || e.w < 48)"""

DEBORDE = "() => document.documentElement.scrollWidth > window.innerWidth + 1"

ECRANS = [
    ("accueil", None, "#app button"),
    ("le mot le plus long", "Le mot le plus long", ".jeton"),
    ("anagrammes", "Anagrammes", ".niveaux button"),
    ("trouver tous les mots", "Trouver tous les mots", ".compteur"),
    ("motus", "Motus", "text=Le mot du jour"),
    ("sudoku", "Sudoku", "text=Facile"),
]

HORS_LIGNE = [
    ("Le mot le plus long", ".jeton"),
    ("Anagrammes", "text=Quel niveau"),
    ("Trouver tous les mots", ".compteur"),
    ("Motus", "text=Le mot du jour"),
    ("Sudoku", "text=Facile"),
]

with sync_playwright() as pw:
    nav = pw.chromium.launch()
    ctx = nav.new_context(
        viewport={"width": 360, "height": 780}, is_mobile=True, has_touch=True
    )
    page = ctx.new_page()
    console = surveiller_console(page)
    nettoyer(page)

    dit("== Les jeux des lots 1 et 2, toujours jouables ==")
    page.click("text=Le mot le plus long")
    page.wait_for_selector(".jeton", timeout=30000)
    exige(
        page.locator(".jeton").count() == 10,
        "« le mot le plus long » distribue dix lettres",
    )
    au_menu(page)

    page.click("text=Anagrammes")
    page.wait_for_selector("text=Quel niveau")
    page.click(".niveaux button >> nth=0")
    page.wait_for_selector(".jeton")
    exige(
        page.locator(".jeton").count() == page.locator(".place").count(),
        "les anagrammes distribuent autant de jetons que de places",
    )
    au_menu(page)

    page.click("text=Trouver tous les mots")
    page.wait_for_selector(".compteur")
    compteur = page.locator(".compteur").inner_text()
    dit(f"  compteur : {compteur!r}")
    exige(
        page.locator(".jeton").count() == 7,
        "« trouver tous les mots » distribue sept lettres",
    )
    exige(compteur.startswith("0 mot sur "), "le compteur accorde le zéro au singulier")
    au_menu(page)

    dit("== Cibles tactiles et largeur, les cinq écrans ==")
    corps = page.evaluate("() => parseFloat(getComputedStyle(document.body).fontSize)")
    exige(corps >= 18, f"le corps de texte fait au moins 18 px (il fait {corps})")

    for nom, ouvrir, marqueur in ECRANS:
        au_menu(page)
        if ouvrir:
            page.click(f"text={ouvrir}")
        page.wait_for_selector(marqueur, timeout=30000)
        page.wait_for_timeout(200)
        petits = page.evaluate(CIBLES)
        dit(f"  [{nom}] sous 48 px : {petits or 'aucun'}")
        exige(not petits, f"[{nom}] toutes les cibles tactiles font 48 px")
        exige(
            not page.evaluate(DEBORDE),
            f"[{nom}] l'écran ne déborde pas en largeur à 360 px",
        )

    dit("== La grille de huit lettres de Motus tient à l'écran ==")
    au_menu(page)
    page.click("text=Motus")
    page.wait_for_selector("text=Le mot du jour")
    page.click("text=8 lettres")
    page.wait_for_selector(".grille")
    mesures = page.evaluate(
        """() => {
             const c = document.querySelector('.case').getBoundingClientRect();
             const bas = Math.max(...[...document.querySelectorAll('#app > * > *')]
               .map(e => e.getBoundingClientRect().bottom));
             return { l: Math.round(c.width), h: Math.round(c.height),
                      deborde: document.documentElement.scrollWidth > window.innerWidth + 1,
                      bas: Math.round(bas) };
           }"""
    )
    dit(f"  case : {mesures['l']}x{mesures['h']} px, bas de page {mesures['bas']} px")
    exige(not mesures["deborde"], "la grille de huit lettres ne déborde pas à 360 px")

    dit("== Hors ligne, les cinq jeux ==")
    page.goto(BASE, wait_until="networkidle")
    # The service worker takes a moment to fill its cache after registering.
    page.wait_for_timeout(2500)
    exige(
        page.evaluate("() => !!navigator.serviceWorker.controller"),
        "la page est contrôlée par le service worker",
    )
    caches = page.evaluate("() => caches.keys()")
    dit(f"  caches : {caches}")
    exige(any("v5" in c for c in caches), "le cache est en v5")
    ctx.set_offline(True)
    for jeu, marqueur in HORS_LIGNE:
        au_menu(page)
        page.click(f"text={jeu}")
        page.wait_for_selector(marqueur, timeout=30000)
        exige(True, f"hors ligne, « {jeu} » s'ouvre")
    ctx.set_offline(False)

    dit("== La console ==")
    for ligne in bruit(console):
        dit(f"  {ligne}")
    exige(not bruit(console), "aucune erreur ni avertissement en console")

    nav.close()

rapport.sortir()
