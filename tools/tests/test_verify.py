# tools/tests/test_verify.py
"""The hunspell safety net."""

from pathlib import Path

import pytest

from tools.dic.verify import hunspell_available, reject_unknown

SAMPLE_AFF = "SET UTF-8\nFLAG long\n\nSFX S. Y 1\nSFX S. 0 s .\n"
SAMPLE_DIC = "2\nchat/S.\nchien/S.\n"


@pytest.fixture()
def dictionary(tmp_path: Path) -> Path:
    (tmp_path / "tiny.aff").write_text(SAMPLE_AFF, encoding="utf-8")
    (tmp_path / "tiny.dic").write_text(SAMPLE_DIC, encoding="utf-8")
    return tmp_path / "tiny"


@pytest.mark.skipif(not hunspell_available(), reason="hunspell absent")
def test_known_words_are_kept(dictionary: Path) -> None:
    assert reject_unknown({"chat", "chats"}, dictionary) == set()


@pytest.mark.skipif(not hunspell_available(), reason="hunspell absent")
def test_invented_words_are_rejected(dictionary: Path) -> None:
    rejected = reject_unknown({"chat", "xyzzyx"}, dictionary)
    assert rejected == {"xyzzyx"}


@pytest.mark.skipif(not hunspell_available(), reason="hunspell absent")
def test_an_empty_set_needs_no_subprocess(dictionary: Path) -> None:
    assert reject_unknown(set(), dictionary) == set()
