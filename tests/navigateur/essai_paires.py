# tests/navigateur/essai_paires.py
"""Jouer aux paires pour de vrai : retourner des cartes, apparier, reprendre."""

from __future__ import annotations

from commun import (
    MENU_PRET,
    Rapport,
    au_menu,
    bruit,
    nettoyer,
    surveiller_console,
)
from playwright.sync_api import Page, sync_playwright

rapport = Rapport()
dit = rapport.dit
exige = rapport.exige

#: Reads the board the real game is about to deal, by running the exact same
#: rules code with a private generator (mulberry32) seeded like the one about
#: to replace `Math.random`: two generators built from the same seed produce
#: the exact same sequence, in the exact same order `shuffled()` consumes it.
#: Must run BEFORE the level button is clicked.
PREVOIR_ET_TRUQUER = """
async ([niveau, graine]) => {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const { createPairsGame } = await import(new URL('./games/paires/game.js', location.href).href);
  const prevu = createPairsGame({ rng: mulberry32(graine), niveau });
  window.Math.random = mulberry32(graine);
  return prevu.cards.map((c) => c.symbole);
}
"""


def carte(page: Page, i: int) -> str:
    return page.eval_on_selector_all(".carte-paires", "(els, i) => els[i].className", i)


def ouvrir_niveau(page: Page, niveau: str, libelle: str, graine: int) -> list[str]:
    """Opens "Les paires", rigs `Math.random`, starts `niveau`, and returns the
    board it predicted — which, because the same generator seeds both, is
    exactly the board now on screen."""
    au_menu(page)
    page.click("text=Les paires")
    page.wait_for_selector(f"text={libelle}")
    prevu = page.evaluate(PREVOIR_ET_TRUQUER, [niveau, graine])
    page.click(f"text={libelle}")
    page.wait_for_selector(".carte-paires")
    return prevu


