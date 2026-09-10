# tools/dic/checklist.py
"""Hand-written control list. Every build is measured against it.

MUST_CONTAIN gathers the cases that broke, or nearly broke, during development:
words that only exist through a prefix, irregular plurals, accented forms, the
ligature. MUST_NOT_CONTAIN gathers what the playability filter has to keep out.
"""

from __future__ import annotations

from tools.dic.text import is_playable, signature

MUST_CONTAIN: tuple[str, ...] = (
    # Only reachable through the empty unit prefix on a NEEDAFFIX entry
    "mètre",
    "gramme",
    # Only reachable through the SI prefixes: absent as dictionary entries
    "kilomètre",
    "millimètre",
    "centimètre",
    "kilogramme",
    "milligramme",
    # Irregular plurals, through a stripping suffix
    "chevaux",
    "journaux",
    "vitraux",
    # Accents and ligature
    "élève",
    "aiguë",
    "œuf",
    "nævus",
    # Ordinary conjugation, two affixes deep
    "mangèrent",
    "chanteraient",
    # Short words, the ground a Scrabble player fights on
    "eu",
    "os",
    "if",
    "zut",
)

MUST_NOT_CONTAIN: tuple[str, ...] = (
    "Paris",  # proper noun, capital letter
    "l'arbre",  # elision, apostrophe
    "porte-clé",  # hyphen
    "1er",  # digit
    "mA",  # unit symbol, mixed case
    "a",  # single letter
)


def check(index: dict[str, list[str]]) -> list[str]:
    """Return the list of anomalies. An empty list means the build is sound."""
    present: set[str] = {word for words in index.values() for word in words}
    anomalies: list[str] = []

    for word in MUST_CONTAIN:
        if word not in present:
            anomalies.append(f"manquant : {word}")
        elif word not in index.get(signature(word), []):
            anomalies.append(f"mal indexé : {word}")

    for word in MUST_NOT_CONTAIN:
        if word in present:
            anomalies.append(f"indésirable : {word}")
        elif is_playable(word):
            anomalies.append(f"le filtre laisse passer : {word}")

    return anomalies
