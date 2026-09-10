# tools/tests/test_text.py
"""Accent folding, signatures and the playability filter."""

from pathlib import Path

from tools.dic.text import fold, is_playable, signature, write_gzip


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


def test_two_builds_of_the_same_content_give_the_same_bytes(tmp_path: Path) -> None:
    premier, second = tmp_path / "a.gz", tmp_path / "b.gz"
    write_gzip("chat\t42.5\n", premier)
    write_gzip("chat\t42.5\n", second)
    assert premier.read_bytes() == second.read_bytes()


def test_the_gzip_mtime_field_is_zeroed(tmp_path: Path) -> None:
    # Bytes 4-7 of a gzip header are the MTIME field. Pinning it directly is
    # exact and instant, unlike waiting for the clock to tick over a second.
    target = tmp_path / "a.gz"
    write_gzip("chat\t42.5\n", target)
    assert target.read_bytes()[4:8] == b"\x00\x00\x00\x00"
