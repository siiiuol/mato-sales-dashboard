INSERT INTO "DocumentTemplate" (
  id, code, name, category, language, version, status, "numberPrefix", body, "outputFormats", "effectiveAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'PARTNER_FEEDBACK',
  'Feedbackformulier',
  'PARTNERSHIP',
  'nl',
  1,
  'MATO_APPROVED',
  'MATO-FB',
  '# FEEDBACKFORMULIER

Partner: {{klant_naam}} · Samenwerking sinds: {{samenwerking_sinds}}
**Documentnummer:** {{documentnummer}} · **Datum:** {{datum}}

Wij willen onze samenwerking graag blijven verbeteren. Neem 5 minuten om dit formulier in te vullen — uw feedback helpt ons om MATO nog beter te maken.

## 1. Hoe tevreden bent u over...

| | Ontevreden | Matig | Neutraal | Goed | Uitstekend |
|---|---|---|---|---|---|
| De werking en betrouwbaarheid van de automaat | ☐ | ☐ | ☐ | ☐ | ☐ |
| Het onderhoud en de technische ondersteuning | ☐ | ☐ | ☐ | ☐ | ☐ |
| De communicatie met MATO | ☐ | ☐ | ☐ | ☐ | ☐ |
| De duidelijkheid van rapportering / verkoopcijfers | ☐ | ☐ | ☐ | ☐ | ☐ |
| Uw algemene ervaring als MATO-partner | ☐ | ☐ | ☐ | ☐ | ☐ |

## 2. In eigen woorden

Wat loopt goed in de samenwerking?

Wat kan beter?

Zou u MATO aanbevelen aan andere producenten?

Bedankt voor uw tijd — uw feedback wordt gelezen. U kan dit formulier terugsturen naar info@matoautomaat.be, of bespreken bij ons volgende bezoek.
',
  'PDF',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "DocumentTemplate" WHERE code = 'PARTNER_FEEDBACK' AND version = 1
);
