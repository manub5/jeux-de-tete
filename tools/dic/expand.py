# tools/dic/expand.py
"""Turn dictionary entries into the inflected forms a player can actually play.

Deliberately permissive: this pass may produce forms hunspell would refuse.
Everything is filtered afterwards against hunspell itself, so the only failure
that matters here is a *missing* form, never an extra one.
"""

from __future__ import annotations

from pathlib import Path

from tools.dic.aff import AffixRule, AffixTable, split_flags

MAX_AFFIX_DEPTH = 2


def parse_dic_line(line: str, flag_length: int) -> tuple[str, frozenset[str]] | None:
    """Read one `.dic` line. Returns None for blanks and the leading count."""
    stripped = line.strip()
    if not stripped or stripped.isdigit():
        return None
    # Morphological fields (`po:nom is:mas`) follow the first space.
    entry = stripped.split(" ", 1)[0]
    entry = entry.replace("\\/", "\x00")
    word, separator, raw_flags = entry.partition("/")
    word = word.replace("\x00", "/")
    if not word:
        return None
    flags = split_flags(raw_flags, flag_length) if separator else frozenset()
    return word, flags


def _apply_suffix(stem: str, rule: AffixRule, fullstrip: bool) -> str | None:
    if rule.strip and not stem.endswith(rule.strip):
        return None
    if not rule.condition.search(stem):
        return None
    base = stem[: len(stem) - len(rule.strip)] if rule.strip else stem
    if not base and not fullstrip:
        return None
    return base + rule.add


def _apply_prefix(stem: str, rule: AffixRule, fullstrip: bool) -> str | None:
    if rule.strip and not stem.startswith(rule.strip):
        return None
    if not rule.condition.match(stem):
        return None
    base = stem[len(rule.strip) :] if rule.strip else stem
    if not base and not fullstrip:
        return None
    return rule.add + base


def expand_entry(
    word: str,
    flags: frozenset[str],
    table: AffixTable,
    max_depth: int = MAX_AFFIX_DEPTH,
) -> set[str]:
    forms: set[str] = set()
    seen: set[tuple[str, frozenset[str]]] = set()
    stack: list[tuple[str, frozenset[str], int]] = [(word, flags, 0)]

    while stack:
        form, form_flags, depth = stack.pop()
        if (form, form_flags) in seen:
            continue
        seen.add((form, form_flags))

        # A NEEDAFFIX entry is not a word on its own; an affixed form is.
        if table.needaffix is None or table.needaffix not in form_flags:
            forms.add(form)
        if depth >= max_depth:
            continue

        # Only suffix-capable flags survive onto an affixed form. Hunspell does
        # not stack two prefixes without COMPLEXPREFIXES, which the French affix
        # file does not set; keeping a prefix flag here lets it re-fire on its
        # own output (l'l'arbre) and inflates the expansion roughly tenfold.
        # NEEDAFFIX falls out of this filter for free: it is not a suffix flag,
        # and an affixed form no longer needs an affix.
        carried = frozenset(flag for flag in form_flags if flag in table.suffixes)
        for flag in form_flags:
            for rule in table.suffixes.get(flag, ()):
                produced = _apply_suffix(form, rule, table.fullstrip)
                if produced is not None:
                    stack.append((produced, rule.continuation, depth + 1))
            for rule in table.prefixes.get(flag, ()):
                produced = _apply_prefix(form, rule, table.fullstrip)
                if produced is not None:
                    # Keep the entry flags: a prefixed form still takes suffixes.
                    stack.append((produced, carried | rule.continuation, depth + 1))

    return forms


def expand_dictionary(dic_path: Path, table: AffixTable) -> tuple[set[str], set[str]]:
    forms: set[str] = set()
    forbidden: set[str] = set()

    with dic_path.open(encoding="utf-8") as handle:
        for line in handle:
            parsed = parse_dic_line(line, table.flag_length)
            if parsed is None:
                continue
            word, flags = parsed
            produced = expand_entry(word, flags, table)
            if table.forbidden is not None and table.forbidden in flags:
                forbidden |= produced
            else:
                forms |= produced

    return forms - forbidden, forbidden
