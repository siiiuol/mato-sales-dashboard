INSERT INTO "DocumentTemplate" (
  id, code, name, category, language, version, status, "numberPrefix", body, "outputFormats", "effectiveAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'PARTNER_VOORWAARDEN',
  'Algemene voorwaarden (bijlage)',
  'PARTNERSHIP',
  'nl',
  1,
  'MATO_APPROVED',
  'MATO-AV',
  '# ALGEMENE VOORWAARDEN

Bijlage bij de samenwerkingsovereenkomst

Deze algemene voorwaarden maken integraal deel uit van elke samenwerkingsovereenkomst afgesloten met MATO Automatenshop BV, tenzij uitdrukkelijk en schriftelijk anders overeengekomen.

## Art. 1. Toepassingsgebied

Deze voorwaarden zijn van toepassing op alle offertes, voorstellen, overeenkomsten en facturen van MATO Automatenshop BV ("MATO"), met uitsluiting van eventuele eigen voorwaarden van de partner, tenzij MATO daarmee schriftelijk heeft ingestemd.

## Art. 2. Totstandkoming van de overeenkomst

Een samenwerking komt slechts tot stand na ondertekening van een specifieke samenwerkingsovereenkomst door beide partijen. Mondelinge afspraken of voorlopige voorstellen zijn niet bindend.

## Art. 3. Eigendom van de automaat

Tenzij uitdrukkelijk anders overeengekomen, blijft de geplaatste automaat te allen tijde eigendom van MATO. De partner verbindt zich ertoe zorgvuldig om te gaan met het toestel en elke schade onmiddellijk te melden.

## Art. 4. Onderhoud en technische interventies

MATO staat in voor het courante onderhoud en technische herstellingen van de automaat, behoudens schade veroorzaakt door verkeerd gebruik, vandalisme of overmacht, in welk geval de kosten aan de partner kunnen worden doorgerekend.

## Art. 5. Voedselveiligheid en kwaliteit

De partner staat in voor de kwaliteit, conformiteit en houdbaarheid van de producten die via de automaat worden aangeboden, en verbindt zich ertoe alle toepasselijke FAVV- en voedselveiligheidsnormen na te leven.

## Art. 6. Facturatie en betaling

Facturatie gebeurt maandelijks. Facturen zijn betaalbaar binnen de 14 dagen na factuurdatum. Bij laattijdige betaling is van rechtswege en zonder ingebrekestelling een verwijlintrest van 10% per jaar verschuldigd, evenals een forfaitaire schadevergoeding van 10% van het factuurbedrag met een minimum van € 50.

## Art. 7. Duur en opzegging

De duur en opzegtermijn worden vastgelegd in de specifieke samenwerkingsovereenkomst. Bij gebreke van een specifieke bepaling geldt een opzegtermijn van drie maanden, te betekenen per aangetekend schrijven.

## Art. 8. Aansprakelijkheid

MATO is enkel aansprakelijk voor directe schade die het rechtstreeks gevolg is van een zware fout of opzet vanwege MATO. MATO is niet aansprakelijk voor indirecte schade, gevolgschade of omzetderving.

## Art. 9. Overmacht

Onder overmacht wordt onder meer verstaan: technische storingen bij derden, stroomonderbrekingen, natuurrampen, epidemieën, overheidsmaatregelen en stakingen.

## Art. 10. Vertrouwelijkheid

Partijen verbinden zich ertoe de commerciële en financiële voorwaarden van hun samenwerking vertrouwelijk te behandelen en niet aan derden mee te delen zonder voorafgaand schriftelijk akkoord.

## Art. 11. Wijziging van de voorwaarden

MATO behoudt zich het recht voor deze voorwaarden te wijzigen. Wijzigingen worden minstens 30 dagen op voorhand schriftelijk meegedeeld en zijn niet van toepassing op lopende overeenkomsten.

## Art. 12. Toepasselijk recht en bevoegde rechtbank

Op alle overeenkomsten met MATO is uitsluitend het Belgisch recht van toepassing. Enkel de rechtbanken van het gerechtelijk arrondissement West-Vlaanderen, afdeling Veurne, zijn bevoegd.

Versie: {{datum}} — MATO Automatenshop BV, IJzerlaan 13, 8600 Diksmuide.
',
  'PDF',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "DocumentTemplate" WHERE code = 'PARTNER_VOORWAARDEN' AND version = 1
);
