INSERT INTO "DocumentTemplate" (
  id, code, name, category, language, version, status, "numberPrefix", body, "outputFormats", "effectiveAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'PARTNER_PRIJZEN',
  'Prijzen- en voorwaardenblad',
  'PARTNERSHIP',
  'nl',
  1,
  'MATO_APPROVED',
  'MATO-PP',
  '# PRIJZEN- EN VOORWAARDENBLAD

Geldig vanaf {{datum}} · alle bedragen excl. btw
**Documentnummer:** {{documentnummer}}

## 1. Verkoop van een automaat

Aankoopprijs: {{automaat_aankoopprijs}}. Levering & installatie: {{levering_installatie}}. Garantie: {{garantieperiode}}. Onderhoudscontract (optioneel): {{onderhoudscontract_bedrag}} per maand.

## 2. Huur van shopruimte

Vaste prijs per maand: {{shophuur_bedrag}}. Waarborg: {{shophuur_waarborg}}, terugbetaalbaar. Opzegtermijn: {{shophuur_opzegtermijn}}.

## 3. Externe plaatsing / rental

| Formule | Omschrijving |
|---|---|
| A — Vaste huur | {{rental_vaste_huur}} per maand, ongeacht omzet |
| B — Commissie | {{rental_commissie_percentage}}% van omzet, geen vaste kost |
| C — Combinatie | Vast {{rental_vast_bedrag}} + {{rental_combi_commissie}}% commissie |

## 4. Bijkomende kosten

Transport bij verplaatsing automaat: {{transportkost}}. Interventie buiten normale werkuren: {{interventiekost}}. Herprogrammatie assortiment: {{herprogrammatie_kost}}. Reiniging bij niet-naleving hygiëne: {{reinigingskost}}.

## Betalingsvoorwaarden

Maandelijkse facturatie. Betaaltermijn {{betaaltermijn_dagen}} dagen na factuurdatum. Bij laattijdige betaling is een verwijlintrest van {{verwijlintrest_percentage}}% per maand verschuldigd, van rechtswege en zonder ingebrekestelling.

MATO Automaat · BTW BE 1027.766.963 · IJzerlaan 13, 8600 Diksmuide
',
  'PDF',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "DocumentTemplate" WHERE code = 'PARTNER_PRIJZEN' AND version = 1
);
