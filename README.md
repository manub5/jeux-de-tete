# Les jeux de papa

Sept jeux hors ligne pour téléphone Android : jeux de mots, sudoku, mémoire.
Application web installable, sans serveur, sans compte, sans publicité.
Aucune donnée ne quitte le téléphone.

## Jouer

Ouvrir l'adresse publiée, puis, dans le menu de Chrome, « Ajouter à l'écran
d'accueil ».

## Développer

    node --test 'tests/**/*.test.js'          # tests des moteurs JavaScript
    python3 -m http.server 8000 # servir le site en local

## Refabriquer le dictionnaire

    python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
    mkdir -p tools/sources
    for f in fr-toutesvariantes.aff fr-toutesvariantes.dic; do
      curl -sSL -o "tools/sources/$f" \
        "https://codeberg.org/dicollage/dictionnaires/raw/branch/main/dictionaries/$f"
    done
    .venv/bin/python -m tools.build_dictionary
    .venv/bin/python -m pytest tools/tests/ -q

## Licences

Le dictionnaire dérive des dictionnaires orthographiques français de
Dicollecte / Grammalecte, sous licence Mozilla Public License 2.0.
Voir `data/LICENCES.txt`.
