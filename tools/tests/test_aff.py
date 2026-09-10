"""Parsing of the Hunspell affix file."""

from pathlib import Path

import pytest

from tools.dic.aff import AffixTable, parse_aff, split_flags

SAMPLE_AFF = """\
# a trimmed down copy of the real French affix file
SET UTF-8
FLAG long
FULLSTRIP
NEEDAFFIX ()
FORBIDDENWORD {}

SFX S. Y 2
SFX S. 0 0/L'D'Q' [^sxz] is:sg
SFX S. 0 s/D'Q' [^sxz] is:pl

SFX X. Y 2
SFX X. l ux/D'Q' al is:pl
SFX X. 0 x/D'Q' [aeo]u is:pl

PFX Um Y 2
PFX Um 0 0/S. .
PFX Um 0 kilo/S.() .
"""


@pytest.fixture()
def table(tmp_path: Path) -> AffixTable:
    path = tmp_path / "sample.aff"
    path.write_text(SAMPLE_AFF, encoding="utf-8")
    return parse_aff(path)


def test_long_flags_are_read_two_characters_at_a_time() -> None:
    assert split_flags("L'D'Q'", 2) == {"L'", "D'", "Q'"}


def test_empty_flag_string_yields_no_flag() -> None:
    assert split_flags("", 2) == frozenset()


def test_a_truncated_flag_string_is_rejected() -> None:
    with pytest.raises(ValueError):
        split_flags("L'D", 2)


def test_global_directives_are_read(table: AffixTable) -> None:
    assert table.flag_length == 2
    assert table.fullstrip is True
    assert table.needaffix == "()"
    assert table.forbidden == "{}"


def test_suffix_rules_are_grouped_by_flag(table: AffixTable) -> None:
    assert len(table.suffixes["S."]) == 2
    assert len(table.suffixes["X."]) == 2


def test_a_zero_means_nothing_added_or_stripped(table: AffixTable) -> None:
    singular = table.suffixes["S."][0]
    assert singular.strip == ""
    assert singular.add == ""


def test_continuation_flags_are_attached_to_the_rule(table: AffixTable) -> None:
    plural = table.suffixes["S."][1]
    assert plural.add == "s"
    assert plural.continuation == {"D'", "Q'"}


def test_suffix_conditions_match_the_end_of_the_stem(table: AffixTable) -> None:
    plural = table.suffixes["S."][1]
    assert plural.condition.search("chat")
    assert not plural.condition.search("nez")


def test_prefix_conditions_match_the_start_of_the_stem(table: AffixTable) -> None:
    kilo = table.prefixes["Um"][1]
    assert kilo.add == "kilo"
    assert kilo.condition.match("metre")


def test_a_rule_with_no_continuation_flag_has_an_empty_set(tmp_path: Path) -> None:
    path = tmp_path / "bare.aff"
    path.write_text("FLAG long\nSFX A. Y 1\nSFX A. 0 e .\n", encoding="utf-8")
    parsed = parse_aff(path)
    assert parsed.suffixes["A."][0].continuation == frozenset()
