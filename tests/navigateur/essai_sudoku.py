# tests/navigateur/essai_sudoku.py
"""Une partie de sudoku jouée en entier, puis un scénario par correctif.

Les scénarios « correctif » sont écrits pour rougir quand on remet le défaut :
chacun porte en commentaire le mutant qui doit le faire tomber. Leur preuve est
dans .superpowers/sdd/2026-09-11-lot4-sudoku/task-8-fix-3-report.md.
"""

from __future__ import annotations

import re

from commun import (
    BASE,
    MENU_PRET,
    Rapport,
    au_menu,
    bruit,
    nettoyer,
    surveiller_console,
)
from playwright.sync_api import Locator, Page, sync_playwright

rapport = Rapport()
dit = rapport.dit
exige = rapport.exige

#: The button label carries a no-break space before the colon — French
#: typography, and it also stops "Notes" and ": non" landing on two lines.
#: Written as an escape: an invisible character in the source is the kind of
#: thing a later edit silently drops.
NOTES_NON = "Notes\u00a0: non"
NOTES_OUI = "Notes\u00a0: oui"

#: The answer to the grid on screen, computed with the application's own solver.
SOLUTION = """async () => {
  const { solve } = await import(new URL('./games/sudoku/solver.js', location.href).href);
  const grille = new Int8Array(81);
  document.querySelectorAll('.case-sudoku').forEach((c, i) => {
    const chiffre = c.querySelector('.chiffre-sudoku');
    grille[i] = chiffre ? Number(chiffre.textContent) : 0;
  });
  return [...solve(grille)];
}"""

#: The cells the player still has to fill.
VIDES = """() => [...document.querySelectorAll('.case-sudoku')]
  .map((c, i) => c.textContent.trim() ? -1 : i).filter(i => i >= 0)"""

#: The height of each of the nine rows, read off the first cell of each. The
#: grid keeps its total height whatever happens inside it, so a deformation
#: never shows up as a grid that grew — only as rows that stopped being equal.
HAUTEURS_RANGEES = """() => {
  const cases = [...document.querySelectorAll('.case-sudoku')];
  return [...Array(9).keys()]
    .map(r => Math.round(cases[r * 9].getBoundingClientRect().height * 100) / 100);
}"""

#: What the pencil marks of one cell actually look like on screen: the digits
#: in order, how many distinct columns and rows they occupy, the glyph size,
#: and whether any of them spills out of the cell.
NOTES_POSEES = """(cell) => {
  const c = document.querySelectorAll('.case-sudoku')[cell];
  const notes = [...c.querySelectorAll('.note-sudoku')];
  const boite = c.getBoundingClientRect();
  const rects = notes.map(n => n.getBoundingClientRect());
  return {
    chiffres: notes.map(n => n.textContent),
    colonnes: new Set(rects.map(r => Math.round(r.left))).size,
    rangees: new Set(rects.map(r => Math.round(r.top))).size,
    // Each mark's corner, relative to the cell: where a given digit is written
    // must not depend on how many others are written beside it.
    places: Object.fromEntries(notes.map((n, i) => [n.textContent,
      [Math.round(rects[i].left - boite.left), Math.round(rects[i].top - boite.top)]])),
    police: notes.length ? parseFloat(getComputedStyle(notes[0]).fontSize) : 0,
    debordement: rects.filter(r =>
      r.left < boite.left - 0.5 || r.right > boite.right + 0.5 ||
      r.top < boite.top - 0.5 || r.bottom > boite.bottom + 0.5).length,
  };
}"""

#: Fill cells from JavaScript. `refresh()` rebuilds the 81 cell buttons after
#: every move, so they are looked up again each turn; the keypad is built once.
#: Used only where a finished grid is a precondition rather than the subject —
#: the play-through above does the same moves through real clicks.
REMPLIR = """([cibles, solution]) => {
  const touches = [...document.querySelectorAll('.touche-sudoku')];
  for (const cell of cibles) {
    document.querySelectorAll('.case-sudoku')[cell].click();
    touches[solution[cell] - 1].click();
  }
}"""

