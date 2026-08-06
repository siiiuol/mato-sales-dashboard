# Free public-data sources

MATO is designed to run with **zero paid map/search APIs**. Defaults:

| Layer | Source | Cost |
|-------|--------|------|
| Legal company graph | KBO / CBE Open Data (Belgium) | Free ZIP after registration |
| Local shops / phone / hours / website | OpenStreetMap via Overpass API | Free (fair use) |
| Website product / timing signals | Public HTTP crawl + heuristic extract | Free |
| LLM extract | Heuristic when `OPENAI_API_KEY` empty | Free |
| Finance | NBB marked unavailable | No fake mid scores |

## What we do **not** do

- Scrape Google Maps / Places HTML
- Login-walled Instagram / Facebook scrapers
- Paid CBE Public Search webservice (unless you buy it later)

## 1. KBO Open Data (required for real Review)

1. Register at [KBO Open Data](https://kbopub.economie.fgov.be/kbo-open-data/login) (free).
2. Accept the open-data licence.
3. Download the **Full** ZIP of active enterprises / establishments.
4. Save as `lead-bot/data/kbo/latest.zip`.
5. Import and enrich:

```bash
cd lead-bot
.\.venv\Scripts\activate
python -m lead_bot.jobs.import_kbo --path data/kbo/latest.zip --region east_west_flanders
python -m lead_bot.jobs.enrich_pipeline --min-preliminary 30 --limit 100
uvicorn lead_bot.api.main:app --reload --port 8000
```

Canonical identity stays KBO. OSM only enriches POI fields and helps discovery matching.

## 2. OpenStreetMap Overpass (default Places)

When `GOOGLE_PLACES_API_KEY` is empty, lead-bot and CRM Scan use Overpass:

- Endpoints: `overpass-api.de`, `overpass.kumi.systems` (failover)
- Tags: `shop=bakery`, `pastry`, `butcher`, `chocolate`, `deli`, etc.
- Region bboxes for Flanders provinces

### Etiquette

- Space requests (~1s between calls)
- Prefer small bboxes / limits — do not hammer public mirrors
- For heavy bulk, download a Geofabrik Belgium extract and host your own Overpass

CRM Zone Scan → source `openstreetmap`. Lead-bot cost events use `provider=openstreetmap` at **€0**.

## 3. Optional paid overrides

| Env / Setting | Effect |
|---------------|--------|
| Settings → Google Places API key | CRM Scan uses Google Nearby/Details |
| `GOOGLE_PLACES_API_KEY` in lead-bot `.env` | Match + category sweep via Google |
| `OPENAI_API_KEY` | Structured website extraction instead of heuristics |

## 4. Coverage expectations

OSM phone/website coverage is **patchy** compared to Google. Gaps are normal:

- Prefer KBO + website crawl for evidence
- Missing phone → call queue may wait until crawl finds a contact page
- Closed shops tagged `disused` / `abandoned` / `shop=vacant` hard-reject like Google `CLOSED_PERMANENTLY`
