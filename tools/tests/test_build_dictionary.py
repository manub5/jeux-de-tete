# tools/tests/test_build_dictionary.py
"""The command-line program's own behaviour."""

from pathlib import Path

from tools.build_dictionary import main, parse_args


def test_the_defaults_point_at_the_usual_places() -> None:
    args = parse_args([])
    assert args.sources == Path("tools/sources")
    assert args.out == Path("data")
    assert args.variant == "fr-toutesvariantes"


def test_options_can_be_overridden() -> None:
    args = parse_args(["--out", "ailleurs", "--variant", "fr-classique"])
    assert args.out == Path("ailleurs")
    assert args.variant == "fr-classique"


def test_a_missing_source_file_is_refused_rather_than_crashing(tmp_path: Path) -> None:
    code = main(["--sources", str(tmp_path), "--out", str(tmp_path / "sortie")])
    assert code == 1
    assert not (tmp_path / "sortie").exists()
