INSERT INTO "DocumentTemplate" (
  id, code, name, category, language, version, status, "numberPrefix", body, "outputFormats", "effectiveAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'VERKOOP',
  'Verkoopovereenkomst',
  'SALES',
  'nl',
  1,
  'MATO_APPROVED',
  'MATO-VK',
  '# VERKOOPOVEREENKOMST

**Documentnummer:** {{documentnummer}}
**Datum:** {{datum}}

## 1. Partijen

**Verkoper**
{{verkoper_naam}}
{{verkoper_adres}}
BTW {{verkoper_btw}}

**Koper**
{{klant_naam}}
{{klant_adres}}
{{klant_gemeente}}
Telefoon: {{klant_telefoon}}
BTW: {{klant_btw}}

## 2. Voorwerp van de overeenkomst

De verkoper verkoopt aan de koper:

| Omschrijving | Aantal | Prijs excl. btw |
|---|---|---|
| {{artikel_naam}} | {{aantal}} | {{prijs_excl}} |

{{product_afbeelding}}

{{artikel_omschrijving}}

## 3. Prijs

| | |
|---|---|
| Totaal excl. btw | {{prijs_excl}} |
| Btw {{btw_percentage}} | {{btw_bedrag}} |
| **Totaal incl. btw** | **{{prijs_incl}}** |

## 4. Betaling

Betaling gebeurt als volgt: {{betalingsvoorwaarden}}

Bij laattijdige betaling is van rechtswege en zonder ingebrekestelling een
verwijlintrest verschuldigd conform de wet van 2 augustus 2002 betreffende de
bestrijding van de betalingsachterstand bij handelstransacties.

## 5. Levering en plaatsing

Plaats van levering: {{leveringsadres}}
Voorziene leveringstermijn: {{levertermijn}}

De koper zorgt voor een geschikte, droge en beveiligde opstelplaats met een
werkende stroomaansluiting. Aansluitingskosten zijn niet in de prijs begrepen
tenzij uitdrukkelijk anders vermeld.

## 6. Eigendomsvoorbehoud

De geleverde goederen blijven eigendom van de verkoper tot de volledige prijs,
inclusief eventuele intresten en kosten, betaald is. Het risico gaat wel over op
de koper vanaf de levering.

## 7. Garantie

De verkoper waarborgt de goede werking gedurende {{garantie}} vanaf de levering.
De waarborg dekt geen schade door verkeerd gebruik, ingrepen door derden of
overmacht.

## 8. Toepasselijk recht

Op deze overeenkomst is het Belgisch recht van toepassing. Geschillen behoren
tot de bevoegdheid van de rechtbanken van het arrondissement van de zetel van de
verkoper.

## 9. Handtekeningen

Opgemaakt te {{plaats}} op {{datum}}, in twee exemplaren, waarvan elke partij
erkent er één ontvangen te hebben.

| Voor de verkoper | Voor de koper |
|---|---|
| {{verkoper_naam}} | {{klant_naam}} |
| Vertegenwoordigd door **{{verkoper_medewerker}}** | Naam: ............................. |
| Handtekening: | Handtekening: |
| | |
| | |

*Dossierbeheerder: {{verkoper_medewerker}}*
',
  'PDF',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "DocumentTemplate" WHERE code = 'VERKOOP' AND version = 1
);;

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
);;

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
);;

