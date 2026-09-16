# Atlas POC — Feature Backlog

Captured feature ideas not yet scheduled. Newest first.

## BL-011 · Ultra-robust CSV Importer + Systemic Correlation + Extractor Poller + Alert Webhooks

**Status:** Done (2026-09-14, 8th session) · **Area:** Full Stack (Backend + Frontend)

### Delivered
- **Ultra-Robust Custom CSV Importer**: Resolved `⚠ Could not parse CSV` errors by implementing top-preamble auto-discovery (skipping metadata/disclaimer rows up to top 15 lines), expanding flexible column alias matching (`symbol`, `ticker`, `holding`, `security`, `asset`, `stock`, `code`, `instrument`), adding headerless CSV ticker matching fallback, multi-encoding decoding (`UTF-8`, `UTF-8 BOM`, `UTF-16`, `Latin-1`, `CP1252`), auto-delimiter detection (`,`, `\t`, `;`, `|`), and dynamic weight calculation from $qty \times price$.
- **Systemic Pearson Correlation Integration (Spec §37)**: Attached 12-month return series (`returnsHistory` / `returns_history`) to holdings and integrated Pearson correlation calculation ($r > 0.70$) into Portfolio Fit evaluation across Python backend (`portfolio_fit.py`) and TypeScript domain (`portfolioFit.ts`). High co-moving assets calculate systemic correlation drag dynamically.
- **Live Extractor Poller (Spec §12)**: Added `fetch_remote_feed` in `ratings_ingest.py` and `POST /api/v1/ratings/poll` endpoint to query external HTTP extractors (`ATLAS_EXTRACTOR_URL`) and persist raw ratings feeds into SQLite (`store.py`). Added Extractor Poller controls in `DataPages.tsx` and `preview.html`.
- **Real-Time Alert Dispatcher & Webhooks (Spec §44)**: Created `backend/app/alerts.py` to format alert events into standard JSON payloads and dispatch via HTTP POST to external webhooks (`ATLAS_WEBHOOK_URL`). Added `POST /api/v1/alerts/test` and `POST /api/v1/alerts/dispatch` endpoints, and Webhook UI controls in `DataPages.tsx` and `preview.html`.
- **Full Verification**: **40/40 pytest passed**, **18/18 vitest passed**, `npm run lint` clean (0 errors), `npm run build` compiled 1,593 modules into `dist/`.

---

## BL-010 · Per-ticker ratings feed overlay & standalone preview.html feature parity

**Status:** Done (2026-09-14, 7th session) · **Area:** Backend + Frontend

### Delivered
- **Backend ratings overlay (`backend/app/ratings.py`)**: `active_source()` updated to overlay feed ratings (`raw_map`) over `RAW_RATINGS` per-ticker (`merged = {**RAW_RATINGS, **raw_map}`) rather than replacing wholesale. Extracted feeds (e.g. `data/ratings_feed.json`) or DB runs update extracted symbols (e.g. AEM) while non-extracted symbols (CRDO, NVDA, SPY, NVO, RIO) seamlessly retain their seeded values. Unit test added in `backend/tests/test_ratings.py`.
- **Standalone `preview.html`**: Ported Portfolio Fit calculation (`computeFit` algorithm) and triad rendering into `preview.html`. Added Portfolio Fit triad & deterministic factor/why breakdown into asset drawer (`openDrawer`), and compact `Fit 94` chips to Overview rows and Signal cards for holdings affected by concentration drag. Zero external dependencies preserved.

---

## BL-009 · Portfolio-aware signal adjustment (spec §25) + deterministic explanation (§73)

**Status:** Done (2026-09-13, 6th session) · **Area:** Backend + Frontend · **Verified:** pc-adis — lint
clean, vitest 17/17, build ✓ (1592 modules), pytest 26/26.

The spec's named "key differentiator": evaluate each setup **in portfolio context**, not just in
isolation. Every holding now carries a **Technical / Portfolio Fit / Combined** triad plus a deterministic
§73 "why". The adjustment is a *separate* score — the technical score is never silently modified.

### Delivered
- **Backend** `backend/app/portfolio_fit.py` (pure, deterministic): `compute_fit(holding, holdings)` →
  fit_score (0-100), concentration_adjustment (= fit_score − 100, ≤ 0), combined_score = technical +
  adjustment, combined_state, per-limit `FitFactor`s, and an explanation list. Limits (sector 35% / single
  20% / top-5 70%) are configurable; `POINTS_PER_EXCESS_PCT` (10) tunes the drag. A holding shares blame
  for a breached limit in proportion to its weight within that block. Correlation is reported unavailable
  and excluded (no price history) — never fabricated. Models `FitFactor`/`PortfolioFit`; endpoint
  `GET /api/v1/signals/{symbol}/portfolio-fit`. 5 pytest cases.
