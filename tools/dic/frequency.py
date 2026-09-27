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


#: Only the French ligatures — not a full accent fold. `œ`/`æ` are the one
#: spelling where Lexique 3's own "ortho" column is not guaranteed to agree
#: with Dicollecte: one may spell a word with the ligature, the other with its
#: two-letter expansion. A full accent fold (as `tools.dic.text.fold` does, for
#: an entirely different job — building a Scrabble-style signature) would be
#: the wrong tool here: it also drops every other accent, so it would match
#: Lexique's "cote" against the dictionary's "côte" or "côté" — three real,
#: unrelated words — under the same key. This table only ever touches the two
#: characters French orthography actually ligatures.
_LIGATURES = {"œ": "oe", "æ": "ae"}


def _without_ligatures(word: str) -> str:
    for ligature, expansion in _LIGATURES.items():
        word = word.replace(ligature, expansion)
    return word


def keep_known(
    frequencies: dict[str, float],
    words: set[str],
    minimum: float = MIN_FREQUENCY,
) -> dict[str, float]:
    """Only words we actually ship, and only those common enough to be fair.

    Matched by exact spelling first, as always. A handful of common words —
    cœur, sœur, bœuf, œuf, œil, nœud, vœu, œuvre — carry a ligature that French
    orthography makes mandatory (Larousse, Académie), but that a source table
    is not guaranteed to spell the same way the shipped dictionary does. Left
    as a plain exact match, every one of them silently drops out of the pool
    Anagrammes, Motus and "Trouver tous les mots" draw their puzzles from —
    not refused in play, just never offered as a puzzle, for no reason a
    player could see. The fallback below catches exactly that mismatch, and
    nothing wider: it only fires for a dictionary word that actually contains
    a ligature, so it can never pull two unrelated, ligature-free words
    together under one key.
    """
    expanded_index = {
        _without_ligatures(word): word for word in words if _without_ligatures(word) != word
    }
    kept: dict[str, float] = {}
    for word, value in frequencies.items():
        if value < minimum:
            continue
        if word in words:
            canonical = word
        else:
            canonical = expanded_index.get(word)
            if canonical is None:
                continue
        if canonical not in kept or value > kept[canonical]:
            kept[canonical] = value
    return kept


def write_frequencies(frequencies: dict[str, float], path: Path) -> None:
    # `.10g` and not `g`: the default six significant digits would silently
    # write 12800.8 for a word whose real frequency is 12800.81. The compact
    # form is kept — 30.0 still writes as `30`.
    text = "".join(
        f"{word}\t{frequencies[word]:.10g}\n" for word in sorted(frequencies)
    )
    write_gzip(text, path)
