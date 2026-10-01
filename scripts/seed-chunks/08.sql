INSERT INTO "DocumentTemplate" (
  id, code, name, category, language, version, status, "numberPrefix", body, "outputFormats", "effectiveAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'PARTNER_INTAKE',
  'Onboarding intakeformulier',
  'PARTNERSHIP',
  'nl',
  1,
  'MATO_APPROVED',
  'MATO-INT',
  '# INTAKEFORMULIER — NIEUWE PARTNER

In te vullen bij opstart van een nieuwe samenwerking.

**Documentnummer:** {{documentnummer}}
**Datum:** {{datum}}

## 1. Bedrijfsgegevens partner

| | |
|---|---|
| Bedrijfsnaam | {{klant_naam}} |
| Ondernemingsnummer (btw) | {{klant_ondernemingsnummer}} |
| Adres maatschappelijke zetel | {{klant_adres}} |
| Contactpersoon | {{klant_contactpersoon}} |
| Telefoonnummer | {{klant_telefoon}} |
| E-mailadres | {{klant_email}} |

## 2. Locatiegegevens verkooppunt

| | |
|---|---|
| Adres locatie | {{locatie_adres}} |
| Type locatie | {{locatie_type}} |
| Openingsuren | {{openingsuren}} |
| Parkeermogelijkheid voor levering | {{parkeermogelijkheid}} |

## 3. Technische vereisten

| Vereiste | Gecontroleerd |
|---|---|
| Elektriciteitsaansluiting aanwezig (220V, apart stopcontact) | {{elektriciteit_aanwezig}} |
| Voldoende ruimte voor plaatsing | {{ruimte_voldoende}} |
| Vlakke, stabiele ondergrond | {{ondergrond_stabiel}} |
| Internet-/gsm-bereik voor betaalterminal gecontroleerd | {{internet_bereik}} |

Afmetingen beschikbare ruimte: {{afmetingen_ruimte}}. Type automaat gewenst: {{type_automaat_gewenst}}.

## 4. Assortiment

Gewenste producten: {{gewenste_producten}}. Bewaartemperatuur: {{bewaartemperatuur}}. Houdbaarheid / THT-termijn: {{houdbaarheid_termijn}}.

## 5. Samenwerkingsvorm

{{samenwerkingsvorm}}

## Ingevuld door

{{ingevuld_door}} (MATO) — {{datum}}
',
  'PDF',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "DocumentTemplate" WHERE code = 'PARTNER_INTAKE' AND version = 1
);
