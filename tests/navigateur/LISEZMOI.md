# Les essais au navigateur

**À lancer avant chaque livraison.** C'est cette suite, et elle seule, qui a
trouvé ce que les revues de code ont laissé passer à chaque lot : les six
défauts du lot 1, les deux du lot 2 après dix-huit revues, et au lot 4 le
bouton d'abandon du sudoku entièrement sous le bas de l'écran. Un jeu qui passe
`npm test` peut être injouable à l'écran ; ces scripts ouvrent un vrai navigateur, à taille
de téléphone, et jouent.

## Lancer la suite

```sh
tests/navigateur/lancer.sh
```

Le script démarre lui-même un serveur statique sur un port libre, passe les
quatre essais, arrête le serveur, et sort non nul si l'un d'eux a échoué.

Pour lancer un seul essai contre un serveur déjà en place :

```sh
python3 -m http.server 8155 --bind 127.0.0.1   # dans un autre terminal
python3 tests/navigateur/essai_sudoku.py
```

L'adresse vient de la variable d'environnement `JEUX_URL`, et vaut
`http://127.0.0.1:8155/` par défaut :

```sh
JEUX_URL=http://127.0.0.1:9000/ python3 tests/navigateur/essai_motus.py
```

## Ce que chaque essai couvre

| fichier | ce qu'il couvre |
|---|---|
| `essai_sudoku.py` | Une partie de sudoku jouée en entier, en cliquant vraiment : la grille, le clavier, les erreurs, annuler/refaire, les notes, la reprise après rechargement, l'écran de fin et les statistiques. Puis **un scénario par correctif** du lot 4 (voir plus bas). Enfin, les cinq jeux hors ligne. |
| `essai_hauteurs.py` | Aucune **commande** sous le pli, sur les quinze écrans des cinq jeux, aux deux formats du cahier des charges (360 × 780 et 393 × 851). Le critère n'est pas « tout tient » : une liste de résultats peut défiler, un bouton non. |
| `essai_motus.py` | Motus joué en entier : le mot du jour, les refus qui ne coûtent pas d'essai, l'animation, les symboles en plus des couleurs, la reprise, la victoire, les carrés à partager, et le record qui **descend** quand il fait mieux. |
| `essai_ensemble.py` | Les jeux des lots 1 et 2, et ce que les cinq écrans partagent : cibles tactiles de 48 px, aucun débordement en largeur à 360 px, corps de texte à 18 px, ouverture hors ligne des cinq jeux. |

### Les scénarios « correctif » de `essai_sudoku.py`

Chacun est écrit pour **rougir** si l'on remet le défaut, et chacun porte en
commentaire le mutant qui doit le faire tomber. Ce qui est prouvé, et ce qui ne
l'est pas, est détaillé dans
`.superpowers/sdd/2026-09-11-lot4-sudoku/task-8-fix-3-report.md`.

## Pourquoi ce n'est pas dans `npm test`

Playwright est un outil de développement, **pas une dépendance du projet**.
`npm test` doit rester exécutable sur une machine nue, sans rien installer :

```sh
npm test       # node --test 'tests/**/*.test.js' — aucune installation
```

La commande ne ramasse que les `*.test.js` ; les fichiers Python de ce
répertoire lui sont invisibles. Les deux suites sont complémentaires et
aucune ne remplace l'autre : `npm test` tient les règles des jeux, celle-ci
tient l'écran.

## Installer Playwright, une fois

```sh
pip install playwright
python3 -m playwright install chromium
```

## Le piège à ne jamais réintroduire

Chaque script commence par **désinscrire le service worker, vider les caches et
le stockage local** (`commun.nettoyer`). Sans cela, le service worker sert les
fichiers qu'il a mis en cache au lancement précédent : on mesure le code d'hier
en croyant mesurer celui d'aujourd'hui. C'est arrivé au lot 3.

Deuxième piège, payé au lot 3 lui aussi : ne jamais vérifier une reprise avec
`page.goto(URL)`. Si l'URL courante est déjà celle-là, **hash compris**, rien
n'est rechargé, et l'on regarde la page qu'on croyait avoir remplacée.
`page.reload()`.
