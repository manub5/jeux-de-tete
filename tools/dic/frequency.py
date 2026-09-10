# tools/dic/frequency.py
"""Read the Lexique 3 frequency table and keep what the games can use.

Source: Lexique 3.83 (New & Pallier), CC BY-SA 4.0. The derived file inherits
that licence — attribution and share-alike — which is why data/LICENCES.txt
names it separately from the dictionary's MPL 2.0.

`freqfilms2` counts occurrences per million in a corpus of film subtitles.
Spoken French is the right yardstick here: it reflects what a player actually
recognises, where the literary corpus would offer words nobody has ever said.
"""

from __future__ import annotations

import csv
import gzip
from pathlib import Path

#: Occurrences per million, below which a word is too rare to set as a puzzle.
MIN_FREQUENCY = 1.0

SPELLING_COLUMN = "ortho"
FREQUENCY_COLUMN = "freqfilms2"


def read_frequencies(path: Path) -> dict[str, float]:
    """Largest frequency per spelling. Lexique has one line per lemma."""
    frequencies: dict[str, float] = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            spelling = row.get(SPELLING_COLUMN, "")
            raw = row.get(FREQUENCY_COLUMN, "")
            if not spelling or not raw:
                continue
            try:
                value = float(raw)
            except ValueError:
                continue
            if value > frequencies.get(spelling, 0.0):
                frequencies[spelling] = value
    return frequencies


def keep_known(
    frequencies: dict[str, float],
    words: set[str],
    minimum: float = MIN_FREQUENCY,
) -> dict[str, float]:
    """Only words we actually ship, and only those common enough to be fair."""
    return {
        word: value
        for word, value in frequencies.items()
        if word in words and value >= minimum
    }


def write_frequencies(frequencies: dict[str, float], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = (f"{word}\t{frequencies[word]:g}\n" for word in sorted(frequencies))
    with gzip.open(path, "wt", encoding="utf-8", compresslevel=9) as handle:
        handle.writelines(lines)
