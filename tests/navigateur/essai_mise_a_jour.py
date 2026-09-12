"""A phone that already holds an older version must reach the new one.

This is the only path by which any future release reaches him, and until now it
had no test at all: the previous attempt rewrote `sw.js` inside the repository,
which no committed script may do. This one fabricates the old cache in the
browser instead, so it touches nothing on disk.

What breaks if this path breaks is invisible from here: he keeps opening a
version that will never change again, and nothing tells either of us.
"""

from __future__ import annotations

import commun
from playwright.sync_api import sync_playwright

#: The version the service worker is expected to settle on.
ACTUELLE = "jeux-de-tete-v6"

#: A cache left by an earlier release, filled with a page that is NOT the app,
#: so that serving it instead of the new one is impossible to miss.
VIEUX = "jeux-de-tete-v4"

FABRIQUER_VIEUX_CACHE = """async ([vieux]) => {
  for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  for (const c of await caches.keys()) await caches.delete(c);
  const cache = await caches.open(vieux);
  await cache.put(
    new Request(location.href),
    new Response('<h1>vieille version</h1>',
                 { headers: { 'content-type': 'text/html' } }));
  return caches.keys();
}"""


def main() -> None:
    rapport = commun.Rapport()
    with sync_playwright() as pw:
        nav = pw.chromium.launch()
        ctx = nav.new_context(
            viewport={"width": 360, "height": 780}, is_mobile=True, has_touch=True
        )
        page = ctx.new_page()
        console: list[str] = []
        page.on("console", lambda m: console.append(f"{m.type}: {m.text}"))
        page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))

        page.goto(commun.BASE, wait_until="domcontentloaded")
        detenus = page.evaluate(FABRIQUER_VIEUX_CACHE, [VIEUX])
        rapport.dit(f"== Un téléphone qui détient déjà : {detenus} ==")

        page.goto(commun.BASE, wait_until="networkidle")
        page.wait_for_function(commun.MENU_PRET, timeout=60000)
        # The new worker installs, then claims the page and sweeps the old
        # caches: none of that is synchronous with the load.
        page.wait_for_timeout(4000)

        caches = page.evaluate("() => caches.keys()")
        rapport.dit(f"  caches après la mise à jour : {caches}")
        rapport.exige(ACTUELLE in caches, "le cache neuf est installé")
        rapport.exige(
            VIEUX not in caches,
            "le vieux cache est supprimé, et ne mange plus la place du téléphone",
        )
        rapport.exige(
            page.evaluate("() => !!navigator.serviceWorker.controller"),
            "la page est pilotée par un service worker",
        )

        boutons = page.locator("#app button").all_text_contents()
        rapport.dit(f"  menu : {boutons}")
        rapport.exige(
            len(boutons) >= 5 and "vieille version" not in page.content(),
            "c'est la nouvelle version qui s'affiche, pas celle du vieux cache",
        )

        ctx.set_offline(True)
        page.goto(commun.BASE, wait_until="domcontentloaded")
        page.wait_for_function(commun.MENU_PRET, timeout=30000)
        page.click(f"text={boutons[-1]}")
        page.wait_for_timeout(1500)
        rapport.exige(
            "vieille version" not in page.content(),
            "hors ligne, le dernier jeu s'ouvre depuis le cache neuf",
        )
        ctx.set_offline(False)

        bruit = [ligne for ligne in console if not ligne.startswith("log:")]
        for ligne in bruit:
            rapport.dit(f"  console : {ligne}")
        rapport.exige(not bruit, "aucune erreur en console pendant la mise à jour")

        nav.close()
    rapport.sortir("Le passage d'une version à l'autre se fait proprement.")


if __name__ == "__main__":
    main()
