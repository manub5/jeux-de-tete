# tools/tests/test_text.py
"""Accent folding, signatures and the playability filter."""

from tools.dic.text import fold, is_playable, signature


def test_accents_are_folded_to_their_base_letter() -> None:
    assert fold("élève") == "eleve"
    assert fold("çà") == "ca"
    assert fold("aiguë") == "aigue"


def test_ligatures_become_two_letters() -> None:
    assert fold("œuf") == "oeuf"
    assert fold("nævus") == "naevus"


def test_a_plain_word_is_left_alone() -> None:
    assert fold("chat") == "chat"


def test_uppercase_input_is_folded_down() -> None:
    """Must behave exactly like fold() in lexicon/signature.js."""
    assert fold("École") == "ecole"
    assert signature("CHAT") == "acht"


def test_a_signature_is_the_folded_letters_sorted() -> None:
    assert signature("chat") == "acht"
    assert signature("élève") == "eeelv"


def test_anagrams_share_a_signature() -> None:
    assert signature("chien") == signature("niche")


def test_a_ligature_counts_as_two_letters_in_a_signature() -> None:
    assert signature("œuf") == "efou"


def test_ordinary_words_are_playable() -> None:
    assert is_playable("chat")
    assert is_playable("élève")
    assert is_playable("œuf")


def test_words_that_are_too_short_or_too_long_are_refused() -> None:
    assert not is_playable("a")
    assert not is_playable("a" * 16)


def test_capitals_apostrophes_hyphens_and_digits_are_refused() -> None:
    assert not is_playable("Paris")
    assert not is_playable("l'arbre")
    assert not is_playable("porte-clé")
    assert not is_playable("1er")
    assert not is_playable("mA")
