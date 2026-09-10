# tools/tests/test_expand.py
"""Expansion of dictionary entries into inflected forms."""

from pathlib import Path

import pytest

from tools.dic.aff import AffixTable, parse_aff
from tools.dic.expand import expand_dictionary, expand_entry, parse_dic_line

SAMPLE_AFF = """\
FLAG long
FULLSTRIP
NEEDAFFIX ()
FORBIDDENWORD {}

SFX S. Y 1
SFX S. 0 s .

SFX X. Y 1
SFX X. l ux al

PFX Um Y 2
PFX Um 0 0/S. .
PFX Um 0 kilo/S.() .
"""


@pytest.fixture()
def table(tmp_path: Path) -> AffixTable:
    path = tmp_path / "sample.aff"
    path.write_text(SAMPLE_AFF, encoding="utf-8")
    return parse_aff(path)


def test_a_line_without_flags_is_read() -> None:
    assert parse_dic_line("chat", 2) == ("chat", frozenset())


def test_flags_and_morphology_are_separated() -> None:
    assert parse_dic_line("chat/S. po:nom is:mas", 2) == ("chat", {"S."})


def test_the_leading_count_line_is_ignored() -> None:
    assert parse_dic_line("86491", 2) is None


def test_a_blank_line_is_ignored() -> None:
    assert parse_dic_line("   ", 2) is None


def test_a_plain_entry_yields_itself_and_its_plural(table: AffixTable) -> None:
    assert expand_entry("chat", frozenset({"S."}), table) == {"chat", "chats"}


def test_a_stripping_suffix_replaces_the_ending(table: AffixTable) -> None:
    assert expand_entry("cheval", frozenset({"X."}), table) == {"cheval", "chevaux"}


def test_a_condition_that_does_not_match_produces_nothing_extra(
    table: AffixTable,
) -> None:
    assert expand_entry("chat", frozenset({"X."}), table) == {"chat"}


def test_needaffix_removes_the_bare_word(table: AffixTable) -> None:
    """`metre/Um()` must not yield `metre` through the bare entry..."""
    forms = expand_entry("metre", frozenset({"Um", "()"}), table)
    assert "metre" in forms  # ...but the empty prefix rule puts it back
    assert "kilometre" in forms


def test_a_prefix_keeps_the_entry_flags_so_suffixes_still_apply(
    table: AffixTable,
) -> None:
    forms = expand_entry("metre", frozenset({"Um", "()"}), table)
    assert "metres" in forms
    assert "kilometres" in forms


def test_expansion_never_loops(table: AffixTable) -> None:
    """A pathological entry must terminate rather than hang."""
    forms = expand_entry("a", frozenset({"S.", "Um"}), table)
    assert len(forms) < 100


def test_forbidden_entries_are_reported_separately(
    tmp_path: Path, table: AffixTable
) -> None:
    dic = tmp_path / "sample.dic"
    dic.write_text("3\nchat/S.\nchien/S.\nchiens/{}\n", encoding="utf-8")
    forms, forbidden = expand_dictionary(dic, table)
    assert "chats" in forms
    assert "chiens" in forbidden