#: Place the last digit and leave the screen inside the same task, so the
#: departure lands well within the 300 ms the end screen is deferred by.
FINIR_PUIS_PARTIR = """([cell, chiffre]) => {
  document.querySelectorAll('.case-sudoku')[cell].click();
  [...document.querySelectorAll('.touche-sudoku')][chiffre - 1].click();
  [...document.querySelectorAll('#app button')]
    .find((b) => b.textContent.trim() === 'Reprendre plus tard')
    .click();
}"""

#: Place the last digit, abandon the grid and start another, all in the same
#: task — the whole sequence lands inside the 300 ms the end screen waits.
FINIR_ABANDONNER_RELANCER = """([cell, chiffre]) => {
  const bouton = (t) => [...document.querySelectorAll('#app button')]
    .find((b) => b.textContent.trim().startsWith(t));
  document.querySelectorAll('.case-sudoku')[cell].click();
  [...document.querySelectorAll('.touche-sudoku')][chiffre - 1].click();
  bouton('Abandonner').click();
  bouton('Confirmer').click();
  bouton('Facile').click();
}"""

#: What a screen reader is handed on the playing screen: the roles declared,
#: and the labels the 81 cells carry. `status` is the project's only role, on
#: live regions; anything composite promises a structure this markup has not.
ACCESSIBILITE = """() => {
  const cases = [...document.querySelectorAll('.case-sudoku')];
  const etiquettes = cases.map(c => c.getAttribute('aria-label') || '');
  return {
    roles: [...new Set([...document.querySelectorAll('#app [role]')]
      .map(e => e.getAttribute('role')))].sort(),
    etiquettes: etiquettes.filter(e => /^ligne [1-9], colonne [1-9], /.test(e)).length,
    exemple: etiquettes.find(e => /, (vide|[1-9])(, en conflit)?$/.test(e)) ?? null,
  };
}"""

#: A save the menu used to accept and the resume always refused: the level is
#: one of the three, but the puzzle is empty, so it has thousands of answers
#: and no single grid to come back to.
SAUVEGARDE_IMPOSSIBLE = """() => localStorage.setItem('jp:sudoku.partie', JSON.stringify({
  difficulty: 'facile',
  puzzle: new Array(81).fill(0),
  values: new Array(81).fill(0),
  notes: Array.from({ length: 81 }, () => []),
  mistakes: [],
}))"""

ETAT = """() => ({
  titre: document.querySelector('#app h1') ? document.querySelector('#app h1').textContent : null,
  scores: document.querySelectorAll('.score').length,
  stats: JSON.parse(localStorage.getItem('jp:stats.sudoku') || 'null'),
})"""


def commande(page: Page, motif: str) -> Locator:
    """The on-screen control whose label matches `motif`."""
    return page.locator("#app button").filter(has_text=re.compile(motif)).first


def etiquette_abandon(page: Page) -> str:
    return commande(page, "Abandonner|Confirmer").inner_text().strip()


def niveau_bouton(page: Page, niveau: str) -> Locator:
    """The level BUTTON, never the sentence that names the same level.

    Once a grid is under way the menu opens with "Une grille facile est en
    cours." — and `text=Facile` matches that paragraph first, so the click
    lands on a paragraph and nothing happens.
    """
    return commande(page, f"^{niveau}$")


def ouvrir_grille(page: Page, niveau: str = "Facile") -> None:
    """From anywhere: home, Sudoku, a brand new grid at `niveau`."""
    au_menu(page)
    page.click("text=Sudoku")
    page.wait_for_selector("text=Ou une nouvelle grille")
    niveau_bouton(page, niveau).click()
    page.wait_for_selector(".grille-sudoku")


def abandonner(page: Page) -> None:
    """The two taps the abandon button demands, back to the sudoku menu."""
    page.click("text=Abandonner cette grille")
    page.click("text=Confirmer")
    page.wait_for_selector("text=Ou une nouvelle grille")


