# Accounts, opslag en back-up — opruimplan

Opgesteld 03-10-2026. Reden: de bestanden en logins van MATO staan verspreid over vier
identiteiten, en dat is niet alleen onoverzichtelijk — het blokkeert deploys en er blijkt
geen databaseback-up te bestaan.

---

## 0. EERST DIT: er is geen back-up van de database

**Stand op 03-10-2026: nul back-ups, ooit.** `gh api .../actions/artifacts` geeft
`total_count: 0`.

De workflow *Dagelijkse databaseback-up* draait elke nacht om 01:15, maar het secret
**`BACKUP_DATABASE_URL`** is nooit gezet. Maanden lang eindigde de run daardoor groen in 4 tot 9
seconden zonder iets te doen — dat staat ook zo in het commentaar van de workflow. Die stap faalt
nu met opzet luid in plaats van over te slaan, en dat is precies wat er vanmorgen gebeurde toen de
run met de hand werd gestart: `failure`, met de melding dat het secret ontbreekt.

Dit raakt de klanten, leads, documenten en de leadbot-data van MATO OS.

**Zo gezet** (alleen jij kan dit, het is een productiewachtwoord):
1. Haal de verbindingsreeks op in Vercel → project `mato-sales-dashboard` → Settings →
   Environment Variables. Neem de **directe** verbinding, niet de pooler.
2. GitHub → repo → Settings → Secrets and variables → Actions → New repository secret.
   Naam exact `BACKUP_DATABASE_URL`.
3. Optioneel `BLOB_READ_WRITE_TOKEN` erbij: zonder die blijft de back-up 35 dagen als artifact bij
   de run hangen en gaat er niets naar blob-opslag. De run slaagt wel.
4. Start daarna de workflow met de hand (Actions → Dagelijkse databaseback-up → Run workflow) en
   controleer dat er een artifact verschijnt met een plausibele omvang. **Een groene run zonder
   artifact betekent nog steeds geen back-up.**

---

## 1. Wat er nu verspreid staat

| Waar | Identiteit | Wat hangt eraan |
|---|---|---|
| GitHub | `xinchen300-cpu` | `mato-vending` |
| GitHub | `siiiuol` | `vendly`, `ledoux`, `sferio`, `mato-sales-dashboard`, `prvn` |
| Vercel | `xinchen300-9475` | team `mato1`, alle vijf de projecten |
| Git lokaal | `xinchen300-cpu / xinchen300@gmail.com` | de commits |

**Dit kost nu al deploys.** Een push naar `mato-vending` of `vendly` levert een deployment met
status `Blocked` en de melding *"the deployment was blocked because the commit author doesn't have
permission to create deployments for this project"*. De commits zijn van `xinchen300-cpu`, gepusht
door `siiiuol`, en Vercel kent alleen `xinchen300-9475`. Dat de sites toch kloppen komt doordat er
via de CLI gedeployd wordt — die is wél ingelogd.

---

## 2. Eén GitHub-organisatie (dit moet je in de browser doen)

Een organisatie kan niet via de API worden aangemaakt door een persoonlijk account; dat is de enige
stap waar geen commando voor bestaat.

