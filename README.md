# Jeux de tête

Sept jeux hors ligne pour téléphone Android : jeux de mots, sudoku, mémoire.
Application web installable, sans serveur, sans compte, sans publicité.
Aucune donnée ne quitte le téléphone.

## Jouer

Ouvrir l'adresse publiée, puis, dans le menu de Chrome, « Ajouter à l'écran
d'accueil ».

## Développer

    node --test 'tests/**/*.test.js'          # tests des moteurs JavaScript
    python3 -m http.server 8000 # servir le site en local

## Déployer

Avant chaque `git push` qui touche un fichier du site :

1. **incrémenter `CACHE_VERSION` dans `sw.js`** — sans cela le navigateur ne
   détecte aucune mise à jour et sert l'ancienne version indéfiniment, sans
   message d'erreur ni rien à voir ;
2. si `data/signatures.txt.gz` a été refabriqué, incrémenter **aussi**
   `DICTIONARY_VERSION` dans `lexicon/loader.js` — les deux caches sont
   indépendants, et n'incrémenter que le second fait retélécharger l'ancien
   fichier, toujours servi par le service worker.

## Refabriquer le dictionnaire

    python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
    mkdir -p tools/sources
    for f in fr-toutesvariantes.aff fr-toutesvariantes.dic; do
      curl -sSL --fail -o "tools/sources/$f" \
        "https://codeberg.org/dicollage/dictionnaires/raw/branch/main/dictionaries/$f"
    done
    curl -sSL --fail -o tools/sources/Lexique383.tsv \
      "http://www.lexique.org/databases/Lexique383/Lexique383.tsv"
    .venv/bin/python -m tools.build_dictionary
    .venv/bin/python -m pytest tools/tests/ -q

## Licences

Le dictionnaire dérive des dictionnaires orthographiques français de
Dicollecte / Grammalecte, sous licence Mozilla Public License 2.0. Le fichier
de fréquences (`data/frequences.txt.gz`) dérive quant à lui de Lexique 3, sous
licence CC BY-SA 4.0 — attribution et partage à l'identique — car les deux
fichiers ne portent pas la même licence. Voir `data/LICENCES.txt`.
