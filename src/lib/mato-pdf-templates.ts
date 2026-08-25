/**
 * Officiële MATO PDF-sjablonen (bron: matotemplates1x/2x.zip) + koppeling naar
 * invulbare CRM-sjablonen (`PARTNER_*` in partner-templates.ts).
 */

export type MatoPdfTemplate = {
  id: string;
  order: number;
  file: string;
  title: string;
  /** partner | sales | ops | legal */
  pack: "partner" | "sales" | "ops" | "legal";
  summary: string;
  /** Koop / huur / beide — voor Assistent-filter */
  dealFit: "koop" | "huur" | "beide" | "intern";
  /** Code in DocumentTemplate / partner-templates */
  templateCode: string;
};

export const MATO_PDF_TEMPLATES: MatoPdfTemplate[] = [
  {
    id: "partnerschapsvoorstel",
    order: 1,
    file: "1_Partnerschapsvoorstel.pdf",
    title: "Partnerschapsvoorstel",
    pack: "partner",
    summary: "Voorstel voor producenten / partners die via MATO verkopen.",
    dealFit: "huur",
    templateCode: "PARTNER_VOORSTEL",
  },
  {
    id: "samenwerkingsovereenkomst",
    order: 2,
    file: "2_Samenwerkingsovereenkomst.pdf",
    title: "Samenwerkingsovereenkomst",
    pack: "partner",
    summary: "Overeenkomst na akkoord op partnerschap.",
    dealFit: "huur",
    templateCode: "PARTNER_OVEREENKOMST",
  },
  {
    id: "prijzen-voorwaarden",
    order: 3,
    file: "3_Prijzen_en_voorwaardenblad.pdf",
    title: "Prijzen en voorwaardenblad",
    pack: "sales",
    summary: "Prijzen en voorwaarden om mee te geven bij een gesprek.",
    dealFit: "beide",
    templateCode: "PARTNER_PRIJZEN",
  },
  {
    id: "factuur",
    order: 4,
    file: "4_Factuur.pdf",
    title: "Factuur",
    pack: "sales",
    summary: "Factuursjabloon.",
    dealFit: "koop",
    templateCode: "PARTNER_FACTUUR",
  },
  {
    id: "onboarding-intake",
    order: 5,
    file: "5_Onboarding_intakeformulier.pdf",
    title: "Onboarding-intakeformulier",
    pack: "ops",
    summary: "Gegevens ophalen bij start van een samenwerking of plaatsing.",
    dealFit: "beide",
    templateCode: "PARTNER_INTAKE",
  },
  {
    id: "algemene-voorwaarden",
    order: 6,
    file: "6_Algemene_voorwaarden.pdf",
    title: "Algemene voorwaarden",
    pack: "legal",
    summary: "Algemene voorwaarden MATO.",
    dealFit: "beide",
    templateCode: "PARTNER_VOORWAARDEN",
  },
  {
    id: "welkomst",
    order: 7,
    file: "7_Welkomstdocument.pdf",
    title: "Welkomstdocument",
    pack: "ops",
    summary: "Welkom na close — eerste contact na akkoord.",
    dealFit: "beide",
    templateCode: "PARTNER_WELKOM",
  },
  {
    id: "leveringsgids",
    order: 8,
    file: "8_Leveringsgids.pdf",
    title: "Leveringsgids",
    pack: "ops",
    summary: "Praktische gids bij levering / plaatsing.",
    dealFit: "beide",
    templateCode: "PARTNER_LEVERINGSGIDS",
  },
  {
    id: "maandelijks-rapport",
    order: 9,
    file: "9_Maandelijks_rapport.pdf",
    title: "Maandelijks rapport",
    pack: "ops",
    summary: "Maandrapportage (bv. bij huur/commissie).",
    dealFit: "huur",
    templateCode: "PARTNER_MAANDRAPPORT",
  },
  {
    id: "feedback",
    order: 10,
    file: "10_Feedbackformulier.pdf",
    title: "Feedbackformulier",
    pack: "ops",
    summary: "Feedback na plaatsing of samenwerking.",
    dealFit: "beide",
    templateCode: "PARTNER_FEEDBACK",
  },
  {
    id: "bedank",
    order: 11,
    file: "11_Bedankdocument.pdf",
    title: "Bedankdocument",
    pack: "ops",
    summary: "Bedanking / afronding.",
    dealFit: "beide",
    templateCode: "PARTNER_BEDANKT",
  },
];

export const MATO_PDF_BASE = "/templates/mato";

export function matoPdfHref(file: string) {
  return `${MATO_PDF_BASE}/${encodeURIComponent(file)}`;
}

export function matoPdfByCode(code: string) {
  return MATO_PDF_TEMPLATES.find((t) => t.templateCode === code);
}

export function matoPdfById(id: string) {
  return MATO_PDF_TEMPLATES.find((t) => t.id === id);
}