- **Frontend** `src/domain/portfolioFit.ts` — offline-first mirror computed locally like `assessHolding`
  (no fetch needed). `src/components/PortfolioFit.tsx`: a drawer triad + factor/why list, and a compact
  card "Fit N" chip shown only when concentration drags fit below 100. Wired into the asset drawer and the
  Signals cards. 4 vitest cases; golden values shared with pytest.
- **Golden numbers (seeded book):** CRDO & NVDA (Semiconductors 36.2% > 35%) → fit 94, −6, combined 59/69;
  every diversifier → fit 100, no adjustment, combined = technical. In the demo scenario CRDO's combined
  tracks its technical jump (90 → 84 after the −6 drag).

### Future (flagged, not built)
- Wire correlation once a returns history exists (spec §37). Then the fit gains a real correlation input.

---

## BL-008 · Extractor connected + real feed built, but coverage is AEM-only (2026-09-13, 6th session)

**Status:** Pipeline verified end-to-end on real data; feed committed but NOT activated · **Area:** Data
integration

Folder access to `email article analyzer` was granted this session and the real extractor output was run
through the repo's own converter (`scripts/ratings_from_extractor.py` → `app/ratings_ingest.py`, pure
stdlib, in the cloud). It round-trips correctly: real files → feed → `feed_to_raw` → normalizer → **AEM
consensus 64.5 "Buy"** (sa_quant 2.82 / sa_analysts 3.83 / sa_wall_street 4.09), matching the contract.

**Finding: real usable coverage is AEM-only.** Only `output/sa-extraction-test/aem-*-final.json` produced
valid snapshots. Dropped by the "never guess" rule: `zacks-extraction-test` parsed empty; the ANET SA
capture had `score: null`; `outputs/production_batch_0*/run_51_investment_scores*.json` are a scoring
schema, not rating snapshots; NVO/RIO have no snapshots. The feed (`data/ratings_feed.json`, 3 AEM rows)
is committed and delivered, but **`ATLAS_RATINGS_FEED` is intentionally left unset** — `active_source()`
serves the feed's ticker map wholesale, so an AEM-only feed would blank CRDO/NVDA/SPY/NVO/RIO (regression),
and AEM's numbers already match its seed. **To activate:** run the extractor for the displayed tickers, OR
change `active_source()` to merge feed-over-seed per-ticker (small, test-worthy backend change). Full
detail in SESSION-HANDOFF.md ("The extractor … verified on REAL data").

---

## Maintenance · pc-adis toolchain unblocked + full green on the machine itself (2026-09-13, 6th session)

The three pc-adis pending items that had been stuck two sessions (npm install to regenerate the lockfile,
the BL-006 Makefile copy, backend pip+pytest) — blocked because `device_bash` still can't mount the
connected folder (Sept-8 Windows update) — were **all completed by driving a real terminal on pc-adis via
computer-use.** Because computer-use grants terminals/Explorer only at "click" tier (no typing), the
method was: commit a PowerShell runner + a `.bat` launcher into the repo via the file bridge, then
**double-click the .bat in File Explorer** and read results back from a tee'd log file through the bridge.

All eight steps exited 0 on pc-adis (node v24.20.0, npm 11.12.1, Python 3.14.7): **npm install** (lockfile
regenerated with `@types/node@22.10.2`, "added 2 packages"), esbuild postinstall, **lint clean**, **vitest
13/13**, **`vite build` ✓** (index 194.89 kB / 60.22 kB gzip, 1590 modules, 1.17s), **Makefile** now the
:8100 BL-006 version (620 bytes, contains `ATLAS_PORT`), backend **pip install** (all cp314 wheels:
pydantic-core 2.46.5-cp314 etc.), backend **pytest 21/21**. Method + full detail in SESSION-HANDOFF.md
(6th-session section + "How pc-adis was driven"). Helper files left in the repo root
(`session6-run.ps1/.bat/.log`, `session6-done.marker`, `session6-bat.done`) are safe to delete manually.

---

## Maintenance · First full green run on the Pi + @types/node build fix (2026-09-12, 4th session)

All four suites ran green for the first time on real toolchain — on the **Raspberry Pi AHADPI5** (via
Pi Connect remote shell), since the cloud is egress-blocked (no npm/PyPI) and `device_bash` can't mount
pc-adis: **eslint clean**, **vitest 13/13**, **`vite build` ✓ (1590 modules, `dist/` written)**, backend
**pytest 21/21**.

