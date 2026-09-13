# tests/navigateur/essai_statistiques.py
"""L'écran des statistiques : les chiffres de chaque jeu, et la sauvegarde à
portée de main.

Une partie de sudoku menée jusqu'au bout nourrit les statistiques ; un jeu
jamais ouvert doit dire qu'il ne l'a pas été. « Sauvegarder mes scores » doit
produire un vrai téléchargement, lu ici comme un fichier — pas simulé. Puis
une seconde partie change les chiffres, une restauration doit les ramener
exactement là où ils étaient au moment du téléchargement, ET afficher le
message de confirmation : un défaut réel a fait disparaître ce message
derrière le nouveau rendu de l'écran (corrigé à la tâche 4), et c'est
justement le genre de défaut qu'une vérification au navigateur peut seule
confirmer réglé. Enfin, un fichier qui n'est pas une sauvegarde doit produire
un message d'erreur clair, sans rien casser derrière.
"""

from __future__ import annotations

import json
import re
import tempfile
from pathlib import Path

from commun import Rapport, au_menu, bruit, nettoyer, surveiller_console
from playwright.sync_api import Page, sync_playwright

rapport = Rapport()
dit = rapport.dit
exige = rapport.exige

#: The answer to the sudoku grid on screen, computed with the app's own solver.
#: What is under test here is the statistics screen, not the keypad — already
#: played out for real, click by click, in essai_sudoku.py.
SOLUTION = """async () => {
  const { solve } = await import(new URL('./games/sudoku/solver.js', location.href).href);
  const grille = new Int8Array(81);
  document.querySelectorAll('.case-sudoku').forEach((c, i) => {
    const chiffre = c.querySelector('.chiffre-sudoku');
    grille[i] = chiffre ? Number(chiffre.textContent) : 0;
  });
  return [...solve(grille)];
}"""

VIDES = """() => [...document.querySelectorAll('.case-sudoku')]
  .map((c, i) => c.textContent.trim() ? -1 : i).filter(i => i >= 0)"""

#: Fills every empty cell straight from JavaScript, without a single wrong
#: digit, so each play-through finishes at once and always with zero errors.
REMPLIR = """([cibles, solution]) => {
  const touches = [...document.querySelectorAll('.touche-sudoku')];
  for (const cell of cibles) {
    document.querySelectorAll('.case-sudoku')[cell].click();
    touches[solution[cell] - 1].click();
  }
}"""

#: One row of the statistics screen: the numbers shown, or the "never played"
#: sentence — read from the DOM, not guessed from local storage.
LIRE_STATS = """() => Object.fromEntries(
  [...document.querySelectorAll('.ligne-stats')].map((ligne) => {
    const titre = ligne.querySelector('h2').textContent;
    const chiffres = [...ligne.querySelectorAll('.chiffre-stat')].map((c) => ({
      valeur: c.querySelector('strong').textContent,
      libelle: c.querySelector('span').textContent,
    }));
    const pasEncoreJoue = ligne.querySelector('p.sous-titre')?.textContent ?? null;
    return [titre, { chiffres, pasEncoreJoue }];
  })
)"""

STATS_SUDOKU = "() => JSON.parse(localStorage.getItem('jp:stats.sudoku') || 'null')"


def commande(page: Page, motif: str):
    """The on-screen BUTTON whose label matches `motif` exactly — never a
    paragraph that happens to contain the same word."""
    return page.locator("#app button").filter(has_text=re.compile(motif)).first


def ouvrir_statistiques(page: Page) -> None:
    au_menu(page)
    page.click("text=Statistiques")
    page.wait_for_selector("h1:has-text('Statistiques')")


def commencer_une_grille(page: Page) -> None:
    """From the home page: Sudoku, a brand new easy grid."""
    au_menu(page)
    page.click("text=Sudoku")
    page.wait_for_selector("text=Ou une nouvelle grille")
    commande(page, "^Facile$").click()
    page.wait_for_selector(".grille-sudoku")


