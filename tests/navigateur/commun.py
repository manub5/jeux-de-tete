# tests/navigateur/commun.py
"""What every browser script needs: the address, a clean browser, a verdict.

The cleanup below is not a nicety. A service worker left registered from the
previous run serves the files it cached then, so the script measures last
launch's code while believing it measures this one. That trap was paid for in
lot 3; it is written once, here, so no script can forget it.
"""

from __future__ import annotations

import os
import sys

from playwright.sync_api import Page

#: The site under test. A free port can be passed in by `lancer.sh`.
BASE = os.environ.get("JEUX_URL", "http://127.0.0.1:8155/")

#: Unregister the service worker, drop every cache, empty local storage.
NETTOYER = """async () => {
  for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  for (const c of await caches.keys()) await caches.delete(c);
  localStorage.clear();
}"""

#: The menu is ready once it lists its five games.
MENU_PRET = "() => document.querySelectorAll('#app button').length >= 5"


class Rapport:
    """Prints each check as it runs, and turns the failures into an exit code."""

    def __init__(self) -> None:
        self.erreurs: list[str] = []

    def dit(self, ligne: str) -> None:
        print(ligne, flush=True)

    def exige(self, condition: bool, quoi: str) -> None:
        self.dit(f"  {'OK  ' if condition else 'RATE'} {quoi}")
        if not condition:
            self.erreurs.append(quoi)

    def echec(self, quoi: str) -> None:
        """Record a failure whose own line has already been printed in full."""
        self.erreurs.append(quoi)

    def bilan(self, succes: str = "Toutes les vérifications passent.") -> int:
        """0 when everything passed, 1 otherwise — the shell reads this."""
        print()
        if self.erreurs:
            print(f"{len(self.erreurs)} VÉRIFICATION(S) EN ÉCHEC :")
            for erreur in self.erreurs:
                print(f"  - {erreur}")
            return 1
        print(succes)
        return 0

    def sortir(self, succes: str = "Toutes les vérifications passent.") -> None:
        sys.exit(self.bilan(succes))


def nettoyer(page: Page) -> None:
    """Empty the browser, then load the site for real.

    Two loads are needed: the first only gives `caches` and `localStorage` an
    origin to clear from, the second is the one the script then measures.
    """
    page.goto(BASE, wait_until="domcontentloaded")
    page.evaluate(NETTOYER)
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_function(MENU_PRET, timeout=60000)


def au_menu(page: Page) -> None:
    """Back to the home screen, from wherever the page currently is."""
    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_function(MENU_PRET, timeout=30000)


def surveiller_console(page: Page) -> list[str]:
    """Collect everything the page says that is not a plain `console.log`."""
    console: list[str] = []
    page.on("console", lambda m: console.append(f"{m.type}: {m.text}"))
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    return console


def bruit(console: list[str]) -> list[str]:
    return [ligne for ligne in console if not ligne.startswith("log:")]
