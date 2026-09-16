# POC architecture

```text
Browser
  |
  v
Nginx / React application
  |             |
  |             +--> deterministic local fallback
  v
FastAPI
  |
  +--> seeded provider
  +--> signal engine
  +--> risk engine
  +--> grounded assistant response
```

The same business rules are implemented in TypeScript for offline demonstration and Python for API validation. This deliberate duplication is limited to the POC. In production, FastAPI should be the sole calculation authority and the frontend should render returned values only.

## API routes

- `GET /api/v1/system/health`
- `GET /api/v1/demo/state`
- `POST /api/v1/demo/scenario/activate`
- `POST /api/v1/demo/scenario/reset`
- `GET /api/v1/portfolios/demo/summary`
- `GET /api/v1/portfolios/demo/positions`
- `GET /api/v1/signals`
- `GET /api/v1/signals/{symbol}`
- `GET /api/v1/alerts`
- `GET /api/v1/analytics/risk`
- `POST /api/v1/assistant/ask`

## Key decision

The assistant receives structured calculated facts. It does not generate financial values. The current POC formats a deterministic grounded response; a destination-machine LLM integration can later replace only the language-rendering step.
