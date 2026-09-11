# tests/navigateur/essai_motus.py
"""Jouer Motus pour de vrai, dans un vrai navigateur, à taille de téléphone."""

from __future__ import annotations

from commun import MENU_PRET, Rapport, au_menu, bruit, nettoyer, surveiller_console
from playwright.sync_api import Page, sync_playwright

rapport = Rapport()
dit = rapport.dit
exige = rapport.exige

#: The word of the day, computed outside the game so the script can play right.
MOT_DU_JOUR = """async () => {
  const { parseFrequencies } = await import(new URL('./lexicon/loader.js', location.href).href);
  const { dailyWord } = await import(new URL('./games/motus/pick.js', location.href).href);
  const { todayKey } = await import(new URL('./core/rng.js', location.href).href);
  const octets = await (await fetch(new URL('./data/frequences.txt.gz', location.href).href)).arrayBuffer();
  const flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream('gzip'));
  const freq = parseFrequencies(await new Response(flux).text());
  return dailyWord(freq, todayKey());
}"""

#: A valid seven-letter word that is not the word of the day, and starts with
#: the same letter — the first letter is given, so the input starts with it.
AUTRE_MOT = """async (secret) => {
  const { parseIndex } = await import(new URL('./lexicon/loader.js', location.href).href);
  const octets = await (await fetch(new URL('./data/signatures.txt.gz', location.href).href)).arrayBuffer();
  const flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream('gzip'));
  const index = parseIndex(await new Response(flux).text());
  for (const mots of index.values()) {
    for (const mot of mots) {
      if (mot.length === 7 && mot !== secret && /^[a-z]+$/.test(mot) && mot[0] === secret[0]) return mot;
    }
  }
  return null;
}"""

#: A game won yesterday in five attempts, so the record has somewhere to fall
#: from. `lowerIsBetter` is the whole point: a record that only ever climbs
#: would announce his worst game for ever.
SEMER_RECORD = """() => {
  localStorage.setItem('jp:stats.motus', JSON.stringify(
    { played: 1, best: 5, recent: [5], lastPlayed: '2026-09-10' }));
}"""


def ouvrir_le_mot_du_jour(page: Page) -> None:
    au_menu(page)
    page.click("text=Motus")
    page.wait_for_selector("text=Le mot du jour")
    page.click("text=Le mot du jour")
    page.wait_for_selector(".grille")


