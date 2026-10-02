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
);;

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
);;

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
);;

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
);;

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
);;

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
);;
