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
);
