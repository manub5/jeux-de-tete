"""Reader for the Hunspell affix file shipped by Dicollecte.

Only the directives this project actually needs are handled. Anything else is
ignored on purpose: over-generation is caught later by checking every produced
form against hunspell itself (see tools/dic/verify.py).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class AffixRule:
    """One PFX or SFX line: strip this, add that, if the stem matches."""

    strip: str
    add: str
    condition: re.Pattern[str]
    continuation: frozenset[str]


@dataclass(frozen=True)
class AffixTable:
    flag_length: int
    prefixes: dict[str, tuple[AffixRule, ...]]
    suffixes: dict[str, tuple[AffixRule, ...]]
    needaffix: str | None
    forbidden: str | None
    fullstrip: bool


def split_flags(raw: str, flag_length: int) -> frozenset[str]:
    """Cut a run of concatenated flags into individual ones."""
    if not raw:
        return frozenset()
    if len(raw) % flag_length != 0:
        raise ValueError(f"flag run {raw!r} is not a multiple of {flag_length}")
    return frozenset(raw[i : i + flag_length] for i in range(0, len(raw), flag_length))


def _split_affix_flags(field: str, flag_length: int) -> tuple[str, frozenset[str]]:
    """Split an affix field such as `s/D'Q'` into its value and its flags."""
    value, separator, flags = field.partition("/")
    if value == "0":
        value = ""
    if not separator:
        return value, frozenset()
    return value, split_flags(flags, flag_length)


def parse_aff(path: Path) -> AffixTable:
    prefixes: dict[str, list[AffixRule]] = {}
    suffixes: dict[str, list[AffixRule]] = {}
    flag_length = 1
    needaffix: str | None = None
    forbidden: str | None = None
    fullstrip = False

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        fields = line.split()
        keyword = fields[0]

        if keyword == "FLAG":
            flag_length = 2 if len(fields) > 1 and fields[1] == "long" else 1
        elif keyword == "FULLSTRIP":
            fullstrip = True
        elif keyword == "NEEDAFFIX" and len(fields) > 1:
            needaffix = fields[1]
        elif keyword == "FORBIDDENWORD" and len(fields) > 1:
            forbidden = fields[1]
        elif keyword in ("PFX", "SFX"):
            # A block header looks like `SFX S. Y 2` and carries no rule.
            if len(fields) < 5:
                continue
            flag = fields[1]
            strip = "" if fields[2] == "0" else fields[2]
            add, continuation = _split_affix_flags(fields[3], flag_length)
            raw_condition = fields[4]
            pattern = (
                re.compile(raw_condition + "$")
                if keyword == "SFX"
                else re.compile("^" + raw_condition)
            )
            rule = AffixRule(
                strip=strip,
                add=add,
                condition=pattern,
                continuation=continuation,
            )
            table = suffixes if keyword == "SFX" else prefixes
            table.setdefault(flag, []).append(rule)

    return AffixTable(
        flag_length=flag_length,
        prefixes={flag: tuple(rules) for flag, rules in prefixes.items()},
        suffixes={flag: tuple(rules) for flag, rules in suffixes.items()},
        needaffix=needaffix,
        forbidden=forbidden,
        fullstrip=fullstrip,
    )