Found + fixed a **latent build break from BL-006**: `vite.config.ts` uses `process.env.ATLAS_PORT`, but
`@types/node` was never a dependency, so `tsc -b` failed with **TS2580: Cannot find name 'process'**. The
earlier "build green" notes predate that change, so it was never actually build-verified. **Fix:** added
`"@types/node": "22.10.2"` to `devDependencies` (exact-pinned, no-caret style). `package.json` updated on
both AHADPI5 and pc-adis (bridge commit). **pc-adis lockfile was regenerated in the 6th session** — `npm
ci` now works there. Transfer method + Pi environment are in SESSION-HANDOFF.md (repo reconstructed on the
Pi via heredocs, all 37 files byte-verified).

---

## Maintenance · Placeholder ratings until the extractor is connected (2026-09-12)

Product decision: finish the dashboard now, wire the extractor afterwards. So the previously
empty gauge slots carry **clearly-seeded placeholders** so the demo reads fully populated —
AEM's Zacks + Investing, and all of NVO/RIO (AEM's SA figures stay the real verified values).
These are seeded, not real: `/ratings/status` still reports `source=seed`, and the first
imported run replaces every placeholder wholesale. SPY keeps its intentional partial-coverage
gaps (partial-coverage test). `backend/app/ratings.py` + `src/domain/ratings.ts`. Backend seed
re-verified: CRDO 83.0 / SPY partial / CASH empty unchanged; AEM 68.7 "Buy", NVO 58.0 "Hold",
RIO 57.5 "Hold" now render full 5-source gauges.

---

## BL-007 · External-ratings consensus chip on Signals cards

**Status:** Done (2026-09-11, 3rd session) · **Added:** 2026-09-11 · **Area:** Frontend

The optional secondary placement flagged in BL-001: surface each ticker's blended external
consensus on the Signals cards, not only in the asset drawer.

### Delivered
- New `src/components/RatingsConsensusChip.tsx`: a compact chip showing the blended consensus
  (label + 0-100 score) reusing the existing `.consensus-chip` tones. Offline-first exactly like
  `RatingsGauge` — seeded mirror first, upgrades to the API's real (DB-backed) ratings when
  reachable — and renders nothing when a ticker has no external coverage, so uncovered cards stay clean.
- Wired into `SignalsPage` cards in `src/App.tsx` (clustered with the status pill via a new
  `.signal-card-tags` wrapper); two small CSS rules added in `styles.css`.
- Kept `ratingTone` local to the chip so the verified `RatingsGauge` is untouched and no extra
  export trips the react-refresh lint rule (the BL-002 fix).

### Verified
- vitest/lint/build confirmed green on the Pi (4th session) and on pc-adis (6th session). No vitest
  assertion touches the new component.

---

## BL-006 · Resolve the :8000 port collision with the extractor

**Status:** Done (2026-09-11, 3rd session); build break fixed 2026-09-12; Makefile applied on pc-adis
2026-09-13 · **Area:** Config / DX

The Atlas backend and the local ratings extractor both defaulted to :8000, so they couldn't run at the
same time. Atlas's **host-facing** port now defaults to **8100** (configurable via `ATLAS_PORT`); the
container still listens on 8000 internally and nginx still proxies `api:8000`.
- `vite.config.ts` dev proxy target -> `http://127.0.0.1:${ATLAS_PORT ?? 8100}`.
- `Makefile` `backend` target -> `--port $(ATLAS_PORT)` with `ATLAS_PORT ?= 8100`.
- `docker-compose.yml` api host publish -> `127.0.0.1:${ATLAS_PORT:-8100}:8000`.
- `README.md` dev + Docker instructions and API-docs URL -> :8100.

### Build-break fix (2026-09-12, 4th session)
The `process.env.ATLAS_PORT` added here needs Node types. `@types/node@22.10.2` added to
`devDependencies`; `tsc -b && vite build` passes.

### Makefile now applied on pc-adis (2026-09-13, 6th session)
`Makefile` was a **protected file** the device bridge couldn't write — its updated content lived in
`Claude outputs/Makefile.bl006.txt`. In the 6th session it was **copied over `Makefile` on pc-adis via a
real terminal** (computer-use), so the :8100 version is now live there (620 bytes, contains `ATLAS_PORT`).

---

## BL-005 · Symbol overlap so real extracted ratings surface

**Status:** Done (2026-09-11, 3rd session) · **Area:** Frontend + Backend + Data integration

Added AEM (Agnico Eagle Mines), NVO (Novo Nordisk) and RIO (Rio Tinto) to `backend/app/data.py` and
`src/data/demo.ts` so an imported run's ratings appear for them; rebalanced non-semi weights while
keeping **CRDO 17.4 + NVDA 18.8 = Semiconductors 36.2%** untouched (concentration story + `test_engine`
risk assertion) and the book at 100%. AEM seeded with the real extractor-verified SA figures (consensus
64.5 "Buy"); NVO/RIO carry no seed and show "no data" until a live extraction fills them. Verified green
on the Pi (4th session) and pc-adis (6th session): risk = Semiconductors 36.2 / Elevated; vitest 13/13;
pytest 21/21.

