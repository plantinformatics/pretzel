#!/usr/bin/env python3
"""Export CMap genetic maps from MariaDB to Pretzel .xlsx workbooks.

Requires pandas, openpyxl, and PyMySQL.
"""

from __future__ import annotations

import argparse
import getpass
import os
import re
import sys
from pathlib import Path
from typing import Any, Iterable

try:
    import pandas as pd
except ImportError as error:  # pragma: no cover - depends on the caller's environment
    package = getattr(error, "name", "a required package")
    raise SystemExit(
        f"Missing Python package {package!r}. Install pandas, openpyxl, and PyMySQL."
    ) from error


MAP_SET_SQL = """
SELECT
    ms.map_set_id,
    ms.map_set_acc,
    ms.map_set_name,
    ms.map_set_short_name,
    ms.map_type_acc,
    ms.published_on,
    ms.map_units,
    ms.can_be_reference_map,
    ms.is_enabled,
    ms.is_relational_map,
    s.species_common_name,
    s.species_full_name
FROM cmap_map_set AS ms
JOIN cmap_species AS s ON s.species_id = ms.species_id
{where_clause}
ORDER BY ms.map_set_id
"""

MAP_SQL = """
SELECT map_id, map_acc, map_name, display_order, map_start, map_stop
FROM cmap_map
WHERE map_set_id = %s
ORDER BY display_order, map_name, map_id
"""

FEATURE_SQL = """
SELECT
    feature_id,
    feature_acc,
    map_id,
    feature_type_acc,
    feature_name,
    is_landmark,
    feature_start,
    feature_stop,
    default_rank,
    direction
FROM cmap_feature
WHERE map_id IN ({placeholders})
ORDER BY map_id, feature_start, feature_name, feature_id
"""

INVALID_FILENAME_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
WHITESPACE = re.compile(r"\s+")
DATASET_NAME_LIMIT = 27  # Excel's 31 characters minus len("Map|").


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export CMap MariaDB genetic maps to Pretzel spreadsheets."
    )
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument(
        "--map-set-id", type=int, help="export one cmap_map_set.map_set_id"
    )
    selection.add_argument(
        "--all", action="store_true", help="export every map set, one workbook each"
    )

    parser.add_argument("--host", default="localhost", help="MariaDB host")
    parser.add_argument("--port", type=int, default=3306, help="MariaDB port")
    parser.add_argument("--user", default=os.environ.get("CMAP_DB_USER"), help="database user")
    parser.add_argument(
        "--password",
        default=os.environ.get("CMAP_DB_PASSWORD"),
        help="database password (or set CMAP_DB_PASSWORD)",
    )
    parser.add_argument("--database", default="cmap", help="database name")
    parser.add_argument(
        "--output-dir", type=Path, default=Path.cwd(), help="output directory"
    )
    return parser.parse_args(argv)


def sql_dataframe(connection: Any, query: str, params: tuple[Any, ...] = ()) -> pd.DataFrame:
    """Run a SELECT using the DB-API connection and retain database column names."""
    with connection.cursor() as cursor:
        cursor.execute(query, params)
        rows = cursor.fetchall()
        columns = [description[0] for description in cursor.description]
    return pd.DataFrame(rows, columns=columns)


def dataset_name(map_set_id: int, map_set_name: str) -> str:
    """Return a unique, Excel-safe Pretzel dataset name of at most 27 characters."""
    cleaned = WHITESPACE.sub("_", str(map_set_name).strip())
    cleaned = re.sub(r"[^A-Za-z0-9_.-]", "_", cleaned).strip("_.") or "Map"
    suffix = f"_{map_set_id}"
    prefix_length = DATASET_NAME_LIMIT - len(suffix)
    if prefix_length < 1:
        return str(map_set_id)[-DATASET_NAME_LIMIT:]
    return f"{cleaned[:prefix_length].rstrip('_.')}{suffix}"


def output_filename(map_set_id: int, map_set_name: str) -> str:
    """Return '<map_set_id>_<map_set_name>.xlsx' with filesystem separators removed."""
    cleaned = INVALID_FILENAME_CHARS.sub("_", str(map_set_name)).strip(" .") or "map"
    return f"{map_set_id}_{cleaned}.xlsx"


