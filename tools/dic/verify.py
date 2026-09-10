# tools/dic/verify.py
"""Check every produced form against hunspell, the reference implementation.

hunspell is a build-time tool only. The game never depends on it.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

BATCH_SIZE = 50_000


def hunspell_available() -> bool:
    return shutil.which("hunspell") is not None


def reject_unknown(words: set[str], dictionary_base: Path) -> set[str]:
    """Return the subset of `words` that hunspell does not recognise.

    `dictionary_base` is the path without extension; the `.aff` and `.dic`
    files must sit next to each other, as hunspell's -d option expects.
    """
    if not words:
        return set()
    if not hunspell_available():
        raise RuntimeError("hunspell est introuvable : installez-le avant de vérifier")

    rejected: set[str] = set()
    ordered = sorted(words)
    for start in range(0, len(ordered), BATCH_SIZE):
        batch = ordered[start : start + BATCH_SIZE]
        # Fixed argument list, no shell: nothing here is interpolated by a shell.
        result = subprocess.run(  # nosec B603 - fixed argv, no shell, local file
            ["hunspell", "-d", str(dictionary_base), "-i", "UTF-8", "-l"],
            input="\n".join(batch) + "\n",
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0 and not result.stdout:
            raise RuntimeError(f"hunspell a échoué : {result.stderr.strip()}")
        rejected.update(
            line.strip() for line in result.stdout.splitlines() if line.strip()
        )
    return rejected
