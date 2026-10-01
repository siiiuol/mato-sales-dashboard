INSERT INTO "DocumentTemplate" (
  id, code, name, category, language, version, status, "numberPrefix", body, "outputFormats", "effectiveAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'PARTNER_VOORSTEL',
  'Partnerschapsvoorstel',
  'PARTNERSHIP',
  'nl',
  1,
  'MATO_APPROVED',
  'MATO-PV',
  '# PARTNERSCHAPSVOORSTEL

**Voor:** {{klant_naam}}
**Datum:** {{datum}}

## Over MATO

MATO Automatenshop BV is een 24/7 automatenshop in Diksmuide, gespecialiseerd in de verkoop, verhuur en plaatsing van automaten. Wij bouwen actief samenwerkingen op met lokale en artisanale producenten om hun producten via slimme, toegankelijke verkooppunten aan te bieden — 7 dagen op 7, 24 uur op 24.

## Waarom samenwerken met MATO

Permanente zichtbaarheid: uw producten zijn dag en nacht beschikbaar. Zichtbaar vanaf de straat, op een drukke invalsweg naar het centrum. Geen extra personeelskost: de automaat verkoopt, wij beheren het toestel. Bijkomend verkoopkanaal zonder concurrentie met uw bestaande winkel. Gemiddeld ±75 bezoekers per dag passeren de shop aan IJzerlaan 13, 8600 Diksmuide.

## Ons voorstel voor u

| | |
|---|---|
| Type samenwerking | {{type_samenwerking}} |
| Locatie | {{locatie}} |
| Assortiment | {{assortiment}} |
| Vergoeding / commissie | {{vergoeding}} |
| Duur | {{duur}} |

## Volgende stap

Wij nodigen u graag uit voor een kort gesprek om dit voorstel te bespreken en verder af te stemmen op uw wensen. Bij akkoord stellen wij een samenwerkingsovereenkomst op met de definitieve afspraken.

Interesse? Mail ons met uw assortiment op info@matoautomaat.be — we komen vrijblijvend langs en bekijken samen of het past.

MATO Automaat · BTW BE 1027.766.963
Shop: IJzerlaan 13, 8600 Diksmuide, altijd open, 24/7 toegankelijk
',
  'PDF',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "DocumentTemplate" WHERE code = 'PARTNER_VOORSTEL' AND version = 1
);
