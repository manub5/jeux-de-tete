# tools/build_dictionary.py
"""Build the game dictionary from the Dicollecte Hunspell files.

Usage:
    python3 tools/build_dictionary.py \
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
from tools.dic.expand import expand_dictionary

MIN_EXPECTED_FORMS = 300_000

LICENCE_NOTICE = """\
Dictionnaire dérivé des dictionnaires orthographiques français de Dicollecte /
Grammalecte, distribués sous licence Mozilla Public License 2.0.
Source : https://codeberg.org/dicollage/dictionnaires
Le texte de la licence est disponible sur https://mozilla.org/MPL/2.0/
"""


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", type=Path, default=Path("tools/sources"))
    parser.add_argument("--out", type=Path, default=Path("data"))
    parser.add_argument("--variant", default="fr-toutesvariantes")
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

    print("construction de l'index")
    index = build_index(forms)
    kept = sum(len(words) for words in index.values())
    print(f"  {kept} mots jouables, {len(index)} signatures")

    if kept < MIN_EXPECTED_FORMS:
        print(
            f"trop peu de mots ({kept} < {MIN_EXPECTED_FORMS}) : "
            "l'expansion est probablement incomplète",
            file=sys.stderr,
        )
        return 1

    target = args.out / "signatures.txt.gz"
    write_index(index, target)
    (args.out / "LICENCES.txt").write_text(LICENCE_NOTICE, encoding="utf-8")
    size_mb = target.stat().st_size / 1_000_000
    print(f"écrit {target} ({size_mb:.2f} Mo compressés)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
