#!/usr/bin/env python3
"""Sync data/ratings_feed.json directly into Atlas SQLite DB."""
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
from app import store


def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    feed_path = os.path.join(repo_root, "data", "ratings_feed.json")
    if os.path.exists(feed_path):
        with open(feed_path, encoding="utf-8") as f:
            feed = json.load(f)
        store.save_feed(feed)
        print(f"Successfully loaded {len(feed.get('ratings', []))} ratings into Atlas DB.")
    else:
        print(f"Feed file not found at {feed_path}")


if __name__ == "__main__":
    main()