with sync_playwright() as pw:
    nav = pw.chromium.launch()
    ctx = nav.new_context(
        viewport={"width": 393, "height": 851}, is_mobile=True, has_touch=True
    )
    page = ctx.new_page()
    console = surveiller_console(page)
    nettoyer(page)

    dit("== L'accueil ==")
    boutons = page.locator("#app button").all_text_contents()
    dit(f"  boutons : {boutons}")
    exige("Motus" in boutons, "le menu propose Motus")
    exige(len(boutons) >= 5, "le menu liste bien les cinq jeux")
    sous = page.locator(".sous-titre").all_text_contents()
    exige(any("six essais" in s for s in sous), "Motus porte son sous-titre")

    dit("== Le menu de Motus ==")
    page.click("text=Motus")
    page.wait_for_selector("text=Le mot du jour")
    libelles = page.locator("#app button").all_text_contents()
    dit(f"  boutons : {libelles}")
    exige("Le mot du jour" in libelles, "le mot du jour est proposé")
    for lettres in (6, 7, 8):
        exige(
            f"{lettres} lettres" in libelles, f"le jeu libre propose {lettres} lettres"
        )

    secret = page.evaluate(MOT_DU_JOUR)
    autre = page.evaluate(AUTRE_MOT, secret)
    dit(f"  mot du jour : {secret} — essai valide distinct : {autre}")
    exige(secret is not None and len(secret) == 7, "le mot du jour fait sept lettres")
    exige(autre is not None, "un autre mot valide de sept lettres existe")

    dit("== Une partie, jouée pour de vrai ==")
    page.click("text=Le mot du jour")
    page.wait_for_selector(".grille")
    exige(page.locator(".ligne").count() == 6, "les six essais sont dessinés d'emblée")
    saisie = page.locator(".saisie")
    exige(
        saisie.input_value().lower() == secret[0],
        "la première lettre est déjà dans la zone de saisie",
    )

    saisie.fill("")
    page.wait_for_timeout(80)
    dit(f"  après avoir tout effacé : {saisie.input_value()!r}")
    exige(
        saisie.input_value().lower().startswith(secret[0]),
        "la première lettre revient si on l'efface",
    )

    # A word that is too short costs no attempt.
    saisie.fill(secret[0] + "aa")
    page.click("text=Proposer")
    page.wait_for_timeout(200)
    dit(f"  après un mot trop court : {page.locator('.retour').inner_text()!r}")
    exige(
        page.locator(".case--placed, .case--present, .case--absent").count() == 0,
        "un mot trop court ne consomme pas d'essai",
    )
    exige(
        "longueur" in page.locator(".retour").inner_text().lower(),
        "un mot trop court est expliqué",
    )

    # An unknown word costs no attempt either, and shakes the input.
    saisie.fill(secret[0] + "zzzzzz")
    page.click("text=Proposer")
    page.wait_for_timeout(120)
    secoue = page.evaluate(
        "() => document.querySelector('.saisie').className.includes('secoue')"
    )
    dit(
        f"  après un mot inconnu : secousse={secoue}, {page.locator('.retour').inner_text()!r}"
    )
    exige(secoue, "un refus secoue la zone de saisie")
    exige(
        page.locator(".case--placed, .case--present, .case--absent").count() == 0,
        "un mot inconnu ne consomme pas d'essai",
    )

    # A valid attempt: the line is marked, and it arrives letter by letter.
    saisie.fill(autre)
    page.click("text=Proposer")
    page.wait_for_timeout(150)
    marquees = page.locator(".case--placed, .case--present, .case--absent").count()
    dit(f"  après « {autre} » : {marquees} cases marquées")
    exige(marquees == 7, "l'essai valide marque ses sept cases")
    retards = page.eval_on_selector_all(
        ".ligne:first-child .case",
        "els => els.map(e => getComputedStyle(e).animationDelay)",
    )
    dit(f"  retards de la ligne posée : {retards}")
    exige(len(set(retards)) > 1, "les cases arrivent une à une, pas d'un bloc")
    vides = page.eval_on_selector_all(
        ".ligne:nth-child(2) .case",
        "els => els.map(e => getComputedStyle(e).animationName)",
    )
    exige(all(n == "none" for n in vides), "les lignes vides ne s'animent pas")

    # Each marked square carries a sign and a label, not only its colour.
    infos = page.evaluate(
        """() => [...document.querySelectorAll('.ligne:first-child .case')].map(c => ({
             label: c.getAttribute('aria-label'),
             signe: c.querySelector('.signe') ? c.querySelector('.signe').textContent : null,
             classe: c.className,
           }))"""
    )
    bien = [i for i in infos if "placed" in i["classe"]]
    ailleurs = [i for i in infos if "present" in i["classe"]]
    dit(f"  bien placées : {len(bien)}, ailleurs : {len(ailleurs)}")
    exige(
        all(i["label"] for i in infos),
        "chaque case porte une étiquette en toutes lettres",
    )
    exige(
        all(i["signe"] for i in bien + ailleurs),
        "chaque case marquée porte un symbole en plus de sa couleur",
    )

    dit("== La reprise : fermer, rouvrir ==")
    # `goto` towards the current URL — hash included — does NOT reload the
    # page. The router had already written "#motus" there, so the old test was
    # looking at the very grid it claimed to have replaced. Reload for real.
    page.reload(wait_until="networkidle")
    page.wait_for_function(MENU_PRET, timeout=60000)
    page.wait_for_timeout(400)
    exige(page.locator(".grille").count() == 0, "le rechargement repart bien du menu")
    page.click("text=Motus")
    page.wait_for_selector("text=Le mot du jour")
    page.click("text=Le mot du jour")
    page.wait_for_selector(".grille")
    reprises = page.locator(".case--placed, .case--present, .case--absent").count()
    dit(f"  après rechargement complet : {reprises} cases marquées")
    exige(reprises == 7, "la partie du jour est retrouvée telle quelle")
    anim = page.eval_on_selector_all(
        ".ligne:first-child .case",
        "els => els.map(e => getComputedStyle(e).animationName)",
    )
    exige(
        all(n == "none" for n in anim),
        "reprendre une partie ne rejoue pas les animations",
    )

    dit("== Gagner ==")
    page.fill(".saisie", secret)
    page.click("text=Proposer")
    page.wait_for_selector("text=Trouvé", timeout=10000)
    titre = page.locator("h1").inner_text()
    score = page.locator(".score").inner_text()
    dit(f"  {titre!r} / {score!r}")
    exige(titre == "Trouvé\u00a0!", "gagner affiche « Trouvé ! »")
    exige("2 essais" in score, f"le score compte deux essais (lu : {score!r})")
    carres = page.locator(".carres").inner_text()
    dit("  résumé :\n" + "\n".join("    " + ligne for ligne in carres.split("\n")))
    exige(
        not any(c.isalpha() and c not in "Motus" for c in carres.replace("Motus", "")),
        "le résumé ne contient aucune lettre du mot",
    )
    exige("2/6" in carres, "le résumé porte le score")

    dit("== Après la partie : le menu rend les carrés ==")
    page.reload(wait_until="networkidle")
    page.wait_for_function(MENU_PRET, timeout=60000)
    page.wait_for_timeout(400)
    page.click("text=Motus")
    page.wait_for_selector(".carres")
    exige(
        "Le mot du jour" not in page.locator("#app button").all_text_contents(),
        "le mot du jour n'est pas rejouable",
    )
    exige(page.locator(".carres").count() == 1, "les carrés sont toujours consultables")
    exige(
        any("Envoyer" in b for b in page.locator("#app button").all_text_contents()),
        "le bouton d'envoi est toujours là",
    )

    dit("== Le record, au menu ==")
    enregistre = page.evaluate(
        "() => JSON.parse(localStorage.getItem('jp:stats.motus') || 'null')"
    )
    dit(f"  statistiques enregistrées : {enregistre}")
    exige(
        bool(enregistre) and enregistre["best"] == 2,
        "le record vaut 2, le nombre d'essais",
    )
    exige(
        bool(enregistre) and enregistre["played"] == 1, "une seule partie est comptée"
    )
    au_menu(page)
    menu = page.locator(".sous-titre").all_text_contents()
    dit(f"  lignes du menu portant un record : {[s for s in menu if 'record' in s]}")
    exige(any("record 2" in s for s in menu), "le menu annonce « record 2 »")

    # --- Le record DESCEND -------------------------------------------------
    # Motus is scored by what a game costs, not by what it wins: a second game
    # won in fewer attempts must lower the record, and the menu must say so.
    # Starting over from an empty browser, with yesterday's game seeded in.
    dit("== Le record descend, vu à l'écran ==")
    nettoyer(page)
    page.evaluate(SEMER_RECORD)
    au_menu(page)
    avant = [
        s for s in page.locator(".sous-titre").all_text_contents() if "record" in s
    ]
    dit(f"  menu avant : {avant}")
    exige(any("record 5" in s for s in avant), "le menu part bien de « record 5 »")

    ouvrir_le_mot_du_jour(page)
    page.fill(".saisie", secret)
    page.click("text=Proposer")
    page.wait_for_selector("text=Trouvé", timeout=15000)
    dit(f"  gagné en 1 essai avec « {secret} »")
    apres = page.evaluate("() => JSON.parse(localStorage.getItem('jp:stats.motus'))")
    dit(f"  statistiques : {apres}")
    exige(apres["best"] == 1, f"le record descend de 5 à 1 (lu : {apres['best']})")
    exige(apres["played"] == 2, "deux parties comptées")
    au_menu(page)
    final = [
        s for s in page.locator(".sous-titre").all_text_contents() if "record" in s
    ]
    dit(f"  menu après : {final}")
    exige(any("record 1" in s for s in final), "le menu annonce désormais « record 1 »")

    dit("== La console ==")
    for ligne in bruit(console):
        dit(f"  {ligne}")
    exige(not bruit(console), "aucune erreur ni avertissement en console")

    nav.close()

rapport.sortir()