INSERT INTO "DocumentTemplate" (
  id, code, name, category, language, version, status, "numberPrefix", body, "outputFormats", "effectiveAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'PARTNER_PRIJZEN',
  'Prijzen- en voorwaardenblad',
  'PARTNERSHIP',
  'nl',
  1,
  'MATO_APPROVED',
  'MATO-PP',
  '# PRIJZEN- EN VOORWAARDENBLAD

Geldig vanaf {{datum}} · alle bedragen excl. btw
**Documentnummer:** {{documentnummer}}

## 1. Verkoop van een automaat

Aankoopprijs: {{automaat_aankoopprijs}}. Levering & installatie: {{levering_installatie}}. Garantie: {{garantieperiode}}. Onderhoudscontract (optioneel): {{onderhoudscontract_bedrag}} per maand.

## 2. Huur van shopruimte

Vaste prijs per maand: {{shophuur_bedrag}}. Waarborg: {{shophuur_waarborg}}, terugbetaalbaar. Opzegtermijn: {{shophuur_opzegtermijn}}.

## 3. Externe plaatsing / rental

| Formule | Omschrijving |
|---|---|
| A — Vaste huur | {{rental_vaste_huur}} per maand, ongeacht omzet |
| B — Commissie | {{rental_commissie_percentage}}% van omzet, geen vaste kost |
| C — Combinatie | Vast {{rental_vast_bedrag}} + {{rental_combi_commissie}}% commissie |

## 4. Bijkomende kosten

Transport bij verplaatsing automaat: {{transportkost}}. Interventie buiten normale werkuren: {{interventiekost}}. Herprogrammatie assortiment: {{herprogrammatie_kost}}. Reiniging bij niet-naleving hygiëne: {{reinigingskost}}.

## Betalingsvoorwaarden

Maandelijkse facturatie. Betaaltermijn {{betaaltermijn_dagen}} dagen na factuurdatum. Bij laattijdige betaling is een verwijlintrest van {{verwijlintrest_percentage}}% per maand verschuldigd, van rechtswege en zonder ingebrekestelling.

MATO Automaat · BTW BE 1027.766.963 · IJzerlaan 13, 8600 Diksmuide
',
  'PDF',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "DocumentTemplate" WHERE code = 'PARTNER_PRIJZEN' AND version = 1
);;

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
);;

INSERT INTO "DocumentTemplate" (
  id, code, name, category, language, version, status, "numberPrefix", body, "outputFormats", "effectiveAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'PARTNER_INTAKE',
  'Onboarding intakeformulier',
  'PARTNERSHIP',
  'nl',
  1,
  'MATO_APPROVED',
  'MATO-INT',
  '# INTAKEFORMULIER — NIEUWE PARTNER

In te vullen bij opstart van een nieuwe samenwerking.

**Documentnummer:** {{documentnummer}}
**Datum:** {{datum}}

## 1. Bedrijfsgegevens partner

| | |
|---|---|
| Bedrijfsnaam | {{klant_naam}} |
| Ondernemingsnummer (btw) | {{klant_ondernemingsnummer}} |
| Adres maatschappelijke zetel | {{klant_adres}} |
| Contactpersoon | {{klant_contactpersoon}} |
| Telefoonnummer | {{klant_telefoon}} |
| E-mailadres | {{klant_email}} |

## 2. Locatiegegevens verkooppunt

| | |
|---|---|
| Adres locatie | {{locatie_adres}} |
| Type locatie | {{locatie_type}} |
| Openingsuren | {{openingsuren}} |
| Parkeermogelijkheid voor levering | {{parkeermogelijkheid}} |

## 3. Technische vereisten

| Vereiste | Gecontroleerd |
|---|---|
| Elektriciteitsaansluiting aanwezig (220V, apart stopcontact) | {{elektriciteit_aanwezig}} |
| Voldoende ruimte voor plaatsing | {{ruimte_voldoende}} |
| Vlakke, stabiele ondergrond | {{ondergrond_stabiel}} |
| Internet-/gsm-bereik voor betaalterminal gecontroleerd | {{internet_bereik}} |

Afmetingen beschikbare ruimte: {{afmetingen_ruimte}}. Type automaat gewenst: {{type_automaat_gewenst}}.

## 4. Assortiment

Gewenste producten: {{gewenste_producten}}. Bewaartemperatuur: {{bewaartemperatuur}}. Houdbaarheid / THT-termijn: {{houdbaarheid_termijn}}.

## 5. Samenwerkingsvorm

{{samenwerkingsvorm}}

## Ingevuld door

{{ingevuld_door}} (MATO) — {{datum}}
',
  'PDF',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "DocumentTemplate" WHERE code = 'PARTNER_INTAKE' AND version = 1
);;
