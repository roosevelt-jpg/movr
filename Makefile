# MOVR local development

.PHONY: up down logs migrate dev-backend dev-web dev-admin lint-hex

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

migrate:
	@echo "Apply SQL in order: backend/scripts/init.sql then backend/migrations/001_*.sql ..."
	@echo "Example: psql $$DATABASE_URL -f backend/scripts/init.sql"

dev-backend:
	pnpm --filter @movr/backend dev

dev-web:
	pnpm --filter @movr/web dev

dev-admin:
	pnpm --filter @movr/admin dev

lint-hex:
	node scripts/check-raw-hex.js
