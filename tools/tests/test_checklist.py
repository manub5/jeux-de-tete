# tools/tests/test_checklist.py
"""The words the dictionary must and must not contain."""

from tools.dic.build import build_index
from tools.dic.checklist import MUST_CONTAIN, MUST_NOT_CONTAIN, check


def test_a_complete_index_raises_no_anomaly() -> None:
    index = build_index(MUST_CONTAIN)
    assert check(index) == []


def test_a_missing_word_is_reported() -> None:
    index = build_index([w for w in MUST_CONTAIN if w != "kilomètre"])
    anomalies = check(index)
    assert any("kilomètre" in line for line in anomalies)


def test_the_filter_already_keeps_the_unwanted_words_out() -> None:
    assert check(build_index([*MUST_CONTAIN, *MUST_NOT_CONTAIN])) == []


def test_an_unwanted_word_forced_into_the_index_is_reported() -> None:
    from tools.dic.text import signature

    index = build_index(MUST_CONTAIN)
    index[signature("Paris")] = ["Paris"]
    assert any("Paris" in line for line in check(index))
