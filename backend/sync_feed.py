import json
from app import store

try:
    with open("data/ratings_feed.json", encoding="utf-8") as f:
        feed = json.load(f)
    store.save_feed(feed)
    print(f"Imported {len(feed.get('ratings', []))} rows into Atlas DB")
except Exception as e:
    print(f"Error: {e}")
