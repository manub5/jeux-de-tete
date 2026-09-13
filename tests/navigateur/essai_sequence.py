# tests/navigateur/essai_sequence.py
"""Jouer à la séquence pour de vrai : lire la suite, la répéter, la manquer —
et vérifier que quitter en cours d'affichage ne laisse rien tourner derrière."""

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

ZONES_ACTIVES = (
    "() => [...document.querySelectorAll('.zone-sequence')].some(b => !b.disabled)"
)
ZONES_INACTIVES = (
    "() => [...document.querySelectorAll('.zone-sequence')].every(b => b.disabled)"
)
ALLUMEES = "() => document.querySelectorAll('.zone-sequence--allumee').length"

#: Watches every zone button's `class` attribute. A zone lit while its button
#: is DISABLED is the game showing the sequence; a zone lit while ENABLED is
#: only the flash of the player's own tap (`repondre()` calls `allumer()` too).
#: Filtering on `disabled` is what lets the DOM be read as ground truth for
#: what the game just displayed, without ever touching its private state.
OBSERVER = """() => {
  window.__obs?.disconnect();
  window.__seq = [];
  const boutons = [...document.querySelectorAll('.zone-sequence')];
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      const el = m.target;
      if (el.classList.contains('zone-sequence--allumee') && el.disabled) {
        window.__seq.push(boutons.indexOf(el));
      }
    }
  });
  for (const b of boutons) obs.observe(b, { attributes: true, attributeFilter: ['class'] });
  window.__obs = obs;
}"""

LIRE_SEQ = "() => window.__seq"


def ouvrir_sequence(page: Page) -> None:
    au_menu(page)
    page.click("text=La séquence")
    page.wait_for_selector("h1:has-text('La séquence')")


