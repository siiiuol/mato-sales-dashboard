# Databasewijzigingen

`prisma/schema.prisma` is de bron voor lokale SQLite-ontwikkeling.
`prisma/prepare-postgres.mjs` genereert daaruit het PostgreSQL-schema.

## Nieuwe wijziging

1. Pas `prisma/schema.prisma` aan.
2. Voer `npm run db:migrate:dev -- --name korte_naam` uit tegen een aparte
   PostgreSQL-ontwikkeldatabase.
3. Controleer en commit de migration en `schema.postgresql.prisma`.
4. De deployment voert `npm run db:migrate:deploy` uit vóór de nieuwe appversie.

`npm run db:push` mag alleen tegen de lokale SQLite-database worden gebruikt.

## Bestaande PostgreSQL-database baselinen

De migration `20260824090000_baseline` beschrijft het volledige bestaande
schema. Op een lege database wordt die normaal uitgevoerd. Op een reeds
ingevulde database:

1. maak en verifieer eerst een back-up;
2. vergelijk de live database met `schema.postgresql.prisma`;
3. los eventuele drift bewust op;
4. markeer pas daarna de baseline:
   `npx prisma migrate resolve --applied 20260824090000_baseline --schema prisma/schema.postgresql.prisma`;
5. controleer met `npm run db:migrate:status`.

Markeer een migration nooit blind als toegepast: Prisma controleert dan niet of
de tabellen werkelijk overeenkomen.
