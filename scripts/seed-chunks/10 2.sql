INSERT INTO "DocumentTemplate" (
  id, code, name, category, language, version, status, "numberPrefix", body, "outputFormats", "effectiveAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'PARTNER_WELKOM',
  'Welkomstdocument',
  'PARTNERSHIP',
  'nl',
  1,
  'MATO_APPROVED',
  'MATO-WELK',
  '# WELKOM BIJ MATO

## Welkom, {{klant_naam}}!

Uw samenwerking gaat van start op {{startdatum}}.

**Uw automaat:** MATO M1, IJzerlaan 13, 8600 Diksmuide

## 1. Wat nu?

Wij plannen de installatie en initiële configuratie van uw automaat. U ontvangt toegang tot de Televend Cloud voor inzage in uw verkoopgegevens: {{televend_link}}. Wij brengen de afgesproken basisbranding aan (logo + productfoto''s). Zodra alles klaar staat, kan u starten met de eerste bevoorrading.

## 2. Uw eerste bevoorrading

Zorg dat uw producten voldoen aan de FAVV-vereisten (toelatingsattest, allergenenlijst, duidelijke THT-datum). Meer details vindt u in onze Leveringsgids. Neem gerust contact op als u vragen heeft over verpakking of aanlevering.

## 3. Bij problemen of defecten

Technisch probleem: meld via info@matoautomaat.be, reactietermijn binnen 24u. Dringende vragen: telefoon {{technisch_telefoon}}, bereikbaar {{technisch_uren}}.

## 4. Handige links

Televend Cloud (verkoopdata & rapportering): {{televend_link}}. Onze algemene voorwaarden en samenwerkingsovereenkomst zitten bijgevoegd bij deze map.

Welkom in de MATO-familie. Heeft u vragen tijdens de opstart? Wij staan voor u klaar op info@matoautomaat.be.
',
  'PDF',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "DocumentTemplate" WHERE code = 'PARTNER_WELKOM' AND version = 1
);
