# tools/dic/frequency.py
"""Read the Lexique 3 frequency table and keep what the games can use.

Source: Lexique 3.83 (New & Pallier), CC BY-SA 4.0. The derived file inherits
that licence — attribution and share-alike — which is why data/LICENCES.txt has
to name it separately from the dictionary's MPL 2.0.

`freqfilms2` counts occurrences per million in a corpus of film subtitles.
Spoken French is the right yardstick here: it reflects what a player actually
recognises, where the literary corpus would offer words nobody has ever said.
"""

from __future__ import annotations

import csv
from pathlib import Path

from tools.dic.text import write_gzip

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
            # Not `value > frequencies.get(spelling, 0.0)`: a word whose only
            # frequency is exactly zero would then never be recorded at all.
            if spelling not in frequencies or value > frequencies[spelling]:
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
    # `.10g` and not `g`: the default six significant digits would silently
    # write 12800.8 for a word whose real frequency is 12800.81. The compact
    # form is kept — 30.0 still writes as `30`.
    text = "".join(
        f"{word}\t{frequencies[word]:.10g}\n" for word in sorted(frequencies)
    )
    write_gzip(text, path)
