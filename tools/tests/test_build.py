# tools/tests/test_build.py
"""Building and writing the signature index."""

import gzip
from pathlib import Path

from tools.dic.build import build_index, write_index


def test_words_are_grouped_under_their_signature() -> None:
    index = build_index(["chien", "niche", "chat"])
    assert sorted(index["cehin"]) == ["chien", "niche"]
    assert index["acht"] == ["chat"]


def test_unplayable_words_are_dropped() -> None:
    index = build_index(["chat", "Paris", "l'arbre", "a"])
    assert index == {"acht": ["chat"]}


def test_duplicates_are_collapsed() -> None:
    index = build_index(["chat", "chat"])
    assert index["acht"] == ["chat"]


def test_words_under_a_signature_are_sorted() -> None:
    index = build_index(["niche", "chien"])
    assert index["cehin"] == ["chien", "niche"]


def test_the_written_file_is_gzipped_text_one_line_per_signature(
    tmp_path: Path,
) -> None:
    target = tmp_path / "signatures.txt.gz"
    write_index({"acht": ["chat"], "cehin": ["chien", "niche"]}, target)
    content = gzip.decompress(target.read_bytes()).decode("utf-8")
    assert content == "acht\tchat\ncehin\tchien niche\n"
