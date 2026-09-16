.PHONY: dev backend frontend test build docker-up docker-down handoff-check

# Host port for the Atlas backend. Defaults to 8100 so it doesn't collide with the
# local ratings extractor on :8000. Override: `make backend ATLAS_PORT=8000`.
ATLAS_PORT ?= 8100

dev:
	@echo "Run 'make backend' and 'make frontend' in separate terminals."

backend:
	cd backend && uvicorn app.main:app --reload --port $(ATLAS_PORT)

frontend:
	npm run dev

test:
	cd backend && pytest -q
	npm test

build:
	npm run build

docker-up:
	docker compose up --build

docker-down:
	docker compose down

handoff-check:
	./scripts/validate_handoff.sh
