INSERT INTO "DocumentTemplate" (
  id, code, name, category, language, version, status, "numberPrefix", body, "outputFormats", "effectiveAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'PARTNER_LEVERINGSGIDS',
  'Leveringsgids',
  'PARTNERSHIP',
  'nl',
  1,
  'MATO_APPROVED',
  'MATO-LEV',
  '# LEVERINGSGIDS

Alles wat u moet weten over bevoorrading van uw automaat

**Documentnummer:** {{documentnummer}} · **Datum:** {{datum}}

Aanbevolen ritme: 2-3× bevoorrading per week, afhankelijk van uw assortiment.

## 1. Wanneer bevoorraden

Bevoorraad regelmatig genoeg om lege vakken te vermijden, maar niet zoveel dat producten hun THT-datum naderen in de automaat. Controleer bij elk bezoek de volledige voorraad, ook de minder populaire producten.

## 2. Verpakkingseisen

Verpakking is volledig gesloten en geschikt voor het liftsysteem van de automaat. Etiket met duidelijke productnaam, ingrediënten en allergenen. THT- of houdbaarheidsdatum goed zichtbaar voor de koper. Contactgegevens van de partner op de verpakking. Afmetingen passen binnen het vak van de automaat (max. {{vakafmetingen}}).

## 3. Aanleveren bij de shop

Shop 24/7 toegankelijk, adres IJzerlaan 13, 8600 Diksmuide. Kort parkeren voor de deur, leveringstijd ±10-15 min.

## 4. Onverkochte of vervallen producten

Verwijder producten tijdig vóór het verstrijken van de THT-datum. Onverkochte of beschadigde producten worden door de partner zelf verwijderd en verwerkt — dit valt niet onder de dienstverlening van MATO.

## 5. Checklist bij elk bezoek

Alle vakken aangevuld en THT-datums gecontroleerd. Automaat en omgeving proper achtergelaten. Eventuele defecten of schade gemeld aan MATO.

Vragen over levering? Neem contact op via info@matoautomaat.be.
',
  'PDF',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "DocumentTemplate" WHERE code = 'PARTNER_LEVERINGSGIDS' AND version = 1
);
