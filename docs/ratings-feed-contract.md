# Ratings feed contract (BL-001)

The integration boundary between the **extraction project** ("email article analyzer")
and the Atlas ratings gauge. The extractor emits per-source rating *snapshots*; a
converter maps them to a stable **feed**; Atlas reads that feed and serves normalized
ratings from `GET /api/v1/signals/{symbol}/ratings`.

The snapshot→source mapping below is the durable core and is independent of *where* the
feed is stored — a JSON file today (env var), a DB row next (see "Dashboard-driven
extraction").

## Flow

```
extractor output (JSON)  ──►  scripts/ratings_from_extractor.py  ──►  ratings_feed.json  ──►  ATLAS_RATINGS_FEED  ──►  /ratings
   parsed_*_snapshots            (app.ratings_ingest)                  (this contract)         (backend/app/ratings.py)
```

Point the backend at a feed and it serves real data; with no feed (or an unreadable/empty
one) it falls back to the seeded sample. Read fresh on each request, so re-running the
extractor is picked up without a restart.

```bash
# from the repo root
python scripts/ratings_from_extractor.py "output/**/*.json" -o data/ratings_feed.json
# from backend/
ATLAS_RATINGS_FEED=../data/ratings_feed.json uvicorn app.main:app --port 8000
```

## Extractor snapshot → gauge source

Snapshots have the shape `{ticker, provider, rating_type, rating, score, ...}`. Mapping
(`app/ratings_ingest.py::PROVIDER_SOURCE`, matched case-insensitively):

| provider / rating_type | gauge source | native value | direction |
|---|---|---|---|
| `seeking_alpha` / `quant` | `sa_quant` | `score` (1.0–5.0 float) | 5 = best |
| `seeking_alpha` / `analysts` | `sa_analysts` | `score` (1.0–5.0) | 5 = best |
| `seeking_alpha` / `wall_street` | `sa_wall_street` | `score` (1.0–5.0) | 5 = best |
| `zacks` / `rank` | `zacks` | `round(score)` (1–5 int) | **1 = best** (inverted) |
| `investing` / `technical`·`summary`·`rating` | `investing` | `rating` (categorical) | Strong Sell → Strong Buy |

Anything else (unknown provider/type, non-numeric SA/Zacks score, unrecognized Investing
label, missing ticker) is **dropped** — never guessed — so it renders as an explicit
"No data" row. This is the trust boundary for unvalidated upstream data.

## Feed file format

```json
{
  "as_of": "2026-07-06T15:34:00Z",
  "ratings": [
    { "ticker": "AEM", "source": "sa_quant",       "value": 2.82, "label": "Hold", "as_of": "2026-07-06T15:34:00Z" },
    { "ticker": "AEM", "source": "sa_wall_street",  "value": 4.09, "label": "Buy",  "as_of": "2026-07-06T15:34:00Z" },
    { "ticker": "AEM", "source": "zacks",           "value": 3,    "label": "Hold", "as_of": "2026-07-06T15:34:00Z" }
  ]
}
```

- `source` is one of `zacks | sa_quant | sa_analysts | sa_wall_street | investing`.
- `value` is a number for the numeric sources, an integer rank for `zacks`, and a
  category string for `investing`.
- `as_of` is ISO-8601 UTC. The feed-level `as_of` is the extraction run timestamp.
- Extractor files may be UTF-8 **with BOM** (PowerShell) — the reader tolerates it.

## Dashboard-driven extraction (planned)

The extractor runs **locally in this machine's browser** (Playwright / the browser
extension in that project); the data changes infrequently. Target UX:

1. A **"Run extraction"** button in the dashboard kicks off a local extraction run.
2. The result is stored (feed rows + an `extracted_at` timestamp) in the DB rather than a
   loose file, keyed by run.
3. A **banner** shows the last extraction timestamp; if it is **older than 3 days** it
   turns **red** and prompts the user to run a fresh extraction.

The mapping + normalization core above is reused unchanged; a DB-backed feed source
replaces the env-var file, and a trigger endpoint launches the local run. Open design
point: how Atlas invokes the extractor (its run command / entrypoint) — to be confirmed.

## Open items

- **Investing.com rating not observed.** In the sampled outputs, `investing_pro` supplies
  financial data (cash flow, ratios), not a Buy/Sell rating. The mapping accepts an
  Investing.com categorical snapshot if the extractor produces one; until then that
  source shows "No data". Confirm whether/where the extractor captures it.
- **Frontend still reads the seeded mirror** (`src/domain/ratings.ts`). To surface real
  data, wire `RatingsGauge` to fetch `/api/v1/signals/{symbol}/ratings` (served already).
- **Symbol alignment.** The extractor universe (AEM, NVO, RIO, …) differs from the demo
  portfolio (CRDO, NVDA, …); a real run needs feed coverage for the displayed tickers.