def finir_la_grille(page: Page) -> None:
    """Fill every empty cell with the true solution: zero errors, every time."""
    solution = page.evaluate(SOLUTION)
    vides = page.evaluate(VIDES)
    page.evaluate(REMPLIR, [vides, solution])
    page.wait_for_selector("text=Grille terminée", timeout=20000)


with tempfile.TemporaryDirectory(
    prefix="jeux-de-tete-essai-statistiques-"
) as dossier_str:
    dossier = Path(dossier_str)

    with sync_playwright() as pw:
        nav = pw.chromium.launch()
        ctx = nav.new_context(
            viewport={"width": 360, "height": 780}, is_mobile=True, has_touch=True
        )
        page = ctx.new_page()
        console = surveiller_console(page)
        nettoyer(page)

        dit("== Une partie de sudoku jouée jusqu'au bout ==")
        commencer_une_grille(page)
        finir_la_grille(page)
        stats_apres_une_partie = page.evaluate(STATS_SUDOKU)
        dit(f"  statistiques enregistrées : {stats_apres_une_partie}")
        exige(
            bool(stats_apres_une_partie) and stats_apres_une_partie["played"] == 1,
            "une seule partie de sudoku est comptée",
        )

        dit("== L'écran des statistiques : un jeu joué, un jeu jamais ouvert ==")
        ouvrir_statistiques(page)
        lu = page.evaluate(LIRE_STATS)
        dit(f"  {lu}")

        sudoku = lu.get("Sudoku")
        exige(bool(sudoku), "la ligne « Sudoku » est affichée")
        if sudoku:
            exige(
                sudoku["chiffres"][:1] == [{"valeur": "1", "libelle": "partie"}],
                f"« 1 partie », au singulier, pas « 1 parties » (lu : {sudoku['chiffres']})",
            )
            exige(
                sudoku["chiffres"][1]
                == {"valeur": str(stats_apres_une_partie["best"]), "libelle": "record"},
                f"le record affiché correspond à celui enregistré (lu : {sudoku['chiffres'][1]})",
            )

        motus = lu.get("Motus")
        exige(bool(motus), "la ligne « Motus » est affichée")
        if motus:
            exige(
                motus["pasEncoreJoue"] == "Pas encore joué.",
                f"Motus, jamais joué, l'annonce (lu : {motus['pasEncoreJoue']!r})",
            )

        dit("== « Sauvegarder mes scores » : un vrai téléchargement ==")
        with page.expect_download() as attente:
            page.click("text=Sauvegarder mes scores")
        telechargement = attente.value
        fichier_sauvegarde = dossier / "sauvegarde.json"
        telechargement.save_as(fichier_sauvegarde)
        texte_telecharge = fichier_sauvegarde.read_text(encoding="utf-8")
        donnees = json.loads(texte_telecharge)
        dit(f"  clés du fichier téléchargé : {sorted(donnees.keys())}")
        exige(
            isinstance(donnees, dict), "le fichier téléchargé est un objet JSON valide"
        )
        exige("version" in donnees, "le fichier contient une « version »")
        exige(
            "stats" in donnees and isinstance(donnees["stats"], dict),
            "le fichier contient les « stats »",
        )
        # A game id never carries a dot (`sudoku`, `mot-le-plus-long`, …) — an
        # in-progress save does (`sudoku.partie`). `preferences` legitimately
        # uses dotted keys of its own (`sequence.vitesse`), so the check is
        # scoped to `stats` rather than run over the whole file.
        cles_stats = donnees.get("stats", {}) if isinstance(donnees, dict) else {}
        exige(
            all(re.fullmatch(r"[a-z-]+", cle) for cle in cles_stats),
            f"« stats » ne contient que des identifiants de jeu, "
            f"aucune clé de partie en cours (lu : {sorted(cles_stats)})",
        )

        dit("== Une seconde partie change les statistiques ==")
        # A finished grid clears its own save on completion (games/sudoku/save.js),
        # so the sudoku menu is already a fresh "Ou une nouvelle grille" —
        # no "Une autre grille" tap needed from wherever the screen is now.
        commencer_une_grille(page)
        finir_la_grille(page)
        stats_apres_deux_parties = page.evaluate(STATS_SUDOKU)
        dit(f"  statistiques après la seconde partie : {stats_apres_deux_parties}")
        exige(
            bool(stats_apres_deux_parties) and stats_apres_deux_parties["played"] == 2,
            "la seconde partie est bien comptée à son tour",
        )

        ouvrir_statistiques(page)
        lu_deux = page.evaluate(LIRE_STATS)
        exige(
            lu_deux.get("Sudoku", {}).get("chiffres", [{}])[0]
            == {"valeur": "2", "libelle": "parties"},
            f"l'écran affiche bien « 2 parties » avant restauration (lu : {lu_deux.get('Sudoku')})",
        )

        dit("== Restaurer le fichier téléchargé plus tôt ==")
        page.locator("input[type=file]").set_input_files(fichier_sauvegarde)
        page.wait_for_selector("text=Sauvegarde restaurée.", timeout=5000)
        message = page.locator("p[role='status']").inner_text()
        dit(f"  message affiché : {message!r}")
        exige(
            message == "Sauvegarde restaurée.",
            f"le message de confirmation de restauration est bien affiché (lu : {message!r})",
        )

        lu_restaure = page.evaluate(LIRE_STATS)
        dit(f"  écran après restauration : {lu_restaure}")
        exige(
            lu_restaure.get("Sudoku", {}).get("chiffres", [{}])[0]
            == {"valeur": "1", "libelle": "partie"},
            "l'écran revient à « 1 partie », l'état sauvegardé au moment du téléchargement",
        )
        stats_restaurees = page.evaluate(STATS_SUDOKU)
        dit(f"  stockage après restauration : {stats_restaurees}")
        exige(
            stats_restaurees == stats_apres_une_partie,
            "le stockage retrouve exactement les statistiques sauvegardées, pas seulement l'affichage",
        )

        dit("== Restaurer un fichier qui n'est pas une sauvegarde ==")
        fichier_invalide = dossier / "pas-une-sauvegarde.txt"
        fichier_invalide.write_text(
            "Ceci est un simple fichier texte, pas une sauvegarde.\n", encoding="utf-8"
        )
        page.locator("input[type=file]").set_input_files(fichier_invalide)
        page.wait_for_selector(
            "text=Ce fichier n’est pas une sauvegarde lisible.", timeout=5000
        )
        message_erreur = page.locator("p[role='status']").inner_text()
        dit(f"  message affiché : {message_erreur!r}")
        exige(
            message_erreur == "Ce fichier n’est pas une sauvegarde lisible.",
            f"un fichier qui n'est pas une sauvegarde produit un message clair (lu : {message_erreur!r})",
        )

        dit("== Rien de cassé derrière une restauration ratée ==")
        lu_apres_echec = page.evaluate(LIRE_STATS)
        exige(
            lu_apres_echec.get("Sudoku", {}).get("chiffres", [{}])[0]
            == {"valeur": "1", "libelle": "partie"},
            "les statistiques affichées restent celles d'avant la tentative ratée",
        )
        page.click("text=Retour")
        page.wait_for_selector("#app button")
        boutons_menu = page.locator("#app button").all_text_contents()
        dit(f"  retour au menu : {boutons_menu}")
        exige(
            len(boutons_menu) >= 5, "le menu principal reste utilisable après l'échec"
        )

        dit("== La console ==")
        for ligne in bruit(console):
            dit(f"  {ligne}")
        exige(not bruit(console), "aucune erreur ni avertissement en console")

        nav.close()

rapport.sortir()
