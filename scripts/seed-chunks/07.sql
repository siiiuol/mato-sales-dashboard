INSERT INTO "DocumentTemplate" (
  id, code, name, category, language, version, status, "numberPrefix", body, "outputFormats", "effectiveAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'PARTNER_FACTUUR',
  'Factuur',
  'SALES',
  'nl',
  1,
  'MATO_APPROVED',
  'MATO-FACT',
  '# FACTUUR

**Factuurnummer:** {{documentnummer}}
**Factuurdatum:** {{datum}}
**Vervaldatum:** {{factuur_vervaldatum}}

**Factuur van**
MATO Automatenshop BV
IJzerlaan 13, 8600 Diksmuide
BTW BE 1027.766.963
IBAN BE54 7350 7301 3197

**Factuur aan**
{{klant_naam}}
{{klant_adres}}
{{klant_gemeente}}
BTW {{klant_ondernemingsnummer}}

Referentie / locatie: {{factuur_referentie}}

{{product_afbeelding}}

## Factuurlijnen

| Omschrijving | Bedrag |
|---|---|
| {{lijn1_omschrijving}} | {{lijn1_bedrag}} |
| {{lijn2_omschrijving}} | {{lijn2_bedrag}} |
| {{lijn3_omschrijving}} | {{lijn3_bedrag}} |
| **Subtotaal (excl. btw)** | {{subtotaal}} |
| **Btw (21%)** | {{btw_bedrag}} |
| **Totaal te betalen** | **{{totaal}}** |

## Betaalgegevens

Op naam van MATO Automatenshop BV. Gelieve te betalen binnen de {{betaaltermijn_dagen}} dagen na factuurdatum. Bij laattijdige betaling is een verwijlintrest van {{verwijlintrest_percentage}}% per maand verschuldigd, van rechtswege en zonder ingebrekestelling.

IBAN: BE54 7350 7301 3197 · Mededeling: {{documentnummer}}
',
  'PDF',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "DocumentTemplate" WHERE code = 'PARTNER_FACTUUR' AND version = 1
);
