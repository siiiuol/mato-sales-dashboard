INSERT INTO "DocumentTemplate" (
  id, code, name, category, language, version, status, "numberPrefix", body, "outputFormats", "effectiveAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'PARTNER_BEDANKT',
  'Bedankdocument',
  'PARTNERSHIP',
  'nl',
  1,
  'MATO_APPROVED',
  'MATO-BD',
  '# BEDANKT, {{klant_naam}}!

Bedankt voor uw vertrouwen in MATO Automatenshop. Wij kijken ernaar uit om samen met u een mooie samenwerking op te bouwen.

**Samenwerking gestart op:** {{startdatum}}

## Wat mag u van ons verwachten?

Persoonlijke begeleiding bij de opstart van uw automaat. Snelle technische ondersteuning wanneer nodig. Inzage in uw verkoopcijfers via de Televend Cloud. Een aanspreekpunt dat met u meedenkt.

Welkom in de MATO-familie. Heeft u nu al vragen? Aarzel niet om ons te contacteren via info@matoautomaat.be.

MATO Automaat · IJzerlaan 13, 8600 Diksmuide
',
  'PDF',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "DocumentTemplate" WHERE code = 'PARTNER_BEDANKT' AND version = 1
);
