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


def test_the_written_file_is_sorted_gzipped_text(tmp_path: Path) -> None:
    target = tmp_path / "frequences.txt.gz"
    write_frequencies({"chien": 30.0, "chat": 42.5}, target)
    content = gzip.decompress(target.read_bytes()).decode("utf-8")
    assert content == "chat\t42.5\nchien\t30\n"