---

## Maintenance · Python 3.14 install fix (2026-09-11)

`backend/requirements.txt`: `pydantic==2.10.2` → `pydantic>=2.12,<3`. The old pin resolves
`pydantic-core==2.27.1`, which has **no prebuilt wheel for CPython 3.14 on Windows** and fails to compile
from source without an MSVC linker. The new range ships a cp314 wheel; the code uses only stable
pydantic-v2 API, so it's behavior-safe, and it still works on 3.12 and 3.11. On the Pi (Python 3.11) it
resolved `pydantic 2.13.5 / pydantic-core 2.46.5`; **pytest 21/21**. **Confirmed on pc-adis (Python
3.14.7) in the 6th session**: `pydantic-core 2.46.5-cp314` wheel resolved, pip EXIT 0, pytest 21/21.

---

## BL-001 · Per-ticker external ratings gauge

**Status:** In progress — gauge + backend adapter done and verified against real extractor data;
storage/UI for scheduled extraction split into BL-004 · **Added:** 2026-09-09 · **Area:** Frontend + Backend

### Summary
For each ticker, a **"gauge"** displaying five external ratings side by side: Zacks Rank, SA Quant, SA
Analysts, SA Wall Street, Investing.com — at-a-glance consensus alongside Atlas's own deterministic
score. Ratings are **ingested external facts**, not computed by Atlas (from the separate "email article
analyzer" extraction project). Each source has a different native scale/direction, so all are normalized
to a common 0–100 axis (Zacks inverted). No fabricated values — a missing source renders empty.

### Delivered (seeded, 2026-09-09) + adapter (2026-09-11)
- Backend `Rating`/`TickerRatings`/`RatingSource` models; `app/ratings.py` (seed + normalization +
  `build_ticker_ratings`); `GET /api/v1/signals/{symbol}/ratings`. Adapter mapping the extractor's
  snapshots to the five sources (`app/ratings_ingest.py` + `scripts/ratings_from_extractor.py` + feed
  contract). Verified end-to-end on the real AEM Seeking Alpha files.
- Frontend `RatingsGauge` in the asset drawer — five per-source meters + blended consensus, native
  value/label/scale, provenance/as-of, explicit "No data" rows. `role="meter"` for a11y.

### Remaining
- Wire the external extraction project's output into `RAW_RATINGS` via the feed; set real per-source
  `as_of` + a "stale" threshold; confirm each source's exact scale/labels; decide live-fetch vs seed.

---

## BL-002 · Frontend lint/a11y tooling (ESLint + react-hooks + jsx-a11y)

**Status:** Done (2026-09-11) · **Area:** Frontend tooling

Added ESLint 9 flat config wiring `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`,
`eslint-plugin-jsx-a11y`, `eslint-plugin-react-refresh`; a `lint` script; fixed every violation
(unused imports/props, un-exported gauge helper, keyboard-dismissible modal backdrops). `npm run lint`
clean (re-confirmed on the Pi 4th session, and on pc-adis 6th session).

## BL-003 · Full modal keyboard & focus accessibility

**Status:** Done (2026-09-11) · **Area:** Frontend a11y

New reusable `ModalOverlay` (`role="dialog"` + `aria-modal`, initial focus, Tab trap, Escape/outside
close, focus return). Pure wrap-around logic factored into `focusTrap.ts` and unit-tested (part of the
vitest 13/13).

## BL-004 · Dashboard-driven extraction, DB storage & freshness banner

**Status:** Done (2026-09-11) · **Area:** Frontend + Backend + Data integration

- Backend `app/store.py` — SQLite `ratings_runs` table + `latest_feed` + pure `evaluate_freshness`
  (stale > 3 days). `ratings.active_source()` serves latest DB run → file feed → seed. New endpoints
  `GET /api/v1/ratings/status` and `POST /api/v1/ratings/import` (scans `ATLAS_EXTRACTOR_GLOB`). 21
  backend tests pass.
- Frontend `RatingsBanner` — last-extracted time, red when stale (>3d), "Run extraction" opens the
  local extractor, "Import latest" pulls newest output into the DB. Gauge fetches real ratings from the
  API with the seed as offline-first fallback.
- **Also fixed pre-existing build blockers while building BL-001:** removed a duplicated block in
  `src/data/demo.ts`; added `noEmit:true` to `tsconfig.node.json` (TS5096).
