#!/usr/bin/env python3
"""Convert a gene-correspondence workbook to a Pretzel alias workbook."""

from __future__ import annotations

import argparse
import hashlib
import itertools
import os
import re
import tempfile
from pathlib import Path
from typing import Sequence

import pandas as pd


EXCEL_SHEET_NAME_LIMIT = 31
INVALID_SHEET_NAME_CHARS = re.compile(r"[\\/*?:\[\]]")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Create a Pretzel workbook containing an Alias worksheet for every "
            "pair of assembly columns in a gene-correspondence workbook."
        )
    )
    parser.add_argument("input", type=Path, help="input Excel workbook")
    parser.add_argument("output", type=Path, help="output Pretzel .xlsx workbook")
    parser.add_argument(
        "--sheet",
        help="input worksheet name (default: the first worksheet)",
    )
    parser.add_argument(
        "--columns",
        nargs="+",
        metavar="ASSEMBLY",
        help="assembly columns to use, in output order (default: all columns)",
    )
    return parser.parse_args()


def alias_sheet_name(namespace1: str, namespace2: str, used: set[str]) -> str:
    """Return a valid, unique Excel sheet name, retaining the usual name verbatim."""
    requested = f"Alias|{namespace1}_{namespace2}"
    cleaned = INVALID_SHEET_NAME_CHARS.sub("_", requested).strip("'")
    if cleaned and len(cleaned) <= EXCEL_SHEET_NAME_LIMIT and cleaned not in used:
        used.add(cleaned)
        return cleaned

    # Preserve a recognisable prefix and add a stable suffix if sanitising,
    # truncation, or duplicate assembly names would otherwise cause a collision.
    digest = hashlib.sha1(requested.encode("utf-8")).hexdigest()[:8]
    prefix_length = EXCEL_SHEET_NAME_LIMIT - len(digest) - 1
    candidate = f"{cleaned[:prefix_length]}_{digest}"
    counter = 2
    while candidate in used:
        suffix = f"_{counter}"
        candidate = f"{cleaned[:EXCEL_SHEET_NAME_LIMIT - len(suffix)]}{suffix}"
        counter += 1
    used.add(candidate)
    return candidate


def select_columns(frame: pd.DataFrame, requested: Sequence[str] | None) -> list[str]:
    if frame.columns.has_duplicates:
        duplicates = frame.columns[frame.columns.duplicated()].unique().tolist()
        raise ValueError(f"duplicate input column names: {duplicates}")

    columns = list(requested) if requested else frame.columns.tolist()
    missing = [column for column in columns if column not in frame.columns]
    if missing:
        raise ValueError(f"input worksheet does not contain columns: {missing}")
    if len(columns) < 2:
        raise ValueError("at least two assembly columns are required")
    if len(set(columns)) != len(columns):
        raise ValueError("--columns must not contain duplicates")
    return columns


def make_alias_frame(frame: pd.DataFrame, column1: str, column2: str) -> pd.DataFrame:
    aliases = frame.loc[:, [column1, column2]].copy()
    aliases.columns = ["string1", "string2"]
    aliases["string1"] = aliases["string1"].str.strip()
    aliases["string2"] = aliases["string2"].str.strip()
    return aliases.loc[
        aliases["string1"].ne("") & aliases["string2"].ne("")
    ].reset_index(drop=True)


def convert(input_path: Path, output_path: Path, sheet: str | None, requested: Sequence[str] | None) -> None:
    if input_path.resolve() == output_path.resolve():
        raise ValueError("input and output paths must be different")

    frame = pd.read_excel(
        input_path,
        sheet_name=sheet if sheet is not None else 0,
        dtype=str,
        keep_default_na=False,
    )
    frame.columns = [str(column).strip() for column in frame.columns]
    columns = select_columns(frame, requested)

    used_sheet_names: set[str] = {"Metadata"}
    alias_sheets: list[tuple[str, str, str, pd.DataFrame]] = []
    for column1, column2 in itertools.combinations(columns, 2):
        sheet_name = alias_sheet_name(column1, column2, used_sheet_names)
        alias_sheets.append(
            (sheet_name, column1, column2, make_alias_frame(frame, column1, column2))
        )

    metadata_values: dict[str, list[str]] = {"Field": ["namespace1", "namespace2"]}
    for sheet_name, namespace1, namespace2, _aliases in alias_sheets:
        metadata_values[sheet_name] = [namespace1, namespace2]
    metadata = pd.DataFrame(metadata_values)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix=f".{output_path.stem}.", suffix=".xlsx", dir=output_path.parent, delete=False
        ) as temporary:
            temporary_name = temporary.name
        with pd.ExcelWriter(temporary_name, engine="openpyxl") as writer:
            metadata.to_excel(writer, sheet_name="Metadata", index=False)
            for sheet_name, _namespace1, _namespace2, aliases in alias_sheets:
                aliases.to_excel(writer, sheet_name=sheet_name, index=False)
        os.replace(temporary_name, output_path)
    finally:
        if temporary_name and os.path.exists(temporary_name):
            os.unlink(temporary_name)


def main() -> None:
    args = parse_args()
    try:
        convert(args.input, args.output, args.sheet, args.columns)
    except (FileNotFoundError, OSError, ValueError, ImportError) as error:
        raise SystemExit(f"error: {error}") from error


if __name__ == "__main__":
    main()
