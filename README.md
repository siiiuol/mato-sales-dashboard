# MATO — leads zoeken, claimen, contacteren

Eén job: lokale zaken vinden die de moeite waard zijn, op je naam zetten,
contacteren, en opschrijven wat er gebeurde.

```
Zoeken  →  Claimen  →  Contacteren  →  Noteren (op de fiche)
```

| | |
|---|---|
| Stack | Next.js · Prisma · SQLite |
| Port | 3000 |
| Screens | Mijn leads (`/`), Leads (`/leads`), Settings (`/settings`) |

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

**Search** — pick a zone in Leads and press *Search for leads*. It sweeps every
town in the zone for bakeries, patisseries, butchers, chocolatiers, ice-cream
shops and traiteurs, plus a pass for premises that already run a vending
machine.

With a Google Places key in Settings this takes about a minute per province and
roughly 90% of results carry a phone number. Without one it falls back to
OpenStreetMap: free, but slower, patchier, and only ~30% have phones.

**Triage** — every new business waits for your decision. **Interessant** keeps
it for follow-up; **Skip** hides it. Nothing is deleted: skipped leads stay
under `/leads?status=SKIPPED` and can be unskipped.

**Claim** — press *Aan mijn leads toevoegen*. The lead is yours (commission
protection) and you land on the company fiche.

**Contact** — on the fiche, log a call, email, visit or note. Mail drafts and
contracts live there too. Everything shows up in one history timeline.

## Things worth knowing

- **Google Places is the good path.** It searches by *primary* type, so
  supermarkets with an in-store bakery are excluded and you get independent
  shops. A West-Vlaanderen sweep returned 717 businesses in 58 seconds, 92% with
  a phone number. Cost is roughly €1–2 per province scan.
- **OpenStreetMap is the free fallback.** Its public servers throttle hard, so
  one search covers part of a province — search again to fill the gaps, results
  never duplicate. Each run reports how many towns it managed.
- **A phone number is the most valuable signal.** Leads you can dial rank
  highest; a lead you cannot call is not yet a lead.
- **Businesses that already run a vending machine rank top.** They are proven
  buyers and candidates for a replacement or a second machine, so the scan
  hunts `amenity=vending_machine` deliberately and flags the operator.
- **Marking a lead WON stops rescans finding it again**, by name and by
  proximity (`exclusionRadiusKm` in Settings).

The Places key lives in **Settings**, stored in the database — never in a
committed file. It needs *Places API (New)* enabled on the Google Cloud project
plus an active billing account; the legacy Places endpoints no longer work for
projects created after March 2025. Mail drafting uses an Anthropic key in
Settings.

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
