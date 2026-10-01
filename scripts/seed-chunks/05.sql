INSERT INTO "DocumentTemplate" (
  id, code, name, category, language, version, status, "numberPrefix", body, "outputFormats", "effectiveAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'PARTNER_OVEREENKOMST',
  'Samenwerkingsovereenkomst (MATO Base Partner)',
  'PARTNERSHIP',
  'nl',
  1,
  'MATO_APPROVED',
  'MATO-PO',
  '# OVEREENKOMST — MATO BASE PARTNER

**Documentnummer:** {{documentnummer}}
**Datum:** {{datum}}

**De dienstverlener**
BV Mato Automaat
Roeselaarseweg 69, 8820 Torhout
Ondernemingsnummer BE 1027.766.963
IBAN KBC BE54 7350 7301 3197
info@matoautomaat.be · www.matoautomaat.be

**De partner**
{{klant_naam}}
{{klant_adres}}
Ondernemingsnummer: {{klant_ondernemingsnummer}}
Telefoon: {{klant_telefoon}} · E-mail: {{klant_email}}

## 1. Omschrijving

De dienstverlener baat onder de handelsnaam MATO AUTOMATENSHOP een moderne 24/7-automatenwinkel uit, gelegen te IJzerlaan 13, 8600 Diksmuide, waarin maaltijden, voeding, dranken en andere goederen via geautomatiseerde verkoopautomaten worden aangeboden.

De dienstverlener werkt hiervoor samen met zelfstandige partners die hun eigen producten via de MATO AUTOMATENSHOP aanbieden. In het kader van deze overeenkomst stelt de dienstverlener aan de partner één (1) volledige MATO M1-verkoopautomaat ter beschikking voor de verkoop van de producten van de partner.

De automaat blijft te allen tijde eigendom van de dienstverlener. De concrete voorwaarden inzake het gebruik van de automaat, de dienstverlening, vergoedingen en de wederzijdse rechten en verplichtingen van partijen worden in deze overeenkomst vastgelegd.

## 2. Plichten van de dienstverlener

De dienstverlener stelt in de MATO AUTOMATENSHOP één moderne verkoopautomaat ter beschikking voor de verkoop van de producten van de partner, die gedurende de looptijd van deze overeenkomst exclusief ter beschikking staat. De dienstverlener voorziet: het exclusieve gebruik van één (1) volledige MATO M1-verkoopautomaat; een elektronische betaalterminal gekoppeld aan de automaat; een telemetriesysteem voor beheer en opvolging van de verkopen, met inzage voor de partner; een wifi- en/of internetverbinding voor de werking van terminal, telemetrie en andere systemen; het elektriciteitsverbruik van de automaat binnen de shop; het algemene onderhoud en de schoonmaak van de gemeenschappelijke delen van de shop; het technisch onderhoud bij normale slijtage en defecten niet veroorzaakt door de partner of derden; de initiële configuratie bij opstart; de basisbranding (één logo op de automaat, één logo erboven, één sticker met productfoto''s); persoonlijke begeleiding en hulp bij opstart en gebruik; en beveiliging van de winkel via camera''s. Camerabeelden mogen niet gekopieerd, verspreid of aan derden overgemaakt worden.

## 3. Niet inbegrepen

Niet inbegrepen zijn: de transactiekosten verbonden aan het gebruik van de betaalterminal; aankoop, productie, verpakking, etikettering, prijsbepaling, transport, bevoorrading en het verwijderen van onverkochte, beschadigde of vervallen producten; en een noodgenerator bij stroomuitval. De automaat verwerkt geen contant geld — enkel betaalkaart. Er is geen garantie inzake verkoopvolume, omzet, rotatie of winstgevendheid. Extra configuratie na de eerste (inbegrepen) kost € 60 per werkuur excl. btw; extra onderdelen (motoren, spiralen, ...) worden apart aangerekend.

## 4. Plichten van de partner

De partner verbindt zich ertoe de toegewezen automaat voldoende aan te vullen met verse en kwalitatieve producten, waakt over kwaliteit en versheid, en verwijdert tijdig producten uit de automaat. De partner gebruikt automaat en winkel als een voorzichtig en redelijk persoon en houdt alles proper. Defecten, vandalisme of andere problemen worden zo snel mogelijk gemeld.

De partner stelt zich in regel met het FAVV, onder meer: een toelatingsattest van het FAVV voor het aanleveren van producten in automaten, een aanwezige allergenenlijst, een duidelijke en zichtbare houdbaarheidsdatum, de contactgegevens van de partner op de verpakking, en eventuele andere FAVV-verplichtingen.

## 5. Aansprakelijkheid

De dienstverlener is niet aansprakelijk voor omzetverlies, winstderving of andere indirecte schade ten gevolge van overmacht, stroomuitval, internet- of netwerkstoringen, storingen bij betaalproviders of andere omstandigheden buiten haar controle.

De partner blijft volledig verantwoordelijk voor zijn eigen producten — kwaliteit, voedselveiligheid, samenstelling, verpakking, etikettering, allergeneninformatie en houdbaarheid. Schade of aanspraken van derden voortvloeiend uit de producten zijn ten laste van de partner.

Schade of defecten veroorzaakt door foutief gebruik, nalatigheid of ongeoorloofde handelingen van de partner zijn ten laste van de partner. Bij een niet aan de partner toerekenbaar defect meldt de partner dit zo snel mogelijk; de dienstverlener herstelt binnen een redelijke termijn.

Is de automaat door een aan de dienstverlener toerekenbaar defect meer dan 7 opeenvolgende kalenderdagen volledig buiten gebruik, dan is vanaf de 8e dag tot herstel geen vaste maandelijkse vergoeding verschuldigd (pro rata), te rekenen vanaf de melding van het defect.

## 6. Duurtijd van de overeenkomst en kostprijs

Deze overeenkomst wordt gesloten voor een termijn van twaalf (12) maanden en gaat in op {{startdatum}}. Tijdens deze vaste termijn kan de overeenkomst niet voortijdig worden opgezegd, behoudens de gevallen bepaald in artikel 8.

Wenst een partij na afloop van de vaste termijn niet voort te zetten, dan meldt zij dit uiterlijk één (1) maand vóór de einddatum schriftelijk. Bij gebrek aan tijdige opzegging wordt de overeenkomst verlengd voor onbepaalde duur, met een opzegtermijn van één (1) maand. Opzegging gebeurt schriftelijk per aangetekende zending of ondertekend akkoord.

**Kosten:** € 550 vaste vergoeding per maand, excl. btw. Transactiekosten elektronische betalingen (momenteel 0,9%) zijn niet inbegrepen. Facturatie gebeurt maandelijks, betaalbaar binnen 14 kalenderdagen na factuurdatum. Verkoopopbrengsten worden maandelijks afgerekend na aftrek van transactiekosten en andere opeisbare bedragen; de gegevens van het telemetriesysteem en de betaalterminal gelden als referentie.

**Waarborg:** € 1.100 (= 2 maanden vergoeding), te storten vóór ingebruikname op naam van MATO Automaat BV, IBAN BE54 7350 7301 3197, mededeling "Waarborg + naam partner". De waarborg strekt tot zekerheid van de correcte uitvoering van alle verplichtingen van de partner en kan worden aangewend voor openstaande bedragen of schade. Na beëindiging wordt het resterende saldo terugbetaald zodra alle verplichtingen zijn voldaan.

## 7. Eigendom en gebruik van de apparatuur

Automaat, betaalterminal, telemetriesysteem, software, technische configuratie en bijbehorende apparatuur blijven gedurende de volledige looptijd eigendom van de dienstverlener of diens leveranciers. De partner verkrijgt uitsluitend een gebruiksrecht en mag deze goederen niet verkopen, verpanden, verplaatsen, aanpassen, demonteren of door derden laten manipuleren zonder voorafgaande schriftelijke toestemming.

## 8. Opzegging en voortijdige beëindiging

De dienstverlener kan voortijdig beëindigen bij een ernstige of herhaalde tekortkoming door de partner, waaronder: het niet of niet tijdig betalen van facturen of andere bedragen; het niet naleven van deze overeenkomst; structureel onvoldoende bevoorraden van de automaat; het niet waarborgen van kwaliteit, versheid, voedselveiligheid of wettelijke conformiteit; het niet naleven van FAVV- of andere wettelijke verplichtingen; ernstige schade door foutief gebruik, nalatigheid of ongeoorloofde handelingen; ongeoorloofd wijzigen of manipuleren van apparatuur, configuratie of verkoop-/betalingsgegevens; of ander handelen waardoor voortzetting redelijkerwijs niet kan worden verwacht.

Behoudens uiterst ernstige tekortkomingen krijgt de tekortschietende partij eerst een schriftelijke ingebrekestelling met 7 kalenderdagen om te herstellen. Blijft herstel uit, dan kan de overeenkomst voortijdig beëindigd worden, onverminderd het recht op openstaande bedragen en schadevergoeding.

## 9. Automatische beëindiging

De overeenkomst eindigt automatisch wanneer verdere uitvoering definitief onmogelijk wordt: bij definitieve stopzetting van de uitbating op de locatie, definitief wegvallen van de locatie, stopzetting van de activiteiten van de dienstverlener, of overmacht. In deze gevallen is geen schadevergoeding wegens de beëindiging zelf verschuldigd; reeds vervallen bedragen blijven opeisbaar.

## 10. Indexatie van de prijzen

De vergoedingen worden eenmaal per jaar geïndexeerd volgens de gezondheidsindex (aanvangsindex = maand vóór inwerkingtreding; nieuwe index = maand vóór de maand van indexatie).

## 11. Schadevergoeding bij wanprestatie

Bij voortijdige beëindiging wegens ernstige wanprestatie is een forfaitaire schadevergoeding verschuldigd gelijk aan 6 maanden vaste vergoeding, of — indien de resterende initiële termijn korter is — de nog verschuldigde vergoedingen tot einde van die termijn, met dat bedrag als maximum. Dit doet geen afbreuk aan reeds vervallen bedragen, noch aan het recht op vergoeding van bijkomende bewezen schade.

## 12. Geschillenbeslechting

Op deze overeenkomst is uitsluitend het Belgisch recht van toepassing. Partijen trachten geschillen eerst in onderling overleg op te lossen; bij gebreke van een minnelijke oplossing zijn uitsluitend de rechtbanken van het arrondissement West-Vlaanderen, afdeling Veurne, bevoegd.

Gedaan te {{ondertekening_plaats}}, op {{datum}}, in twee originele exemplaren.

| Voor de dienstverlener | Voor de partner |
|---|---|
| BV Mato Automaat | {{klant_naam}} |
| Handtekening: | Handtekening: |
',
  'PDF',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "DocumentTemplate" WHERE code = 'PARTNER_OVEREENKOMST' AND version = 1
);
