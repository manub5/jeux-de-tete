# tools/tests/test_frequency.py
"""Reading the Lexique frequency table."""

import gzip
from pathlib import Path

from tools.dic.frequency import (
    MIN_FREQUENCY,
    keep_known,
    read_frequencies,
    write_frequencies,
)

# Two lines for `a`, as the real file has: one per lemma. The larger wins.
SAMPLE = (
    "ortho\tphon\tlemme\tcgram\tfreqfilms2\n"
    "a\ta\ta\tNOM\t58.65\n"
    "a\ta\tavoir\tVER\t12800.81\n"
    "chat\tSa\tchat\tNOM\t42.5\n"
    "chatoyer\tSatwaje\tchatoyer\tVER\t0.2\n"
    "cassé\tkase\tcasser\tVER\t\t\n"
)


def test_the_largest_frequency_wins_for_a_repeated_spelling(tmp_path: Path) -> None:
    path = tmp_path / "lexique.tsv"
    path.write_text(SAMPLE, encoding="utf-8")
    assert read_frequencies(path)["a"] == 12800.81


def test_every_spelling_is_read(tmp_path: Path) -> None:
    path = tmp_path / "lexique.tsv"
    path.write_text(SAMPLE, encoding="utf-8")
    frequencies = read_frequencies(path)
    assert frequencies["chat"] == 42.5
    assert frequencies["chatoyer"] == 0.2


def test_a_line_with_no_usable_frequency_is_skipped(tmp_path: Path) -> None:
    path = tmp_path / "lexique.tsv"
    path.write_text(SAMPLE, encoding="utf-8")
    assert "cassé" not in read_frequencies(path)


def test_only_words_we_actually_ship_are_kept() -> None:
    kept = keep_known({"chat": 42.5, "inconnu": 99.0}, {"chat"})
    assert kept == {"chat": 42.5}


def test_words_below_the_threshold_are_dropped() -> None:
    kept = keep_known({"chat": 42.5, "chatoyer": 0.2}, {"chat", "chatoyer"})
    assert "chatoyer" not in kept


def test_the_threshold_can_be_overridden() -> None:
    kept = keep_known({"chatoyer": 0.2}, {"chatoyer"}, minimum=0.1)
    assert kept == {"chatoyer": 0.2}


def test_the_default_threshold_is_one_per_million() -> None:
    assert MIN_FREQUENCY == 1.0


def test_a_ligature_spelled_as_two_letters_is_still_matched() -> None:
    # Lexique's own "ortho" column is not guaranteed to spell "cœur" with the
    # ligature the shipped dictionary uses — this is the mismatch that used to
    # drop the word from the frequency file entirely, silently, with nothing
    # in the build's own output to say so.
    kept = keep_known({"coeur": 120.0}, {"cœur"})
    assert kept == {"cœur": 120.0}


def test_a_ligature_already_spelled_the_same_way_needs_no_fallback() -> None:
    kept = keep_known({"cœur": 120.0}, {"cœur"})
    assert kept == {"cœur": 120.0}


def test_the_ligature_fallback_never_merges_unrelated_words() -> None:
    # "cote", "côte" and "côté" are three different French words that would
    # collapse onto one another under a full accent fold — the fallback below
    # only ever touches œ/æ, so none of Lexique's plain-accent spellings can
    # collide with a dictionary word this way.
    kept = keep_known({"cote": 10.0}, {"côte", "côté"})
    assert kept == {}


def test_the_higher_frequency_wins_when_both_spellings_are_present() -> None:
    # Belt and braces: even if a source table somehow listed both spellings of
    # the same ligature word, the dictionary's one canonical entry keeps the
    # larger of the two frequencies, not whichever happened to be read last.
    kept = keep_known({"cœur": 50.0, "coeur": 120.0}, {"cœur"})
    assert kept == {"cœur": 120.0}


def test_a_spelling_whose_only_frequency_is_zero_is_still_read(tmp_path: Path) -> None:
    path = tmp_path / "lexique.tsv"
    path.write_text("ortho\tfreqfilms2\nnul\t0\n", encoding="utf-8")
    assert read_frequencies(path) == {"nul": 0.0}


def test_a_high_frequency_keeps_every_digit(tmp_path: Path) -> None:
    # `a` really is 12800.81 in Lexique. The default `:g` would write 12800.8.
    target = tmp_path / "frequences.txt.gz"
    write_frequencies({"a": 12800.81}, target)
    assert gzip.decompress(target.read_bytes()).decode("utf-8") == "a\t12800.81\n"


def test_the_written_file_is_sorted_gzipped_text(tmp_path: Path) -> None:
    target = tmp_path / "frequences.txt.gz"
    write_frequencies({"chien": 30.0, "chat": 42.5}, target)
    content = gzip.decompress(target.read_bytes()).decode("utf-8")
    assert content == "chat\t42.5\nchien\t30\n"
