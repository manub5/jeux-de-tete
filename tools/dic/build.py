# tools/dic/build.py
"""Assemble the signature index and write it out."""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

from tools.dic.text import is_playable, signature, write_gzip


def build_index(forms: Iterable[str]) -> dict[str, list[str]]:
    grouped: dict[str, set[str]] = {}
    for form in forms:
        if not is_playable(form):
            continue
        grouped.setdefault(signature(form), set()).add(form)
    return {key: sorted(words) for key, words in grouped.items()}


def write_index(index: dict[str, list[str]], path: Path) -> None:
    text = "".join(f"{key}\t{' '.join(index[key])}\n" for key in sorted(index))
    write_gzip(text, path)