with sync_playwright() as pw:
    nav = pw.chromium.launch()
    ctx = nav.new_context(
        viewport={"width": 393, "height": 851}, is_mobile=True, has_touch=True
    )
    page = ctx.new_page()
    console = surveiller_console(page)
    nettoyer(page)

    dit("== Le menu de la séquence ==")
    ouvrir_sequence(page)
    boutons = page.locator("#app button").all_text_contents()
    dit(f"  boutons : {boutons}")
    for libelle in ("Lente", "Normale", "Rapide"):
        exige(libelle in boutons, f"la vitesse « {libelle} » est proposée")
    exige(
        "Son : oui" in boutons, "la coupure du son est proposée (son activé par défaut)"
    )

    dit("== Le réglage survit à un rechargement ==")
    page.click("text=Lente")
    page.click("text=Son : oui")
    page.wait_for_timeout(80)
    exige(
        "Vitesse : Lente" in page.locator("#app").inner_text(),
        "la vitesse choisie est affichée avant même de rejouer",
    )
    page.reload(wait_until="networkidle")
    page.wait_for_function(MENU_PRET, timeout=60000)
    ouvrir_sequence(page)
    apres = page.locator("#app").inner_text()
    dit(f"  après rechargement : {[l for l in apres.splitlines() if l.strip()]}")
    exige("Vitesse : Lente" in apres, "la vitesse choisie survit au rechargement")
    exige(
        "Son : non" in page.locator("#app button").all_text_contents(),
        "la coupure du son survit au rechargement",
    )

    # Switch to the fastest speed for the rest of this script — it changes
    # nothing about what is being proved, only how long it takes to prove it.
    page.click("text=Rapide")

    dit("== Après « Commencer » : inactif pendant l'affichage, puis actif ==")
    page.click("text=Commencer")
    # The zone buttons only exist once the game screen is rendered — set up
    # the recorder now, well before the first flash at +500ms.
    page.evaluate(OBSERVER)
    page.wait_for_timeout(100)
    exige(
        page.evaluate(ZONES_INACTIVES), "les zones sont inactives pendant l'affichage"
    )
    page.wait_for_function(ZONES_ACTIVES, timeout=5000)
    dit("  les zones deviennent actives une fois la suite montrée")

    dit("== Lire la suite dans le DOM, et la répéter allonge le jeu ==")
    longueur = 1
    tours_reussis = 0
    dernier_seq: list[int] = []
    while tours_reussis < 2:
        page.wait_for_function(ZONES_ACTIVES, timeout=5000)
        vu = page.evaluate(LIRE_SEQ)
        seq = vu[-longueur:]
        dit(f"  tour de longueur {longueur} lu dans le DOM : {seq}")
        exige(len(seq) == longueur, f"la suite lue fait {longueur} zone(s)")
        for i in seq:
            page.locator(".zone-sequence").nth(i).click()
        tours_reussis += 1
        dernier_seq = seq
        longueur += 1
        if tours_reussis < 2:
            page.wait_for_function(
                ZONES_INACTIVES, timeout=5000
            )  # the next round starts showing

    compteur = page.locator(".sous-titre").inner_text()
    dit(f"  {compteur!r}")
    exige(
        f"record du tour : {len(dernier_seq)}" in compteur,
        "le compteur retient le record atteint",
    )

    dit("== Une zone fausse termine la partie ==")
    page.wait_for_function(ZONES_ACTIVES, timeout=5000)
    vu = page.evaluate(LIRE_SEQ)
    seq3 = vu[-longueur:]
    dit(f"  tour de longueur {longueur} lu dans le DOM : {seq3}")
    exige(len(seq3) == longueur, f"la suite lue fait {longueur} zones")
    fausse = next(i for i in range(4) if i != seq3[0])
    dit(f"  bonne zone attendue : {seq3[0]}, zone fausse jouée : {fausse}")
    page.locator(".zone-sequence").nth(fausse).click()
    page.wait_for_selector("text=Partie terminée", timeout=5000)
    titre = page.locator("h1").inner_text()
    score = page.locator(".score").inner_text()
    dit(f"  {titre!r} / {score!r}")
    exige(titre == "Partie terminée", "l'écran de fin est affiché")
    exige(
        f"Suite de {len(dernier_seq)} zone" in score,
        f"la longueur atteinte annoncée est {len(dernier_seq)} (lu : {score!r})",
    )
    stats = page.evaluate(
        "() => JSON.parse(localStorage.getItem('jp:stats.sequence') || 'null')"
    )
    dit(f"  statistiques enregistrées : {stats}")
    exige(
        bool(stats) and stats["played"] == 1,
        "une partie est comptée dans les statistiques",
    )
    exige(
        bool(stats) and stats["best"] == len(dernier_seq),
        "le record correspond à la longueur atteinte",
    )

    dit("== Quitter l'écran pendant que la séquence se joue ==")
    # This is the shape that produced three critical defects in lot 3: a
    # deferred timer that keeps running after he has already left the screen.
    page.click("text=Retour")
    page.wait_for_function(MENU_PRET, timeout=30000)
    ouvrir_sequence(page)
    page.click("text=Commencer")
    page.wait_for_timeout(150)  # squarely inside the display of round 1
    exige(
        page.evaluate(ALLUMEES) >= 0, "sanity: le sélecteur des zones allumées répond"
    )
    page.evaluate("() => { location.hash = '#accueil'; }")
    page.wait_for_function(MENU_PRET, timeout=30000)
    # Longer than any single round could possibly take, even at the slowest
    # speed with a long sequence: if a timer survived, this is enough for it
    # to have fired.
    page.wait_for_timeout(3000)
    exige(
        page.evaluate(ALLUMEES) == 0,
        "aucune zone ne s'allume après avoir quitté l'écran",
    )
    exige(
        not bruit(console),
        "la console reste vierge après avoir quitté en cours d'affichage",
    )

    dit("== La garde contre une minuterie qui survit malgré tout ==")
    # `annuler()` is trusted to cancel the one pending timer before `game` is
    # ever reassigned, and on every path above it does. This neuters
    # `clearTimeout` itself — simulating the one failure that discipline alone
    # cannot rule out — to prove that even then, `tourSuivant`'s own guard is
    # what stops a stale callback from touching a game that is already gone,
    # instead of it crashing after he has already abandoned the round.
    ouvrir_sequence(page)
    page.click("text=Commencer")
    page.evaluate(OBSERVER)
    page.wait_for_function(ZONES_ACTIVES, timeout=5000)
    seule = page.evaluate(LIRE_SEQ)[-1:]
    page.evaluate(
        "() => { window.__vraiClearTimeout = window.clearTimeout; "
        "window.clearTimeout = () => {}; }"
    )
    page.locator(".zone-sequence").nth(
        seule[0]
    ).click()  # verdict 'fini' : schedules tourSuivant
    page.click("text=Arrêter")  # abandons the round; its own cancel is now a no-op
    page.wait_for_timeout(900)  # past the 700ms the stale callback needed to fire
    page.evaluate("() => { window.clearTimeout = window.__vraiClearTimeout; }")
    exige(
        not bruit(console),
        "un abandon juste avant que la minuterie suivante ne se déclenche ne "
        "plante rien, même quand l'annulation elle-même échoue",
    )

    dit("== Revenir : un tour neuf, pas un reste de l'ancien ==")
    ouvrir_sequence(page)
    page.click("text=Commencer")
    page.evaluate(OBSERVER)
    page.wait_for_function(ZONES_ACTIVES, timeout=5000)
    vu = page.evaluate(LIRE_SEQ)
    dit(f"  suite du tour neuf : {vu}")
    exige(len(vu) == 1, "revenir puis rejouer part bien d'une suite d'une seule zone")

    dit("== La console ==")
    for ligne in bruit(console):
        dit(f"  {ligne}")
    exige(not bruit(console), "aucune erreur ni avertissement en console")

    nav.close()

rapport.sortir()
