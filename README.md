# MATO — lead search, calling, logging

One job: find local businesses worth calling, decide who to call, dial them,
write down what happened.

```
Search  →  Triage  →  Call  →  Log
```

| | |
|---|---|
| Stack | Next.js · Prisma · SQLite |
| Port | 3000 |
| Screens | Work (`/`), Leads (`/leads`), Calls (`/calls`), Settings (`/settings`) |

## Setup

```bash
copy .env.example .env
npm install
npm run db:setup
npm run dev
```

The seed creates a local admin from `MATO_ADMIN_EMAIL` plus
`MATO_ADMIN_PASSWORD` or `MATO_ADMIN_PASSWORD_HASH`. For a fresh local-only
checkout the fallback is `admin@mato.local` / `mato-admin-dev`; change it before
sharing the environment. Production requires a random `SESSION_SECRET` of at
least 32 characters. Sessions are Jose-signed, HttpOnly, SameSite=Lax cookies.
Roles are `admin`, `sales`, and `reviewer`.

## The loop

**Search** — pick a zone in Leads and press *Search for leads*. This queries
OpenStreetMap town by town for bakeries, patisseries, butchers, chocolatiers,
ice-cream shops, traiteurs, cheese shops and farm shops, plus a separate pass
for premises that already run a vending machine. Free, no API key.

**Triage** — every new business waits for your decision. **Contact** puts it on
the call list; **Skip** hides it. Nothing is deleted: skipped leads stay under
`/leads?status=SKIPPED` and can be unskipped.

**Call** — the call card shows the number as a `tel:` link with an opener,
angle, suggested machine, questions and the likely objection.

**Log** — record the outcome. Callbacks set a follow-up date and the lead
returns to the queue then. The next lead loads automatically.

## Things worth knowing

- **Coverage builds up over several searches.** OpenStreetMap's public servers
  throttle heavily, so one search typically covers part of a province. Search
  the same zone again to fill the gaps — results dedupe on OSM id, so nothing
  doubles up. Each run reports how many towns it managed.
- **About a third of shops publish a phone number.** Those rank highest; a lead
  you cannot dial is not yet a lead. The rest usually have a website.
- **Businesses that already run a vending machine rank top.** They are proven
  buyers and candidates for a replacement or a second machine, so the scan
  hunts `amenity=vending_machine` deliberately and flags the operator.
- **Marking a lead WON stops rescans finding it again**, by name and by
  proximity (`exclusionRadiusKm` in Settings).

`GOOGLE_PLACES_API_KEY` remains an optional paid upgrade with far better
coverage; leave it empty to stay on free data.

## Scripts

```bash
npm run typecheck
npm test
npx tsx scripts/smoke-osm-scan.ts "West-Vlaanderen"
```

The smoke script runs a real search without touching the database and reports
town coverage, phone-number rate and how many businesses already have a machine.

## PostgreSQL

SQLite is the zero-Docker local database. For production set `DATABASE_URL` to
PostgreSQL and generate the equivalent schema:

```bash
npm run db:postgres:schema
npx prisma migrate dev --schema prisma/schema.postgresql.prisma --name initial
```

Commit the generated migration history in a production rollout. Re-run
`db:postgres:schema` after model changes.

## `lead-bot/`

An earlier Python enrichment service, no longer wired into the app. It is left
on disk untouched in case the Belgian enterprise-register (KBO) route is
revisited; nothing in the app depends on it and it does not need to run.