with sync_playwright() as pw:
    nav = pw.chromium.launch()
    ctx = nav.new_context(
        viewport={"width": 360, "height": 780}, is_mobile=True, has_touch=True
    )
    page = ctx.new_page()
    console = surveiller_console(page)
    nettoyer(page)

    dit("== L'accueil, cinq jeux ==")
    boutons = page.locator("#app button").all_text_contents()
    dit(f"  {boutons}")
    exige("Sudoku" in boutons, "le menu propose le sudoku")
    exige(len(boutons) >= 5, "le menu liste cinq jeux")

    dit("== Motus n'a pas bougé ==")
    page.click("text=Motus")
    page.wait_for_selector("text=Le mot du jour")
    page.click("text=Le mot du jour")
    page.wait_for_selector(".grille")
    lignes = page.evaluate(
        """() => {
             const l = document.querySelectorAll('.ligne');
             const premiere = l[0].getBoundingClientRect();
             const seconde = l[1].getBoundingClientRect();
             return { lignes: l.length, empilees: seconde.top > premiere.top + 5,
                      bordure: getComputedStyle(document.querySelector('.case')).borderTopWidth };
           }"""
    )
    dit(f"  {lignes}")
    exige(lignes["lignes"] == 6, "Motus dessine toujours ses six essais")
    exige(lignes["empilees"], "ses lignes restent EMPILÉES, pas côte à côte")
    exige(lignes["bordure"] != "0px", "ses cases gardent leur bordure")

    dit("== Le sudoku ==")
    au_menu(page)
    page.click("text=Sudoku")
    page.wait_for_selector("text=Facile")
    niveaux = page.locator("#app button").all_text_contents()
    dit(f"  niveaux : {niveaux}")
    for niveau in ("Facile", "Moyen", "Difficile"):
        exige(niveau in niveaux, f"le niveau {niveau} est proposé")

    debut = page.evaluate("() => performance.now()")
    niveau_bouton(page, "Facile").click()
    page.wait_for_selector(".grille-sudoku")
    duree = page.evaluate("() => performance.now()") - debut
    dit(f"  la grille apparaît en {duree:.0f} ms")
    exige(duree < 1000, f"la grille apparaît sans attente perceptible ({duree:.0f} ms)")

    mesures = page.evaluate(
        """() => {
             const t = document.querySelector('.touche-sudoku').getBoundingClientRect();
             const bas = Math.max(...[...document.querySelectorAll('#app > * > *')]
               .map(e => e.getBoundingClientRect().bottom));
             return { toucheH: Math.round(t.height), bas: Math.round(bas),
                      large: document.documentElement.scrollWidth > window.innerWidth + 1,
                      cases: document.querySelectorAll('.case-sudoku').length,
                      indices: document.querySelectorAll('.case-sudoku--indice').length };
           }"""
    )
    dit(f"  {mesures}")
    exige(mesures["cases"] == 81, "la grille a bien 81 cases")
    exige(
        mesures["indices"] >= 36,
        f"elle porte au moins 36 indices ({mesures['indices']})",
    )
    exige(not mesures["large"], "elle ne déborde pas en largeur à 360 px")
    exige(mesures["bas"] <= 780, f"tout tient dans l'écran ({mesures['bas']} px)")
    exige(mesures["toucheH"] >= 48, f"les touches font 48 px ({mesures['toucheH']})")

    dit("== Jouer ==")
    solution = page.evaluate(SOLUTION)
    vides = page.evaluate(VIDES)
    dit(f"  {len(vides)} cases à remplir")

    page.locator(".case-sudoku").nth(vides[0]).click()
    exige(
        page.locator(".case-sudoku--choisie").count() == 1,
        "toucher une case la sélectionne",
    )
    page.click(f".touche-sudoku >> text='{solution[vides[0]]}'")
    page.wait_for_timeout(80)
    exige(
        page.locator(".case-sudoku").nth(vides[0]).inner_text().strip()
        == str(solution[vides[0]]),
        "le chiffre se pose",
    )

    # A wrong digit: counted, named, and not by colour alone.
    faux = 1 if solution[vides[1]] != 1 else 2
    page.locator(".case-sudoku").nth(vides[1]).click()
    page.click(f".touche-sudoku >> text='{faux}'")
    page.wait_for_timeout(80)
    compteur = page.locator(".sous-titre").first.inner_text()
    dit(f"  après un chiffre faux : {compteur!r}")
    exige("1 erreur" in compteur, "l'erreur est comptée et affichée")

    page.click("text=Annuler")
    page.wait_for_timeout(80)
    exige(
        page.locator(".case-sudoku").nth(vides[1]).inner_text().strip() == "",
        "annuler retire le chiffre",
    )
    page.click("text=Refaire")
    page.wait_for_timeout(80)
    exige(
        page.locator(".case-sudoku").nth(vides[1]).inner_text().strip() == str(faux),
        "refaire le repose",
    )
    exige(
        "1 erreur" in page.locator(".sous-titre").first.inner_text(),
        "l'erreur reste comptée après annulation",
    )
    page.click("text=Annuler")
    page.wait_for_timeout(80)

    dit("== Les notes ==")
    exige(
        commande(page, "^Notes").inner_text().strip() == NOTES_NON,
        "le libellé porte une espace insécable avant les deux-points",
    )
    page.locator(".case-sudoku").nth(vides[2]).click()
    commande(page, "^Notes").click()
    exige(
        commande(page, "^Notes").inner_text().strip() == NOTES_OUI,
        "le bouton dit « oui »",
    )
    # Nine marks, one at a time, and the nine row heights after each: two marks
    # was exactly one below the threshold, which is how a cell that grew by
    # 59 px reached the browser without a single check going red.
    reference = page.evaluate(HAUTEURS_RANGEES)
    dit(f"  rangées, aucune note : {reference}")
    deformees = []
    places_du_1 = []
    for chiffre in range(1, 10):
        page.click(f".touche-sudoku >> text='{chiffre}'")
        page.wait_for_timeout(60)
        hauteurs = page.evaluate(HAUTEURS_RANGEES)
        if hauteurs != reference:
            deformees.append((chiffre, hauteurs))
        places_du_1.append(tuple(page.evaluate(NOTES_POSEES, vides[2])["places"]["1"]))
    for chiffre, hauteurs in deformees:
        dit(f"  RANGÉES DÉFORMÉES à {chiffre} note(s) : {hauteurs}")
    exige(
        not deformees,
        "poser une à neuf notes ne change la hauteur d'aucune rangée",
    )
    dit(f"  la place du « 1 », de une à neuf notes : {sorted(set(places_du_1))}")
    exige(
        len(set(places_du_1)) == 1,
        "une note déjà posée ne bouge pas quand les suivantes s'ajoutent",
    )
    marques = page.evaluate(NOTES_POSEES, vides[2])
    dit(f"  neuf notes : {marques}")
    exige(marques["chiffres"] == list("123456789"), "les neuf notes s'affichent")
    exige(
        marques["colonnes"] == 3 and marques["rangees"] == 3,
        "elles se rangent en trois colonnes et trois rangées dans la case",
    )
    exige(
        marques["police"] >= 11,
        f"chaque note garde un glyphe lisible ({marques['police']} px)",
    )
    exige(
        marques["debordement"] == 0,
        "aucune note ne déborde de sa case",
    )
    # Back to two marks, the state the rest of the scenario expects.
    for chiffre in (1, 2, 4, 5, 6, 8, 9):
        page.click(f".touche-sudoku >> text='{chiffre}'")
    page.wait_for_timeout(80)
    deux = page.evaluate(NOTES_POSEES, vides[2])
    dit(f"  ramené à deux notes : {deux}")
    exige(deux["chiffres"] == ["3", "7"], "une note retouchée s'efface")
    # `.get` rather than `[...]`: when the check above has already failed, a
    # missing key here would raise and the script would report one failure
    # instead of every failure it could still find.
    exige(
        deux["places"] == {c: marques["places"].get(c) for c in ("3", "7")},
        "chaque chiffre garde sa place, qu'il soit seul ou entouré",
    )
    commande(page, "^Notes").click()
    page.click(f".touche-sudoku >> text='{solution[vides[2]]}'")
    page.wait_for_timeout(80)
    exige(
        page.locator(".case-sudoku").nth(vides[2]).inner_text().strip()
        == str(solution[vides[2]]),
        "poser un chiffre efface les notes",
    )

    dit("== Ce que le lecteur d'écran entend ==")
    # Mutant that must turn this red: put `role: 'grid'` back on the container
    # in games/sudoku/screen.js. A composite role declared without the rows
    # and cells it promises makes a reader announce a grid it cannot walk —
    # and it silences the 81 buttons that do carry the information.
    lecture = page.evaluate(ACCESSIBILITE)
    dit(f"  {lecture}")
    exige(
        lecture["roles"] == ["status"],
        f"aucun rôle composite n'est déclaré, seulement « status » ({lecture['roles']})",
    )
    exige(
        lecture["etiquettes"] == 81,
        f"les 81 cases portent chacune leur étiquette ({lecture['etiquettes']})",
    )
    exige(
        lecture["exemple"] is not None,
        f"une étiquette dit la ligne, la colonne et le contenu ({lecture['exemple']!r})",
    )

    dit("== La reprise ==")
    avant = page.evaluate(
        "() => [...document.querySelectorAll('.case-sudoku')].map(c => c.textContent.trim()).join('|')"
    )
    # Never `page.goto(BASE)` here: the current URL already carries `#sudoku`,
    # so nothing would be reloaded and the check would look at the very page it
    # claims to have replaced.
    page.reload(wait_until="networkidle")
    page.wait_for_function(MENU_PRET, timeout=60000)
    page.click("text=Sudoku")
    page.wait_for_selector("text=Reprendre")
    page.click("text=Reprendre")
    page.wait_for_selector(".grille-sudoku")
    apres = page.evaluate(
        "() => [...document.querySelectorAll('.case-sudoku')].map(c => c.textContent.trim()).join('|')"
    )
    exige(avant == apres, "la grille revient exactement comme elle était")
    exige(
        "1 erreur" in page.locator(".sous-titre").first.inner_text(),
        "le compte d'erreurs survit au rechargement",
    )

    dit("== Terminer, en cliquant vraiment ==")
    solution = page.evaluate(SOLUTION)
    restantes = page.evaluate(VIDES)
    dit(f"  {len(restantes)} cases restantes à remplir")
    for cell in restantes:
        page.locator(".case-sudoku").nth(cell).click()
        page.click(f".touche-sudoku >> text='{solution[cell]}'")
    page.wait_for_selector("text=Grille terminée", timeout=20000)
    score = page.locator(".score").inner_text()
    dit(f"  {score!r}")
    exige("1 erreur" in score, "l'écran de fin annonce l'erreur commise")

    stats = page.evaluate("() => JSON.parse(localStorage.getItem('jp:stats.sudoku'))")
    dit(f"  statistiques : {stats}")
    exige(bool(stats) and stats["played"] == 1, "une grille comptée, une seule")
    exige(bool(stats) and stats["best"] == 1, "le record vaut 1 erreur")

    # --- Correctif 1 -------------------------------------------------------
    # Mutant that must turn this red: remove `noting = false` from start().
    dit("== Correctif 1 : les notes ne survivent pas à une nouvelle grille ==")
    ouvrir_grille(page)
    commande(page, "^Notes").click()
    exige(
        commande(page, "^Notes").inner_text().strip() == NOTES_OUI,
        "les notes s'activent sur la grille en cours",
    )
    abandonner(page)
    niveau_bouton(page, "Facile").click()
    page.wait_for_selector(".grille-sudoku")
    exige(
        commande(page, "^Notes").inner_text().strip() == NOTES_NON,
        "la nouvelle grille annonce « Notes : non »",
    )
    premiere = page.evaluate(VIDES)[0]
    page.locator(".case-sudoku").nth(premiere).click()
    page.click(".touche-sudoku >> text='1'")
    page.wait_for_timeout(80)
    pose = page.evaluate(
        """(cell) => {
             const c = document.querySelectorAll('.case-sudoku')[cell];
             return { chiffres: c.querySelectorAll('.chiffre-sudoku').length,
                      notes: c.querySelectorAll('.note-sudoku').length };
           }""",
        premiere,
    )
    dit(f"  la case après un appui sur « 1 » : {pose}")
    exige(
        pose["chiffres"] == 1,
        "le premier chiffre tapé est un CHIFFRE, pas une annotation",
    )
    exige(pose["notes"] == 0, "aucune annotation n'a été posée à sa place")

    # --- Correctif 5 -------------------------------------------------------
    # Mutant that must turn this red: remove any one call to resetAbandon().
    # Every control that stays on screen is tried, so removing any single call
    # is caught.
    dit("== Correctif 5 : l'abandon demande deux appuis, et se désarme ==")
    exige(
        etiquette_abandon(page) == "Abandonner cette grille",
        "au départ le bouton propose d'abandonner",
    )
    page.click("text=Abandonner cette grille")
    exige(
        etiquette_abandon(page).startswith("Confirmer"),
        "un seul appui n'abandonne pas : il demande confirmation",
    )
    exige(
        page.locator(".grille-sudoku").count() == 1,
        "la grille est toujours là après ce premier appui",
    )

    vides = page.evaluate(VIDES)
    autres = [
        ("une case", lambda: page.locator(".case-sudoku").nth(vides[0]).click()),
        ("un chiffre", lambda: page.click(".touche-sudoku >> text='2'")),
        ("Effacer", lambda: page.click("text=Effacer")),
        ("Annuler", lambda: page.click("text=Annuler")),
        ("Refaire", lambda: page.click("text=Refaire")),
        ("Notes", lambda: commande(page, "^Notes").click()),
    ]
    for nom, toucher in autres:
        if etiquette_abandon(page) == "Abandonner cette grille":
            page.click("text=Abandonner cette grille")
        arme = etiquette_abandon(page).startswith("Confirmer")
        toucher()
        page.wait_for_timeout(60)
        exige(
            arme and etiquette_abandon(page) == "Abandonner cette grille",
            f"toucher « {nom} » remet le bouton à « Abandonner cette grille »",
        )

    # And when he really means it, two taps do abandon the grid.
    page.click("text=Abandonner cette grille")
    page.click("text=Confirmer")
    page.wait_for_selector("text=Ou une nouvelle grille")
    exige(
        page.locator(".grille-sudoku").count() == 0, "deux appuis abandonnent vraiment"
    )
    exige(
        page.evaluate("() => localStorage.getItem('jp:sudoku.partie')") is None,
        "la grille abandonnée quitte aussi le stockage",
    )

    # --- Correctif 4a ------------------------------------------------------
    # Mutant that must turn this red: make the cleanup returned by
    # mountSudoku() inert. The end screen is deferred by 300 ms so the player
    # sees his last digit land; leaving during that delay must cancel it, or
    # the pending timer overwrites whatever the router has mounted since.
    dit("== Correctif 4a : quitter pendant le délai de fin ne laisse rien derrière ==")
    niveau_bouton(page, "Facile").click()
    page.wait_for_selector(".grille-sudoku")
    parties_avant = page.evaluate(ETAT)["stats"]["played"]
    solution = page.evaluate(SOLUTION)
    restantes = page.evaluate(VIDES)
    page.evaluate(REMPLIR, [restantes[:-1], solution])
    page.wait_for_timeout(120)
    exige(len(page.evaluate(VIDES)) == 1, "il ne reste qu'une case à remplir")
    page.evaluate(FINIR_PUIS_PARTIR, [restantes[-1], solution[restantes[-1]]])
    # Well past the 300 ms: if the timer survived, it has fired by now.
    page.wait_for_timeout(1200)
    apres_depart = page.evaluate(ETAT)
    dit(f"  une seconde après être parti : {apres_depart}")
    exige(apres_depart["titre"] == "Jeux de tête", "l'écran reste celui du menu")
    exige(apres_depart["scores"] == 0, "aucun écran de fin ne vient s'y substituer")
    exige(
        apres_depart["stats"]["played"] == parties_avant,
        "la partie quittée n'est pas comptée à son insu",
    )

    # Leaving mid-completion is not losing the grid: the move wrote the save,
    # so coming back shows him the ending he never saw — counted once.
    dit("== Revenir sur une grille laissée complète ==")
    # Navigate from the address rather than from what is on screen: when the
    # scenario above fails, the screen is not the one it expected, and a script
    # that then blows up on a missing button reports one failure instead of
    # every failure it could have found.
    au_menu(page)
    page.click("text=Sudoku")
    page.wait_for_selector("text=Ou une nouvelle grille")
    reprise = commande(page, "^Reprendre$").count() > 0
    exige(reprise, "la grille laissée complète est toujours proposée à la reprise")
    if reprise:
        commande(page, "^Reprendre$").click()
        page.wait_for_selector("text=Grille terminée")
        fin = page.evaluate(ETAT)
        dit(f"  {fin}")
        exige(
            fin["stats"]["played"] == parties_avant + 1,
            "la grille retrouvée complète est comptée une fois, pas deux",
        )
        exige(
            page.evaluate("() => localStorage.getItem('jp:sudoku.partie')") is None,
            "la grille terminée quitte le stockage",
        )

        # Starting another grid after that one: it must be playable, not over.
        page.click("text=Une autre grille")
        page.wait_for_selector("text=Ou une nouvelle grille")
        niveau_bouton(page, "Facile").click()
        page.wait_for_selector(".grille-sudoku")
        exige(
            page.locator("text=Grille terminée").count() == 0,
            "la grille suivante n'est pas déclarée terminée",
        )
        exige(len(page.evaluate(VIDES)) > 0, "elle a bien des cases à remplir")

    # --- Correctif 4b ------------------------------------------------------
    # Le geste réel : terminer une grille, puis, sans laisser au délai de fin
    # le temps d'expirer, abandonner et en relancer une. La nouvelle partie ne
    # doit pas être déclarée terminée à la place de l'ancienne.
    #
    # Honesty about what this kills: NOT the mutant "drop the `game !== pourJeu`
    # guard" on its own. The abandon button cancels the pending timer before it
    # hands back, so two guards cover each other and neither is observable
    # alone — measured, both ways round, in the report. Dropping BOTH does turn
    # this scenario red. It is kept because it is the gesture the player can
    # actually make, and because it catches the day the pair goes together.
    dit("== Correctif 4b : abandonner pendant le délai ne finit pas la suivante ==")
    ouvrir_grille(page)
    parties_avant = page.evaluate(ETAT)["stats"]["played"]
    solution = page.evaluate(SOLUTION)
    restantes = page.evaluate(VIDES)
    page.evaluate(REMPLIR, [restantes[:-1], solution])
    page.wait_for_timeout(120)
    page.evaluate(FINIR_ABANDONNER_RELANCER, [restantes[-1], solution[restantes[-1]]])
    page.wait_for_timeout(1200)
    relancee = page.evaluate(ETAT)
    dit(f"  une seconde après avoir relancé une grille : {relancee}")
    exige(
        relancee["titre"] == "Sudoku", "la nouvelle grille n'est pas déclarée terminée"
    )
    exige(relancee["scores"] == 0, "aucun écran de fin ne s'affiche")
    exige(len(page.evaluate(VIDES)) > 0, "elle a bien des cases à remplir")
    exige(
        relancee["stats"]["played"] == parties_avant,
        "la grille abandonnée n'est comptée dans aucune statistique",
    )

    # --- Correctif 8 -------------------------------------------------------
    # Mutant that must turn this red: have renderMenu() read the save straight
    # from storage again (`storage.get(SAVE_KEY, null)` plus a look at its
    # `difficulty`) instead of asking resumableSave(). The menu then offers
    # "Reprendre" on a save the resume itself refuses: he presses it and lands
    # on a brand new grid, his own gone, with nothing said.
    dit("== Correctif 8 : « Reprendre » n'est proposé que si la reprise aboutit ==")
    au_menu(page)
    page.evaluate(SAUVEGARDE_IMPOSSIBLE)
    page.click("text=Sudoku")
    page.wait_for_selector("text=Ou une nouvelle grille")
    exige(
        commande(page, "^Reprendre$").count() == 0,
        "une sauvegarde que la reprise refuse ne propose pas « Reprendre »",
    )
    # L'auto-test : sur une vraie partie en cours, le bouton est bien là.
    niveau_bouton(page, "Facile").click()
    page.wait_for_selector(".grille-sudoku")
    premiere = page.evaluate(VIDES)[0]
    page.locator(".case-sudoku").nth(premiere).click()
    page.click(".touche-sudoku >> text='1'")
    au_menu(page)
    page.click("text=Sudoku")
    page.wait_for_selector("text=Ou une nouvelle grille")
    exige(
        commande(page, "^Reprendre$").count() == 1,
        "une vraie partie en cours, elle, est bien proposée à la reprise",
    )
    page.evaluate("() => localStorage.removeItem('jp:sudoku.partie')")

    dit("== Hors ligne ==")
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(2500)
    caches = page.evaluate("() => caches.keys()")
    dit(f"  caches : {caches}")
    exige(any("v5" in c for c in caches), "le cache est en v5")
    ctx.set_offline(True)
    for jeu, marqueur in [
        ("Le mot le plus long", ".jeton"),
        ("Anagrammes", "text=Quel niveau ?"),
        ("Trouver tous les mots", ".compteur"),
        ("Motus", "text=Le mot du jour"),
        ("Sudoku", "text=Facile"),
    ]:
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
