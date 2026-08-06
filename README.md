# MATO Sales OS + Lead Intelligence

## Apps

| App | Stack | Port |
|-----|--------|------|
| CRM dashboard | Next.js · Prisma · SQLite | 3000 |
| Lead intelligence bot | Starlette · SQLAlchemy · SQLite/Postgres | 8000 |

## CRM

```bash
copy .env.example .env
npm install
npm run db:setup
npm run dev
```

On Windows use `copy .env.example .env`. The seed creates a local admin from
`MATO_ADMIN_EMAIL` plus `MATO_ADMIN_PASSWORD` or `MATO_ADMIN_PASSWORD_HASH`.
For a fresh local-only checkout the fallback is `admin@mato.local` /
`mato-admin-dev`; change it before sharing the environment. Production requires
a random `SESSION_SECRET` of at least 32 characters. Sessions are Jose-signed,
HttpOnly, SameSite=Lax cookies. Roles are `admin`, `sales`, and `reviewer`.

The lead-bot is the canonical acquisition and review path. The browser only calls
same-origin `/api/review/**` handlers; `LEAD_BOT_API_KEY` stays server-only.
Email records are preparation/approval queues only—this CRM has no send action.

### PostgreSQL production path

SQLite remains the zero-Docker local database. For production, set
`DATABASE_URL` to PostgreSQL and generate the equivalent schema:

```bash
npm run db:postgres:schema
npx prisma migrate dev --schema prisma/schema.postgresql.prisma --name initial
npx prisma migrate deploy --schema prisma/schema.postgresql.prisma
```

Commit the generated PostgreSQL migration history in a production rollout.
`npm run db:postgres:push` is available for disposable staging databases only;
use migrations for production. Re-run `db:postgres:schema` after model changes.

## Free local setup (no paid Places / OpenAI)

MATO defaults to **free public data**:

| Need | Source |
|------|--------|
| Company universe | [KBO / CBE Open Data](https://kbopub.economie.fgov.be/kbo-open-data/login) (free ZIP) |
| Local POIs / phone / hours | OpenStreetMap via Overpass |
| Website evidence | Public HTTP crawl + heuristic extract |

```bash
cd lead-bot
copy .env.example .env
python -m venv .venv
.\.venv\Scripts\activate
pip install -e .

# 1) Register at KBO Open Data, download Full ZIP → data/kbo/latest.zip
python -m lead_bot.jobs.import_kbo --path data/kbo/latest.zip --region east_west_flanders
python -m lead_bot.jobs.enrich_pipeline --min-preliminary 30 --limit 100

# 2) Start API (Google/OpenAI keys optional — leave empty)
uvicorn lead_bot.api.main:app --reload --port 8000
```

Then open **Work** / **Review** at http://localhost:3000. Zone Scan in Leads uses OSM when no Google Places key is set in Settings.

Details: [docs/free-data-sources.md](docs/free-data-sources.md).

Optional Docker Postgres/Redis: `docker compose up -d` (see root `docker-compose.yml`).

`GOOGLE_PLACES_API_KEY` / `OPENAI_API_KEY` remain optional paid upgrades.

Full bot docs: [lead-bot/README.md](lead-bot/README.md)

Learning evaluation, budget/freshness controls, and backup/restore procedures:
[docs/learning-operations-runbook.md](docs/learning-operations-runbook.md).
