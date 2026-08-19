/**
 * Documentsjablonen voor de MATO Automatenshop-partnerrelatie: producenten die
 * zelf hun producten via een automaat in de shop (of extern) verkopen, tegen
 * huur/commissie — een ander soort relatie dan de Klanten-flow (MATO plaatst
 * eigen automaten bij een klant). Aangeleverd door de eigenaar als PDF's,
 * hier omgezet naar sjablonen met `{{plaatshouders}}` voor het bestaande
 * documentsysteem.
 *
 * Staan in code zodat versiebeheer volgt, en worden bij het seeden naar
 * `DocumentTemplate` geschreven als DRAFT — bewust niet meteen actief, zodat
 * er eerst een blik op geworpen wordt bij Instellingen → Documentsjablonen
 * voor het geactiveerd wordt.
 *
 * LET OP: het contract (PARTNER_OVEREENKOMST) en de algemene voorwaarden
 * (PARTNER_VOORWAARDEN) zijn werkbare handelsdocumenten, geen juridisch
 * nagekeken tekst. Laat ze door een jurist bekijken voordat er een
 * handtekening onder komt.
 */

export type PartnerTemplateDef = {
  code: string;
  prefix: string;
  name: string;
  category: string;
  body: string;
};

export const PARTNER_TEMPLATES: PartnerTemplateDef[] = [
  {
    code: "PARTNER_VOORSTEL",
    prefix: "MATO-PV",
    name: "Partnerschapsvoorstel",
    category: "PARTNERSHIP",
    body: `# PARTNERSCHAPSVOORSTEL

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
`,
  },
  {
    code: "PARTNER_OVEREENKOMST",
    prefix: "MATO-PO",
    name: "Samenwerkingsovereenkomst (MATO Base Partner)",
    category: "PARTNERSHIP",
    body: `# OVEREENKOMST — MATO BASE PARTNER

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

De dienstverlener stelt in de MATO AUTOMATENSHOP één moderne verkoopautomaat ter beschikking voor de verkoop van de producten van de partner, die gedurende de looptijd van deze overeenkomst exclusief ter beschikking staat. De dienstverlener voorziet: het exclusieve gebruik van één (1) volledige MATO M1-verkoopautomaat; een elektronische betaalterminal gekoppeld aan de automaat; een telemetriesysteem voor beheer en opvolging van de verkopen, met inzage voor de partner; een wifi- en/of internetverbinding voor de werking van terminal, telemetrie en andere systemen; het elektriciteitsverbruik van de automaat binnen de shop; het algemene onderhoud en de schoonmaak van de gemeenschappelijke delen van de shop; het technisch onderhoud bij normale slijtage en defecten niet veroorzaakt door de partner of derden; de initiële configuratie bij opstart; de basisbranding (één logo op de automaat, één logo erboven, één sticker met productfoto's); persoonlijke begeleiding en hulp bij opstart en gebruik; en beveiliging van de winkel via camera's. Camerabeelden mogen niet gekopieerd, verspreid of aan derden overgemaakt worden.

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
`,
  },
  {
    code: "PARTNER_PRIJZEN",
    prefix: "MATO-PP",
    name: "Prijzen- en voorwaardenblad",
    category: "PARTNERSHIP",
    body: `# PRIJZEN- EN VOORWAARDENBLAD

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
`,
  },
  {
    code: "PARTNER_FACTUUR",
    prefix: "MATO-FACT",
    name: "Factuur",
    category: "SALES",
    body: `# FACTUUR

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
`,
  },
  {
    code: "PARTNER_INTAKE",
    prefix: "MATO-INT",
    name: "Onboarding intakeformulier",
    category: "PARTNERSHIP",
    body: `# INTAKEFORMULIER — NIEUWE PARTNER

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
`,
  },
  {
    code: "PARTNER_VOORWAARDEN",
    prefix: "MATO-AV",
    name: "Algemene voorwaarden (bijlage)",
    category: "PARTNERSHIP",
    body: `# ALGEMENE VOORWAARDEN

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
`,
  },
  {
    code: "PARTNER_WELKOM",
    prefix: "MATO-WELK",
    name: "Welkomstdocument",
    category: "PARTNERSHIP",
    body: `# WELKOM BIJ MATO

## Welkom, {{klant_naam}}!

Uw samenwerking gaat van start op {{startdatum}}.

**Uw automaat:** MATO M1, IJzerlaan 13, 8600 Diksmuide

## 1. Wat nu?

Wij plannen de installatie en initiële configuratie van uw automaat. U ontvangt toegang tot de Televend Cloud voor inzage in uw verkoopgegevens: {{televend_link}}. Wij brengen de afgesproken basisbranding aan (logo + productfoto's). Zodra alles klaar staat, kan u starten met de eerste bevoorrading.

## 2. Uw eerste bevoorrading

Zorg dat uw producten voldoen aan de FAVV-vereisten (toelatingsattest, allergenenlijst, duidelijke THT-datum). Meer details vindt u in onze Leveringsgids. Neem gerust contact op als u vragen heeft over verpakking of aanlevering.

## 3. Bij problemen of defecten

Technisch probleem: meld via info@matoautomaat.be, reactietermijn binnen 24u. Dringende vragen: telefoon {{technisch_telefoon}}, bereikbaar {{technisch_uren}}.

## 4. Handige links

Televend Cloud (verkoopdata & rapportering): {{televend_link}}. Onze algemene voorwaarden en samenwerkingsovereenkomst zitten bijgevoegd bij deze map.

Welkom in de MATO-familie. Heeft u vragen tijdens de opstart? Wij staan voor u klaar op info@matoautomaat.be.
`,
  },
  {
    code: "PARTNER_LEVERINGSGIDS",
    prefix: "MATO-LEV",
    name: "Leveringsgids",
    category: "PARTNERSHIP",
    body: `# LEVERINGSGIDS

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
`,
  },
  {
    code: "PARTNER_MAANDRAPPORT",
    prefix: "MATO-MR",
    name: "Maandelijks rapport",
    category: "PARTNERSHIP",
    body: `# MAANDELIJKS RAPPORT

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
`,
  },
  {
    code: "PARTNER_FEEDBACK",
    prefix: "MATO-FB",
    name: "Feedbackformulier",
    category: "PARTNERSHIP",
    body: `# FEEDBACKFORMULIER

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
`,
  },
  {
    code: "PARTNER_BEDANKT",
    prefix: "MATO-BD",
    name: "Bedankdocument",
    category: "PARTNERSHIP",
    body: `# BEDANKT, {{klant_naam}}!

Bedankt voor uw vertrouwen in MATO Automatenshop. Wij kijken ernaar uit om samen met u een mooie samenwerking op te bouwen.

**Samenwerking gestart op:** {{startdatum}}

## Wat mag u van ons verwachten?

Persoonlijke begeleiding bij de opstart van uw automaat. Snelle technische ondersteuning wanneer nodig. Inzage in uw verkoopcijfers via de Televend Cloud. Een aanspreekpunt dat met u meedenkt.

Welkom in de MATO-familie. Heeft u nu al vragen? Aarzel niet om ons te contacteren via info@matoautomaat.be.

MATO Automaat · IJzerlaan 13, 8600 Diksmuide
`,
  },
];
