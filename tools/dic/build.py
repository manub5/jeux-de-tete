# tools/dic/build.py
"""Assemble the signature index and write it out."""

from __future__ import annotations

import gzip
from collections.abc import Iterable
from pathlib import Path

from tools.dic.text import is_playable, signature


def build_index(forms: Iterable[str]) -> dict[str, list[str]]:
    grouped: dict[str, set[str]] = {}
    for form in forms:
        if not is_playable(form):
            continue
        grouped.setdefault(signature(form), set()).add(form)
    return {key: sorted(words) for key, words in grouped.items()}


def write_index(index: dict[str, list[str]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = (f"{key}\t{' '.join(index[key])}\n" for key in sorted(index))
    with gzip.open(path, "wt", encoding="utf-8", compresslevel=9) as handle:
        handle.writelines(lines)