1. Ga naar <https://github.com/organizations/plan> en kies **Free**.
2. Naam: `mato-automaat` (of iets anders dat vrij is — hij komt in alle repo-URL's te staan).
3. Zet als contactmail `info@matoautomaat.be`, niet een privéadres.
4. Nodig **beide** persoonlijke accounts uit als lid met de rol **Owner**: `xinchen300-cpu` en
   `siiiuol`. Zo kan je vanuit elk van de twee werken en ben je niemand kwijt.

`prvn` laat je waar hij staat — die is publiek, van juni, en lijkt niets met MATO te maken te
hebben.

---

## 3. De vijf repo's overdragen

**Eerst de secrets opschrijven, want die gaan NIET mee bij een overdracht.** In
`mato-sales-dashboard` staan er twee: `CRON_SECRET` en `MATO_BASE_URL` (plus de
`BACKUP_DATABASE_URL` die je in stap 0 zet). De andere repo's hebben er geen.

Verliezen die secrets betekent: de **mailsync stopt stil** (die draait elk kwartier en gebruikt
`CRON_SECRET` en `MATO_BASE_URL`) en de back-up faalt weer. De waarden vind je in Vercel bij het
project, en `MATO_BASE_URL` is simpelweg de productie-URL.

Daarna, met `gh` (de CLI mag dit; vraagt hij meer rechten, draai dan eerst
`gh auth refresh -s admin:org`):

```
ORG=mato-automaat
gh api -X POST /repos/xinchen300-cpu/mato-vending/transfer       -f new_owner=$ORG
gh api -X POST /repos/siiiuol/vendly/transfer                    -f new_owner=$ORG
gh api -X POST /repos/siiiuol/ledoux/transfer                    -f new_owner=$ORG
gh api -X POST /repos/siiiuol/sferio/transfer                    -f new_owner=$ORG
gh api -X POST /repos/siiiuol/mato-sales-dashboard/transfer      -f new_owner=$ORG
```

Daarna in elke lokale map de remote bijwerken:

```
for r in mato-vending vendly ledoux sferio mato-sales-dashboard; do
  git -C ~/GitHub/$r remote set-url origin "https://github.com/$ORG/$r.git"
done
```

Zet de secrets opnieuw bij de verhuisde `mato-sales-dashboard`, en controleer dat de mailsync
daarna nog loopt (Actions → Mailsync elke 15 minuten).

---

## 4. Vercel weer aan GitHub koppelen

1. Vercel → Settings → Git → installeer de **Vercel GitHub App op de organisatie** en geef hem
   toegang tot de vijf repo's. Zonder die installatie blijft elke push een `Blocked` deploy geven.
2. Vercel → Account Settings → **Login Connections**: zorg dat het GitHub-account waarmee je
   commit (`xinchen300-cpu`) aan dit Vercel-account hangt. Dat is wat de melding over de
   *commit author* oplost.
3. Test met een lege commit op één repo en kijk of de deploy `Ready` wordt in plaats van `Blocked`.

**Wat NIET verandert:** de live URL's (`www.matoautomaat.be`, `vendly-six-gold.vercel.app`,
`ledoux-peach.vercel.app`, `sferio.vercel.app`), het Vercel-team `mato1`, de Supabase-projecten, en
de lokale mappen in `~/GitHub`. GitHub laat de oude repo-URL's ook doorverwijzen, dus een oude link
blijft werken.

---

## 5. Google Drive — voor documenten, nooit voor code

**Code hoort niet in een sync-map.** Dat is hetzelfde probleem waar de repo's op 02-10-2026 uit zijn
gehaald: een sync-client die `.git` en `node_modules` beheert, geeft kruipende builds, `git`-
commando's die minuten duren en in het ergste geval een halfgesynchroniseerde repo. Git *is* je
sync, met geschiedenis erbij. De repo's blijven dus in `~/GitHub`.

Een cloud drive is wél de juiste plek voor alles wat géén code is, en dat is waarschijnlijk precies
wat je kwijtraakt:

```
MATO/
  Administratie/        facturen, btw, contracten, verzekering
  Automaten/            aankoopbonnen, serienummers, foto's, handleidingen
  Klanten/              per zaak: contract, prijsafspraken, vaklijst
  Payter en Televend/   exports, afrekeningen
  Marketing/            foto's, video's, nieuwsbrieven
```

Kies **één** drive. Je gebruikt iCloud Drive nu niet voor documenten, dus Google Drive is een
prima keuze — maar dan niet daarnaast ook iCloud, want dan heb je het probleem twee keer.

Wat er nooit in gaat: de repo's, `node_modules`, `.env`-bestanden en wachtwoorden.

---

## 6. Eén wachtwoordmanager

Er zijn minstens acht logins in het spel: twee GitHub-accounts, Vercel, Supabase, MyPayter, Brevo,
plus de klantlogins van Ledoux en Sferio. Dat is te veel om te onthouden en te belangrijk voor een
notitie-app. Zet ze in één manager, met de klantlogins in een aparte map zodat je ze kan delen
zonder de rest bloot te geven.

`.env.local`-bestanden en de waarden in Vercel zijn geen back-up van je wachtwoorden — als die Mac
stukgaat, is `SESSION_SECRET` weg en kan niemand meer op de mini-sites.
