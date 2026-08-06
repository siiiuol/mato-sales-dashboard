# Backend operations

## Deployment

Set `APP_ENV=production`, `DEBUG=false`, a long random `LEAD_BOT_API_KEY`, an
explicit `CORS_ORIGINS` allowlist, and a non-default PostgreSQL password.
Apply `alembic upgrade head` before starting API or workers. The Compose
`lead-bot-migrate` service does this and creates PostGIS geometry plus its GiST
index on PostgreSQL; SQLite retains latitude/longitude demo compatibility.

KBO archives must be placed beneath `KBO_INGESTION_ROOT`. Full archives are
authoritative for KBO active status while retaining local reviews/enrichment.
Daily archives apply delete files before insert/upsert files. Imports are
transactional, checksummed, audited, and safe to repeat. Supported official
tables are meta, enterprise, establishment, denomination, address, contact,
activity, code, and branch. Configure accepted activity versions with
`NACE_VERSIONS=2003,2008,2025`.

## Health and observability

All internal endpoints require `x-mato-key`; mutating review calls should also
send `x-mato-actor`. `x-correlation-id` is accepted and returned.

- `GET /health`: load-balancer liveness only.
- `GET /internal/health`: database, queue, and provider configuration health.
- `GET /internal/metrics`: entity counts and processing job/queue status.
- `GET /internal/costs`: provider units, estimated cost, and freshness.
- `GET /internal/match-candidates`: fuzzy matches awaiting human review.
- `POST /internal/pipeline/{id}`: schedule the durable staged pipeline.

The pipeline checks suppression, resolves entities, discovers websites,
crawls, extracts, enriches geography/finance/timing, scores from **stored stage
features** (no second crawl on the score step), freezes a feature snapshot for
learning, and sends the record to human review. Review/Work queues sort by
**expected margin** (`P(meeting) × P(close|meeting) × expected_gross_margin`),
with a rule-derived EV and `insufficient_data` when shadow samples are thin.

No outreach or CRM export occurs without an explicit human approval action.
Google data is obtained through Places API only; permanently closed places are
hard-rejected into suppressions.

Discovery (after ranking is trustworthy):

- `POST /internal/discovery/places-sweep` — bakery/local Flanders category sweeps → KBO resolve → suppression → pipeline
- `POST /internal/discovery/customer-expansion` — CRM customers → second-machine expansion leads (not net-new spam)

Learning economics: `GET /internal/learning/metrics` exposes cost per approved
lead, gross margin per 100 reviewed, approval/meeting rates, and rule-vs-shadow
comparison. Rule candidates never auto-promote — use
`POST /internal/learning/rules/promote`.

## Backup and restore

Daily PostgreSQL backup:

```bash
docker compose exec -T postgres pg_dump -Fc -U mato mato_leads > mato-leads.dump
```

Restore into a stopped/empty target after retaining the current backup:

```bash
docker compose exec -T postgres pg_restore --clean --if-exists -U mato -d mato_leads < mato-leads.dump
docker compose run --rm lead-bot-migrate
```

Back up `.env` secrets separately in an approved secret manager; never include
them in database dumps or source control. Test restores regularly.

## Refresh runbook

1. Download the official KBO archive and verify its publisher checksum.
2. Copy it beneath `KBO_INGESTION_ROOT`.
3. Submit `POST /internal/import-kbo` with `path`, `territory`, and
   `import_type` (`full` or `daily`).
4. Confirm the import audit and `/internal/metrics` counts.
5. Schedule enrichment in controlled batches and monitor failed jobs and
   `/internal/costs`.
6. Re-run failed jobs with a new explicit idempotency key only after correcting
   the cause. Preserve import, feedback, review, and audit history.
