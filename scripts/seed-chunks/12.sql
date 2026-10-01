INSERT INTO "DocumentTemplate" (
  id, code, name, category, language, version, status, "numberPrefix", body, "outputFormats", "effectiveAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'PARTNER_MAANDRAPPORT',
  'Maandelijks rapport',
  'PARTNERSHIP',
  'nl',
  1,
  'MATO_APPROVED',
  'MATO-MR',
  '# MAANDELIJKS RAPPORT

Partner: {{klant_naam}} · Periode: {{rapport_periode}}
**Documentnummer:** {{documentnummer}}

| | |
|---|---|
| Totale omzet | {{totale_omzet}} |
| Aantal verkopen | {{aantal_verkopen}} |
| Gem. per dag | {{gemiddelde_per_dag}} |

## 1. Verkoop per week

| Week | Aantal verkopen | Omzet | T.o.v. vorige week |
|---|---|---|---|
| Week 1 | {{week1_aantal}} | {{week1_omzet}} | — |
| Week 2 | {{week2_aantal}} | {{week2_omzet}} | {{week2_verschil}} |
| Week 3 | {{week3_aantal}} | {{week3_omzet}} | {{week3_verschil}} |
| Week 4 | {{week4_aantal}} | {{week4_omzet}} | {{week4_verschil}} |

## 2. Best verkochte producten

{{top_product_1}}. {{top_product_2}}. {{top_product_3}}. {{top_product_4}}.

## 3. Opmerkingen & aanbevelingen

{{opmerkingen}}

De cijfers zijn gebaseerd op het telemetriesysteem en de betaalterminal van uw automaat. Vragen over dit rapport? Neem gerust contact op via info@matoautomaat.be.
',
  'PDF',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "DocumentTemplate" WHERE code = 'PARTNER_MAANDRAPPORT' AND version = 1
);