export const MATO_PDF_PACK_LABELS: Record<MatoPdfTemplate["pack"], string> = {
  partner: "Partnerschap",
  sales: "Verkoop",
  ops: "Opstart & opvolging",
  legal: "Juridisch",
};

/** Veldlabels voor het invulformulier (fallback: humanize). */
export const MATO_FIELD_LABELS: Record<string, string> = {
  klant_naam: "Naam partner / bedrijf",
  klant_adres: "Adres partner",
  klant_gemeente: "Postcode / gemeente",
  klant_ondernemingsnummer: "Ondernemingsnummer (btw)",
  klant_telefoon: "Telefoon",
  klant_email: "E-mail",
  klant_contactpersoon: "Contactpersoon",
  type_samenwerking: "Type samenwerking",
  locatie: "Locatie / adres verkooppunt",
  assortiment: "Assortiment",
  vergoeding: "Vergoeding / commissie",
  duur: "Duur (start – opzeg)",
  startdatum: "Startdatum",
  ondertekening_plaats: "Plaats van ondertekening",
  automaat_aankoopprijs: "Aankoopprijs automaat",
  levering_installatie: "Levering & installatie",
  garantieperiode: "Garantie",
  onderhoudscontract_bedrag: "Onderhoudscontract (€/maand)",
  shophuur_bedrag: "Shophuur (€/maand)",
  shophuur_waarborg: "Waarborg",
  shophuur_opzegtermijn: "Opzegtermijn shophuur",
  rental_vaste_huur: "Formule A — vaste huur (€/maand)",
  rental_commissie_percentage: "Formule B — commissie (%)",
  rental_vast_bedrag: "Formule C — vast deel (€)",
  rental_combi_commissie: "Formule C — commissie (%)",
  transportkost: "Transportkost",
  interventiekost: "Interventiekost",
  herprogrammatie_kost: "Herprogrammatie",
  reinigingskost: "Reinigingskost",
  betaaltermijn_dagen: "Betaaltermijn (dagen)",
  verwijlintrest_percentage: "Verwijlintrest (%/maand)",
  factuur_vervaldatum: "Vervaldatum factuur",
  factuur_referentie: "Referentie / locatie",
  lijn1_omschrijving: "Lijn 1 — omschrijving",
  lijn1_bedrag: "Lijn 1 — bedrag",
  lijn2_omschrijving: "Lijn 2 — omschrijving",
  lijn2_bedrag: "Lijn 2 — bedrag",
  lijn3_omschrijving: "Lijn 3 — omschrijving",
  lijn3_bedrag: "Lijn 3 — bedrag",
  subtotaal: "Subtotaal excl. btw",
  btw_bedrag: "Btw 21%",
  totaal: "Totaal te betalen",
  locatie_adres: "Adres locatie",
  locatie_type: "Type locatie",
  openingsuren: "Openingsuren",
  parkeermogelijkheid: "Parkeermogelijkheid",
  elektriciteit_aanwezig: "Elektriciteit aanwezig",
  ruimte_voldoende: "Ruimte voldoende",
  ondergrond_stabiel: "Ondergrond stabiel",
  internet_bereik: "Internet-/gsm-bereik",
  afmetingen_ruimte: "Afmetingen beschikbare ruimte",
  type_automaat_gewenst: "Type automaat gewenst",
  gewenste_producten: "Gewenste producten",
  bewaartemperatuur: "Bewaartemperatuur",
  houdbaarheid_termijn: "Houdbaarheid / THT",
  samenwerkingsvorm: "Samenwerkingsvorm",
  ingevuld_door: "Ingevuld door (MATO)",
  televend_link: "Televend / rapportagelink",
  technisch_telefoon: "Technisch telefoonnummer",
  technisch_uren: "Technisch bereikbaar (uren)",
  vakafmetingen: "Max. vakafmetingen",
  rapport_periode: "Periode (maand / jaar)",
  totale_omzet: "Totale omzet",
  aantal_verkopen: "Aantal verkopen",
  gemiddelde_per_dag: "Gemiddelde per dag",
  week1_aantal: "Week 1 — aantal",
  week1_omzet: "Week 1 — omzet",
  week2_aantal: "Week 2 — aantal",
  week2_omzet: "Week 2 — omzet",
  week2_verschil: "Week 2 — t.o.v. vorige",
  week3_aantal: "Week 3 — aantal",
  week3_omzet: "Week 3 — omzet",
  week3_verschil: "Week 3 — t.o.v. vorige",
  week4_aantal: "Week 4 — aantal",
  week4_omzet: "Week 4 — omzet",
  week4_verschil: "Week 4 — t.o.v. vorige",
  top_product_1: "Best verkocht 1",
  top_product_2: "Best verkocht 2",
  top_product_3: "Best verkocht 3",
  top_product_4: "Best verkocht 4",
  opmerkingen: "Opmerkingen & aanbevelingen",
  samenwerking_sinds: "Samenwerking sinds",
};
