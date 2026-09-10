# tools/dic/text.py
"""Accent folding and the playability filter.

The folding table below is duplicated in lexicon/signature.js. The two MUST
stay identical: a mismatch makes words silently unreachable. Any change here
needs the same change there, and both test suites re-run.
"""

from __future__ import annotations

MIN_LENGTH = 2
MAX_LENGTH = 15

_SINGLE = {
    "à": "a",
    "â": "a",
    "ä": "a",
    "é": "e",
    "è": "e",
    "ê": "e",
    "ë": "e",
    "î": "i",
    "ï": "i",
    "ô": "o",
    "ö": "o",
    "ù": "u",
    "û": "u",
    "ü": "u",
    "ç": "c",
    "ÿ": "y",
}
_DOUBLE = {"œ": "oe", "æ": "ae"}

ALLOWED_LETTERS = (
    frozenset("abcdefghijklmnopqrstuvwxyz") | frozenset(_SINGLE) | frozenset(_DOUBLE)
)

_FOLD_TABLE = str.maketrans({**_SINGLE, **_DOUBLE})


def fold(word: str) -> str:
    """Lowercase, then replace accented letters and ligatures by plain ones."""
    return word.lower().translate(_FOLD_TABLE)


def signature(word: str) -> str:
    """The word's letters, folded and sorted. Anagrams share a signature."""
    return "".join(sorted(fold(word)))


def is_playable(word: str) -> bool:
    """Spec section 5: lowercase letters only, no punctuation, 2 to 15 long."""
    if not MIN_LENGTH <= len(word) <= MAX_LENGTH:
        return False
    return all(letter in ALLOWED_LETTERS for letter in word)