def read_map_sets(connection: Any, map_set_id: int | None) -> pd.DataFrame:
    where_clause = "WHERE ms.map_set_id = %s" if map_set_id is not None else ""
    params = (map_set_id,) if map_set_id is not None else ()
    return sql_dataframe(
        connection, MAP_SET_SQL.format(where_clause=where_clause), params
    )


def read_maps(connection: Any, map_set_id: int) -> pd.DataFrame:
    maps = sql_dataframe(connection, MAP_SQL, (map_set_id,))
    if maps.empty:
        return maps

    duplicate_ids = maps.loc[maps["map_id"].duplicated(keep=False), "map_id"].unique()
    for map_id in duplicate_ids:
        copies = maps[maps["map_id"] == map_id]
        if len(copies.drop_duplicates()) != 1:
            raise ValueError(f"map_id {map_id} has conflicting rows in cmap_map")
        print(f"  WARNING: discarded {len(copies) - 1} duplicate cmap_map row(s) for map_id {map_id}")
    return maps.drop_duplicates(subset=["map_id"], keep="first").reset_index(drop=True)


def read_features(connection: Any, map_ids: list[int]) -> pd.DataFrame:
    if not map_ids:
        return pd.DataFrame()
    placeholders = ", ".join(["%s"] * len(map_ids))
    return sql_dataframe(
        connection,
        FEATURE_SQL.format(placeholders=placeholders),
        tuple(map_ids),
    )


def metadata_frame(map_set: pd.Series, sheet_name: str, platform: str) -> pd.DataFrame:
    published_on = map_set["published_on"]
    published_text = "" if pd.isna(published_on) else published_on.isoformat()
    year = "" if pd.isna(published_on) else published_on.year
    values = [
        ("Species", map_set["species_full_name"]),
        ("Crop", map_set["species_common_name"]),
        ("displayName", map_set["map_set_name"]),
        ("shortName", map_set["map_set_short_name"]),
        ("platform", platform),
        ("Year", year),
        ("Published on", published_text),
        ("Map units", map_set["map_units"]),
        ("Map type", map_set["map_type_acc"]),
        ("Source map set ID", int(map_set["map_set_id"])),
        ("Accession name", map_set["map_set_acc"]),
    ]
    return pd.DataFrame(values, columns=["Field", sheet_name])


def marker_frame(features: pd.DataFrame, maps: pd.DataFrame) -> pd.DataFrame:
    columns = [
        "Marker",
        "Chromosome",
        "Position",
        "Marker type",
        "Feature accession",
        "Source feature ID",
        "Source map ID",
        "Is landmark",
    ]
    if features.empty:
        return pd.DataFrame(columns=columns)

    chromosome_by_map = maps.set_index("map_id")["map_name"]
    result = pd.DataFrame(
        {
            "Marker": features["feature_name"].astype(str),
            "Chromosome": features["map_id"].map(chromosome_by_map),
            "Position": pd.to_numeric(features["feature_start"]),
            "Marker type": features["feature_type_acc"],
            "Feature accession": features["feature_acc"],
            "Source feature ID": features["feature_id"],
            "Source map ID": features["map_id"],
            "Is landmark": features["is_landmark"],
        }
    )
    map_order = {map_id: order for order, map_id in enumerate(maps["map_id"])}
    result["_map_order"] = result["Source map ID"].map(map_order)
    return result.sort_values(
        ["_map_order", "Position", "Marker", "Source feature ID"], kind="stable"
    ).drop(columns="_map_order").reset_index(drop=True)


def print_summary(map_set: pd.Series, maps: pd.DataFrame, features: pd.DataFrame) -> None:
    print(f"map_set_id={int(map_set['map_set_id'])} map_set_name={map_set['map_set_name']}")
    marker_counts = features.groupby("map_id").size() if not features.empty else pd.Series(dtype=int)
    for row in maps.itertuples(index=False):
        count = int(marker_counts.get(row.map_id, 0))
        print(
            f"  Chromosome={row.map_name} map_start={row.map_start} "
            f"map_stop={row.map_stop} markers={count}"
        )


