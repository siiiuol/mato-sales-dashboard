# Learning operations runbook

The rule scorer remains authoritative. Shadow predictions are evaluation-only, and a
candidate rule version becomes active only through `mato-learning promote --version
<version> --actor <operator>` or the authenticated promotion API
(`POST /internal/learning/rules/promote`). Nothing auto-promotes.

Review ranking uses `expected_margin = P(meeting) × P(close|meeting) × expected_gross_margin`.
When labeled outcomes are below the shadow model's `minimum_samples`, the API falls
back to rule-derived EV and sets `insufficient_data: true`. Outcome joins prefer the
frozen `score_feature_snapshot` feature written at score time.

Primary economics for Work/Reports: **gross margin per 100 reviewed**, cost per
approved lead, approval rate, meeting rate, and rule-vs-shadow MAE from
`GET /internal/learning/metrics` (also surfaced on the Next.js Sales learning panel).

## Operations

- Run cohort evaluation: `mato-learning evaluate --cohort all`
- Inspect economics and rule-vs-shadow metrics: `mato-learning report --cohort all`
- Export the append-only learning audit: `mato-learning audit-export`
- Configure `ProviderBudget` rows per provider. Stop new paid calls when the budget
  endpoint returns `cutoff`; alert operators when it returns `alert`.
- Configure `FreshnessPolicy` rows per scored field. Critical stale or absent fields
  block review approval with `409 research_required`.

Outcome ingestion accepts only the dedicated `LEARNING_SERVICE_KEY`, a stable service
identifier, and an idempotency key. CRM credentials never enter browser code.

## Backup, restore, and retention

1. Quiesce ingestion and record the latest audit export.
2. PostgreSQL: run an encrypted `pg_dump --format=custom`; SQLite: use the SQLite
   online backup command rather than copying a live database file.
3. Retain daily backups for 35 days and monthly backups for 13 months in encrypted,
   access-logged object storage. Learning snapshots and audit records are append-only;
   remove them only under an approved legal-retention request.
4. Quarterly, restore the newest backup into an isolated environment, run migrations,
   compare row counts and checksums from the audit export, then run backend tests.
5. Record restore duration, operator, backup identifier, checksum, and discrepancies.
   Never test a restore over the production database.