with sync_playwright() as pw:
    nav = pw.chromium.launch()
    ctx = nav.new_context(
        viewport={"width": 360, "height": 780}, is_mobile=True, has_touch=True
    )
    page = ctx.new_page()
    console = surveiller_console(page)
    nettoyer(page)

    dit("== Le menu des paires ==")
    page.click("text=Les paires")
    page.wait_for_selector("h1:has-text('Les paires')")
    boutons = page.locator("#app button").all_text_contents()
    dit(f"  boutons : {boutons}")
    for libelle in ("Facile — 15 paires", "Moyen — 21 paires", "Difficile — 30 paires"):
        exige(libelle in boutons, f"le niveau « {libelle} » est proposé")

    dit("== Le plateau du niveau difficile ==")
    prevu = ouvrir_niveau(page, "difficile", "Difficile — 30 paires", 1234)
    dit(f"  {len(prevu)} cartes prédites, dont {len(set(prevu))} symboles distincts")
    exige(len(prevu) == 60, "le niveau difficile prédit bien 60 cartes")
    exige(
        page.locator(".carte-paires").count() == 60,
        "le plateau du niveau difficile a 60 cartes",
    )
    colonnes = page.eval_on_selector(
        ".plateau-paires",
        "e => getComputedStyle(e).getPropertyValue('--colonnes-paires').trim()",
    )
    exige(colonnes == "6", f"le plateau a six colonnes (lu : {colonnes!r})")

    taille = page.eval_on_selector(
        ".carte-paires",
        "e => { const r = e.getBoundingClientRect(); return { l: r.width, h: r.height }; }",
    )
    dit(f"  taille d'une carte : {taille}")
    exige(taille["l"] >= 48 and taille["h"] >= 48, "la carte fait au moins 48 px")
    deborde = page.evaluate(
        "() => document.documentElement.scrollWidth > window.innerWidth + 1"
    )
    exige(not deborde, "le plateau ne déborde pas en largeur à 360 px")

    dit("== Retourner deux cartes différentes, puis une troisième ==")
    idx_a = 0
    idx_b = next(i for i in range(1, 60) if prevu[i] != prevu[idx_a])
    idx_c = next(i for i in range(60) if i not in (idx_a, idx_b))
    idx_d = next(i for i in range(60) if i != idx_c and prevu[i] == prevu[idx_c])
    dit(
        f"  a={idx_a} ({prevu[idx_a]}), b={idx_b} ({prevu[idx_b]}), "
        f"c={idx_c} ({prevu[idx_c]}), jumelle de c={idx_d}"
    )

    page.locator(".carte-paires").nth(idx_a).click()
    page.locator(".carte-paires").nth(idx_b).click()
    page.wait_for_timeout(80)
    exige(
        "carte-paires--montree" in carte(page, idx_a),
        "la première carte retournée reste visible",
    )
    exige(
        "carte-paires--montree" in carte(page, idx_b),
        "la seconde carte retournée reste visible",
    )
    exige(
        "carte-paires--appariee" not in carte(page, idx_a)
        and "carte-paires--appariee" not in carte(page, idx_b),
        "deux cartes différentes ne sont pas appariées",
    )

    page.locator(".carte-paires").nth(idx_c).click()
    page.wait_for_timeout(80)
    exige(
        "carte-paires--montree" not in carte(page, idx_a),
        "un troisième retournement recouvre la première carte manquée",
    )
    exige(
        "carte-paires--montree" not in carte(page, idx_b),
        "un troisième retournement recouvre la seconde carte manquée",
    )
    exige(
        "carte-paires--montree" in carte(page, idx_c),
        "la carte nouvellement retournée est visible",
    )

    dit("== Retourner deux cartes identiques ==")
    page.locator(".carte-paires").nth(idx_d).click()
    page.wait_for_timeout(80)
    for i, nom in ((idx_c, "c"), (idx_d, "jumelle de c")):
        classes = carte(page, i)
        exige(
            "carte-paires--montree" in classes, f"la carte {nom} appariée reste visible"
        )
        exige(
            "carte-paires--appariee" in classes, f"la carte {nom} est marquée appariée"
        )

    # The auto-cover timer (REGARD = 900ms) only ever hides an UNMATCHED pair —
    # a matched one is excluded from `enAttente()` and must survive it.
    page.wait_for_timeout(1000)
    for i, nom in ((idx_c, "c"), (idx_d, "jumelle de c")):
        exige(
            "carte-paires--montree" in carte(page, i),
            f"la carte {nom}, appariée, reste visible même après le délai de recouvrement",
        )

    dit("== Le compteur ==")
    compteur = page.locator(".sous-titre").inner_text()
    dit(f"  {compteur!r}")
    exige(
        "4 retournements" in compteur,
        f"le compteur affiche 4 retournements (lu : {compteur!r})",
    )
    exige("minimum 60" in compteur, "le compteur affiche le minimum du niveau")

    dit("== Quitter et revenir : le plateau retrouvé à l'identique ==")
    avant = [carte(page, i) for i in range(60)]
    page.reload(wait_until="networkidle")
    page.wait_for_function(MENU_PRET, timeout=60000)
    page.wait_for_timeout(300)
    exige(
        page.locator(".carte-paires").count() == 0,
        "le rechargement repart bien du menu",
    )
    page.click("text=Les paires")
    page.wait_for_selector("text=Reprendre")
    page.click("text=Reprendre")
    page.wait_for_selector(".carte-paires")
    apres = [carte(page, i) for i in range(60)]
    exige(
        avant == apres, "la reprise retrouve le plateau exactement dans l'état quitté"
    )
    compteur_repris = page.locator(".sous-titre").inner_text()
    exige(
        "4 retournements" in compteur_repris,
        "la reprise retrouve le compte de retournements",
    )

    dit("== Un seul appui sur « Abandonner » n'abandonne pas ==")
    page.click("text=Abandonner cette partie")
    page.wait_for_timeout(80)
    exige(
        page.locator(".carte-paires").count() == 60,
        "le plateau est toujours là après un seul appui",
    )
    exige(
        "Confirmer l’abandon" in page.locator("#app button").all_text_contents(),
        "le bouton demande confirmation",
    )

    dit("== Une partie jouée jusqu'au bout ==")
    nettoyer(page)
    prevu = ouvrir_niveau(page, "facile", "Facile — 15 paires", 777)
    exige(len(prevu) == 30, "le niveau facile prédit bien 30 cartes")
    par_symbole: dict[str, list[int]] = {}
    for i, symbole in enumerate(prevu):
        par_symbole.setdefault(symbole, []).append(i)
    for symbole, (i, j) in par_symbole.items():
        page.locator(".carte-paires").nth(i).click()
        page.locator(".carte-paires").nth(j).click()
    page.wait_for_selector("text=Toutes les paires sont trouvées", timeout=15000)
    titre = page.locator("h1").inner_text()
    score = page.locator(".score").inner_text()
    dit(f"  {titre!r} / {score!r}")
    exige(titre == "Toutes les paires sont trouvées !", "l'écran de fin est affiché")
    exige(
        "30 retournements" in score,
        f"le score compte 30 retournements (lu : {score!r})",
    )
    exige(
        "minimum possible" in score,
        "un jeu optimal est signalé comme le minimum possible",
    )

    stats = page.evaluate(
        "() => JSON.parse(localStorage.getItem('jp:stats.paires') || 'null')"
    )
    dit(f"  statistiques enregistrées : {stats}")
    exige(
        bool(stats) and stats["played"] == 1,
        "une partie est comptée dans les statistiques",
    )
    exige(
        bool(stats) and stats["best"] == 0,
        "le record vaut 0 (retournements au-dessus du minimum)",
    )

    dit("== La console ==")
    for ligne in bruit(console):
        dit(f"  {ligne}")
    exige(not bruit(console), "aucune erreur ni avertissement en console")

    nav.close()

rapport.sortir()
