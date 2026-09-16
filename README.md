# Atlas Portfolio Intelligence POC

A customer-demo vertical slice showing how a governed, AI-enabled application can be assembled quickly without making AI the source of financial calculations.

## Included experience

- Responsive Overview, Portfolio, Signals, Alerts, Analytics, and System views
- Scripted `65 → 90` decision event with a persisted alert state
- Deterministic, explainable signal scoring
- Portfolio concentration and risk calculations
- Grounded “Ask Atlas” answers
- Seeded data, freshness, provenance, and graceful offline behavior
- FastAPI contract and interactive API documentation
- Docker packaging for a reproducible machine-to-machine handoff

## Fastest preview

Open `preview.html` in any modern browser. It has no external dependencies and includes the core scenario, navigation, signal drawer, and assistant interaction.

## Run the complete application with Docker

Requirements: Docker Desktop or Docker Engine with Compose.

```bash
docker compose up --build
```

Then open:

- Dashboard: http://localhost:4173
- API documentation: http://localhost:8100/api/docs

Stop it with `docker compose down`.

> The Atlas backend is published on host port **8100** by default so it doesn't collide
> with the local ratings extractor ("email article analyzer") on :8000. Override with the
> `ATLAS_PORT` environment variable (the container still listens on 8000 internally).

## Run for development

Use Python 3.12 and Node.js 20 or 22.

Terminal 1:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend
uvicorn app.main:app --reload --port 8100   # 8100 avoids the extractor's :8000
```

Terminal 2:

```bash
npm install
npm run dev
```

The frontend works in deterministic local mode when the API is unavailable and automatically uses the API when it is running.

## Tests

```bash
cd backend && pytest -q
npm test
npm run build
```

See [HANDOFF.md](HANDOFF.md) for the customer walkthrough and transfer checklist.