def print_validation_warnings(maps: pd.DataFrame, features: pd.DataFrame) -> None:
    if features.empty:
        print("  WARNING: map set contains no markers")
        return

    duplicate_features = int(features["feature_id"].duplicated().sum())
    if duplicate_features:
        print(f"  WARNING: {duplicate_features} duplicate feature_id row(s) will be exported")

    unequal = features["feature_stop"].notna() & (
        features["feature_start"] != features["feature_stop"]
    )
    if unequal.any():
        print(
            f"  WARNING: {int(unequal.sum())} marker(s) have different feature_start "
            "and feature_stop; Position uses feature_start"
        )

    bounds = maps.set_index("map_id")[["map_start", "map_stop"]]
    checked = features.join(bounds, on="map_id")
    outside = (
        checked["map_start"].notna()
        & (checked["feature_start"] < checked["map_start"])
    ) | (
        checked["map_stop"].notna()
        & (checked["feature_start"] > checked["map_stop"])
    )
    if outside.any():
        print(f"  WARNING: {int(outside.sum())} marker(s) lie outside map_start/map_stop")


def platform_value(features: pd.DataFrame) -> str:
    if features.empty:
        return "unknown"
    types = features["feature_type_acc"].dropna().astype(str).str.strip()
    types = sorted(value for value in types.unique() if value)
    return types[0] if len(types) == 1 else "multiple"


def write_workbook(
    output_path: Path,
    map_set: pd.Series,
    maps: pd.DataFrame,
    features: pd.DataFrame,
) -> None:
    name = dataset_name(int(map_set["map_set_id"]), str(map_set["map_set_name"]))
    sheet_name = f"Map|{name}"
    markers = marker_frame(features, maps)
    metadata = metadata_frame(map_set, sheet_name, platform_value(features))

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        metadata.to_excel(writer, sheet_name="Metadata", index=False)
        markers.to_excel(writer, sheet_name=sheet_name, index=False)
        marker_sheet = writer.sheets[sheet_name]
        marker_sheet.freeze_panes = "A2"
        marker_sheet.auto_filter.ref = marker_sheet.dimensions


def export_map_set(connection: Any, map_set: pd.Series, output_dir: Path) -> Path:
    map_set_id = int(map_set["map_set_id"])
    maps = read_maps(connection, map_set_id)
    features = read_features(connection, maps["map_id"].astype(int).tolist())
    print_summary(map_set, maps, features)
    print_validation_warnings(maps, features)

    output_path = output_dir / output_filename(map_set_id, str(map_set["map_set_name"]))
    write_workbook(output_path, map_set, maps, features)
    print(f"  Wrote {output_path}")
    return output_path


def main(argv: Iterable[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        import pymysql
    except ImportError as error:  # pragma: no cover - depends on the caller's environment
        raise SystemExit(
            "Missing Python package 'pymysql'. Install pandas, openpyxl, and PyMySQL."
        ) from error

    if not args.user:
        raise SystemExit("A database user is required: use --user or CMAP_DB_USER")
    if args.password is None:
        args.password = getpass.getpass("MariaDB password: ")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    connection = pymysql.connect(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        database=args.database,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.Cursor,
        read_timeout=120,
    )
    try:
        map_sets = read_map_sets(connection, None if args.all else args.map_set_id)
        if map_sets.empty:
            selection = "all map sets" if args.all else f"map_set_id {args.map_set_id}"
            raise SystemExit(f"No data found for {selection}")

        failures = 0
        for _, map_set in map_sets.iterrows():
            try:
                export_map_set(connection, map_set, args.output_dir)
            except Exception as error:
                failures += 1
                print(
                    f"ERROR: map_set_id={map_set['map_set_id']}: {error}",
                    file=sys.stderr,
                )
                if not args.all:
                    raise
        if failures:
            print(f"Completed with {failures} failed map set(s)", file=sys.stderr)
            return 1
        return 0
    finally:
        connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
