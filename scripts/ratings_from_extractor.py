#!/usr/bin/env python3
"""Convert extraction-project outputs into an Atlas ratings feed (BL-001).

Reads one or more JSON files produced by the "email article analyzer" extractor —
either single-page results (with ``parsed_seeking_alpha_snapshots`` /
``parsed_zacks_snapshots`` arrays) or flat lists of rating snapshots — and writes a
ratings-feed JSON (see docs/ratings-feed-contract.md). Point the Atlas backend at the
output with ATLAS_RATINGS_FEED to serve real ratings.

Usage:
    python scripts/ratings_from_extractor.py "output/**/*.json" -o data/ratings_feed.json
    ATLAS_RATINGS_FEED=data/ratings_feed.json uvicorn app.main:app  # from backend/
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from app.ratings_ingest import extract_snapshots, snapshots_to_feed  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Build an Atlas ratings feed from extractor output.")
    parser.add_argument("inputs", nargs="+", help="JSON files or globs of extractor output.")
    parser.add_argument("-o", "--out", required=True, help="Path to write the ratings feed JSON.")
    parser.add_argument("--as-of", default=None, help="ISO-8601 UTC run timestamp (default: now).")
    args = parser.parse_args()

    as_of = args.as_of or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    snapshots: list[dict] = []
    files = 0
    for pattern in args.inputs:
        for path in sorted(glob.glob(pattern, recursive=True)):
            try:
                with open(path, encoding="utf-8-sig") as handle:  # extractor writes UTF-8 BOM
                    snapshots.extend(extract_snapshots(json.load(handle)))
                files += 1
            except (OSError, ValueError) as error:
                print(f"skip {path}: {error}", file=sys.stderr)

    feed = snapshots_to_feed(snapshots, as_of)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(feed, handle, indent=2)

    tickers = len({row["ticker"] for row in feed["ratings"]})
    print(f"Read {files} file(s); wrote {len(feed['ratings'])} rating rows across {tickers} ticker(s) to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
