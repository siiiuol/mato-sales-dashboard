@AGENTS.md

# MATO OS — verkoop, klanten en documenten

Next.js + Prisma. Draait op Vercel; de database is Postgres in productie en SQLite lokaal.
GitHub Actions doet drie dingen: **Kwaliteitscontrole** bij elke push, **Mailsync** elk kwartier
en een **dagelijkse databaseback-up**.

## Twee dingen die de CI steeds rood zetten

**1. Het Postgres-schema is gegenereerd, niet geschreven.**
`prisma/schema.prisma` is de bron (SQLite). `prisma/schema.postgresql.prisma` wordt eruit
gemaakt door `prisma/prepare-postgres.mjs`, dat alleen de provider en de url omzet.
Wijzig je het bronschema, draai dan **altijd**:

```
npm run db:postgres:schema     # en commit het gegenereerde bestand mee
```

De CI doet precies dit en daarna `git diff --exit-code -- prisma/schema.postgresql.prisma`.
Vergeet je het, dan faalt de eerste stap en draaien typecheck, tests en lint niet eens.
Het liep al 171 regels uit elkaar voor dit werd opgemerkt. Bewerk het gegenereerde bestand
nooit met de hand — de kop zegt het ook.

**2. `git commit -a` voegt nieuwe bestanden niet toe.**
Zo kwamen commits op GitHub terecht die `@/components/NavigationPendingBar` importeren
terwijl dat bestand er niet staat, en die functies uit `cadence-actions` gebruiken die
daar niet geëxporteerd worden. De CI faalt dan op typecheck, maar de code werkt lokaal —
dus je merkt het niet. Gebruik **`git add -A`** en kijk naar `git status` voor je commit:
raakt een feature meerdere bestanden, dan horen ze in dezelfde commit.

## Vaste regels
- **Nederlands** voor alles wat een gebruiker leest en voor commit messages; code en variabelen Engels.
- **Zet geen setState in een effect** om op een padwijziging te reageren. Lint keurt dat af
  ("Calling setState synchronously within an effect can trigger cascading renders"). Pas de
  state tijdens de render aan, zoals `Shell.tsx` doet met `menuPath`.
- Tests draaien met `tsx --test` over `src/**/*.test.ts`. Hernoem je een API, werk dan de test
  mee bij — `sections.test.ts` testte maanden een `SECTIONS`-indeling die al vervangen was
  door de vier `APP_TABS`, en is nu `tabs.test.ts`.
- De tabbalk is **bewust vier items**. Nieuwe pagina's gaan in `APP_MENU_NAV` (achter de eigen
  naam) of `PLATFORM_ADMIN_NAV` (alleen beheerder), niet in de balk. Afscherming staat in
  `requirePageUser`, niet in de navigatie.

## Volledige CI lokaal naspelen
```
npm ci && npx prisma generate
npm run db:postgres:schema && git diff --exit-code -- prisma/schema.postgresql.prisma
npx prisma validate
npm run typecheck && npm test && npm run lint
```
`DATABASE_URL=file:./ci.db` zoals de CI doet. Draai dit niet vanuit iCloud maar vanuit een
kopie buiten `~/Documents` — daar lopen `prisma generate` en `tsc` vast.
