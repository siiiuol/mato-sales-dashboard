# MATO Lead Intelligence Bot (Phases 1–2)

Python service that imports Belgian CBE/KBO data, enriches websites, scores leads, and feeds the Next.js CRM **Review** channel.

## Quick start (no Docker)

```bash
cd lead-bot
copy .env.example .env
python -m venv .venv
.\.venv\Scripts\activate
pip install -e .
alembic upgrade head
# Prefer real KBO Open Data (free) — see ../docs/free-data-sources.md
# python -m lead_bot.jobs.import_kbo --path data/kbo/latest.zip --region east_west_flanders
# python -m lead_bot.jobs.enrich_pipeline --min-preliminary 30 --limit 100
uvicorn lead_bot.api.main:app --reload --port 8000
```

Note: on Python 3.14 the API uses **Starlette** (not FastAPI) because Pydantic is currently incompatible with 3.14.

Health: http://localhost:8000/health

API key header: `x-mato-key: <LEAD_BOT_API_KEY>`. Production startup rejects a
missing key or the legacy `mato-dev-key`. CORS is restricted to `CORS_ORIGINS`.

## With Docker (Postgres + Redis)

From repo root:

```bash
docker compose up -d postgres redis
docker compose up -d lead-bot-migrate lead-bot-api lead-bot-worker
```

## KBO import

Register at [CBE Open Data](https://kbopub.economie.fgov.be/kbo-open-data/login), download a Full/Update ZIP, then:

```bash
python -m lead_bot.jobs.import_kbo --path latest.zip --region east_west_flanders
python -m lead_bot.jobs.enrich_pipeline --min-preliminary 30 --limit 100
```

## CRM bridge

- `POST /internal/sync-crm` — pulls DO_NOT_CONTACT + customers from `prisma/dev.db` into suppressions
- Approved leads POST to Next.js `http://localhost:3000/api/intelligence/import`

## Env vars

See `.env.example`. Set `OPENAI_API_KEY` for live LLM extraction; without it, heuristic keyword extraction is used.
Import paths are resolved under `KBO_INGESTION_ROOT`.
POI discovery defaults to **free OpenStreetMap Overpass** when
`GOOGLE_PLACES_API_KEY` is empty; Google Places is an optional paid override
(official API only — never scraped).

Social enrichment discovers public Instagram, Facebook, TikTok, LinkedIn,
YouTube, and X/Twitter profile links from crawled company websites (footer /
contact page links). It does **not** scrape login-walled social apps; profiles
are stored as contacts, shown in Review, and used as scoring signals.

Operational procedures and internal endpoint details are in
[`docs/operations.md`](docs/operations.md).
