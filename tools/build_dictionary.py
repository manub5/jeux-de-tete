# tools/build_dictionary.py
"""Build the game dictionary from the Dicollecte Hunspell files.

Usage:
    python3 -m tools.build_dictionary \
        --sources tools/sources --out data --variant fr-toutesvariantes

Source: Dicollecte / Grammalecte French Hunspell dictionaries, MPL 2.0.
The generated files are versioned; this program is never run by the game.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from tools.dic.aff import parse_aff
from tools.dic.build import build_index, write_index
from tools.dic.checklist import check
from tools.dic.expand import expand_dictionary
from tools.dic.frequency import keep_known, read_frequencies, write_frequencies
from tools.dic.text import is_playable
from tools.dic.verify import hunspell_available, reject_unknown

MIN_EXPECTED_FORMS = 300_000

LICENCE_NOTICE = """\
signatures.txt.gz
-----------------
Dictionnaire dérivé des dictionnaires orthographiques français de Dicollecte /
Grammalecte, distribués sous licence Mozilla Public License 2.0.
Source : https://codeberg.org/dicollage/dictionnaires
Le texte de la licence est disponible sur https://mozilla.org/MPL/2.0/

frequences.txt.gz
-----------------
Fréquences dérivées de Lexique 3.83 (Boris New et Christophe Pallier),
distribué sous licence Creative Commons Attribution - Partage dans les Mêmes
Conditions 4.0 International (CC BY-SA 4.0).
Source : http://www.lexique.org/
Ce fichier dérivé est donc lui aussi sous CC BY-SA 4.0. Cette obligation porte
sur le fichier de données, pas sur le code de l'application.
Le texte de la licence : https://creativecommons.org/licenses/by-sa/4.0/deed.fr
"""


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", type=Path, default=Path("tools/sources"))
    parser.add_argument("--out", type=Path, default=Path("data"))
    parser.add_argument("--variant", default="fr-toutesvariantes")
    parser.add_argument(
        "--lexique",
        type=Path,
        default=Path("tools/sources/Lexique383.tsv"),
        help="table de fréquences de Lexique 3 ; ignorée si le fichier est absent",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    aff_path = args.sources / f"{args.variant}.aff"
    dic_path = args.sources / f"{args.variant}.dic"

    for path in (aff_path, dic_path):
        if not path.is_file():
            print(f"fichier source absent : {path}", file=sys.stderr)
            return 1

    print(f"lecture de {aff_path.name}")
    table = parse_aff(aff_path)

    print(f"expansion de {dic_path.name}")
    forms, forbidden = expand_dictionary(dic_path, table)
    print(f"  {len(forms)} formes, {len(forbidden)} interdites")

    # Filter before verifying, not after. `build_index` applies exactly this
    # filter anyway, so the final index is identical either way — but hunspell
    # then only sees candidates that could actually be played. The expansion is
    # mostly elisions (l'arbre, d'arbre, qu'arbre), all of which carry an
    # apostrophe and are dropped here, so this cuts the number of hunspell
    # batches and the resident set by a large factor.
    playable = {form for form in forms if is_playable(form)}
    print(f"  {len(playable)} formes jouables sur {len(forms)}")

    if hunspell_available():
        print("vérification par hunspell")
        rejected = reject_unknown(playable, args.sources / args.variant)
        print(f"  {len(rejected)} formes écartées")
        playable -= rejected
    else:
        print("hunspell absent : vérification sautée", file=sys.stderr)

    print("construction de l'index")
    index = build_index(playable)
    kept = sum(len(words) for words in index.values())
    print(f"  {kept} mots jouables, {len(index)} signatures")

    if kept < MIN_EXPECTED_FORMS:
        print(
            f"trop peu de mots ({kept} < {MIN_EXPECTED_FORMS}) : "
            "l'expansion est probablement incomplète",
            file=sys.stderr,
        )
        return 1

    anomalies = check(index)
    if anomalies:
        for line in anomalies:
            print(f"  anomalie : {line}", file=sys.stderr)
        return 1

    target = args.out / "signatures.txt.gz"
    write_index(index, target)
    size_mb = target.stat().st_size / 1_000_000
    print(f"écrit {target} ({size_mb:.2f} Mo compressés)")

    if args.lexique.is_file():
        print(f"lecture de {args.lexique.name}")
        raw = read_frequencies(args.lexique)
        known = keep_known(raw, {word for words in index.values() for word in words})
        frequency_target = args.out / "frequences.txt.gz"
        write_frequencies(known, frequency_target)
        size = frequency_target.stat().st_size / 1_000
        print(f"  {len(known)} mots fréquents, {size:.0f} ko compressés")
    else:
        # Pas fatal : seuls les anagrammes et Motus en ont besoin, et le
        # dictionnaire lui-même est déjà écrit.
        print(f"{args.lexique} absent : fréquences non produites", file=sys.stderr)

    (args.out / "LICENCES.txt").write_text(LICENCE_NOTICE, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
