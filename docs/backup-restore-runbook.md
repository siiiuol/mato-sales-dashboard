# MATO OS back-up- en herstelprocedure

## Dagelijkse back-up

`npm run backup` maakt een consistente SQLite-back-up via de online
`.backup`-opdracht of een PostgreSQL custom dump via `pg_dump`. Bij elk bestand
wordt een SHA-256-checksum geschreven.

De workflow `Dagelijkse databaseback-up` draait om 02:15 Belgische wintertijd.
Stel in GitHub deze secrets in:

- `BACKUP_DATABASE_URL`: een directe, alleen voor back-ups gebruikte
  PostgreSQL-verbinding;
- `BLOB_READ_WRITE_TOKEN`: private Vercel Blob-opslag voor duurzame retentie.

Lokale bestanden blijven 35 dagen bewaard; van de voorgaande 13 maanden blijft
één bestand per maand bewaard. Dezelfde retentie wordt op de private Blob-store
toegepast. GitHub bewaart daarnaast elk dagelijks workflow-artifact 35 dagen.

## Driemaandelijkse hersteltest

Herstel nooit over productie.

1. Kies de nieuwste dump en vergelijk de checksum:
   `sha256sum -c mato-....dump.sha256`.
2. Maak een lege, geïsoleerde PostgreSQL-database.
3. Herstel met
   `pg_restore --clean --if-exists --no-owner --dbname "$RESTORE_URL" mato-....dump`.
   Voor SQLite: `sqlite3 restored.db ".restore 'mato-....sqlite'"`.
4. Zet `DATABASE_URL` en `DIRECT_URL` tijdelijk op de hersteldatabase en voer
   `npm run db:migrate:deploy` uit.
5. Voer `npm run typecheck`, `npm test` en `npm run lint` uit.
6. Vergelijk minstens aantallen gebruikers, leads, klanten, deals,
   machineplaatsingen, documenten, taken en auditregels met productie.
7. Leg datum, operator, back-upnaam, checksum, hersteltijd en afwijkingen vast.
8. Verwijder de geïsoleerde testdatabase na goedkeuring.

## Sleutelrotatie

`SESSION_SECRET` versleutelt mailboxtokens en API-sleutels. Na rotatie moeten
Places, Anthropic, Microsoft client secret en mailboxkoppelingen opnieuw worden
ingesteld. Bewaar `SESSION_SECRET` nooit in de databaseback-up.
