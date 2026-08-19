/**
 * De secties van MATO OS.
 *
 * Verkoop is de terugval en heeft daarom geen voorvoegsel: alles wat geen
 * andere sectie opeist hoort daar. Dat is niet uit gemakzucht — het is de
 * eerlijke vorm. Verkoop is de app; de secties die erbij komen zijn de gasten,
 * en die dragen hun eigen voorvoegsel.
 *
 * Een derde sectie toevoegen is één object hier, één map onder `src/app`, en de
 * gebruikelijke bewaking op elke pagina. Verder niets.
 */
export const SECTIONS = [
  {
    key: "verkoop",
    label: "Verkoop",
    home: "/",
    prefix: null,
    nav: [
      { href: "/", label: "Mijn leads" },
      { href: "/leads", label: "Leads" },
      { href: "/taken", label: "Mijn taken" },
    ],
  },
  {
    key: "reclame",
    label: "Reclame",
    home: "/reclame",
    prefix: "/reclame",
    nav: [
      { href: "/reclame", label: "Campagnes" },
      { href: "/reclame/materiaal", label: "Materiaal" },
      { href: "/reclame/merk", label: "Merk" },
    ],
  },
  {
    key: "klanten",
    label: "Klanten",
    home: "/klanten",
    prefix: "/klanten",
    nav: [
      { href: "/klanten", label: "Klanten" },
      { href: "/taken", label: "Mijn taken" },
    ],
  },
] as const;

/**
 * Team en Instellingen horen bij geen enkele sectie — ze gelden voor het hele
 * platform en staan in elke sectie achteraan.
 *
 * Alleen zichtbaar voor de beheerder. De echte afscherming staat in
 * `requirePageUser` op de pagina's zelf; dit bepaalt enkel wat er in de balk
 * verschijnt.
 */
export const PLATFORM_ADMIN_NAV = [
  { href: "/team", label: "Team" },
  { href: "/settings", label: "Instellingen" },
] as const;

const SECTION_HOMES = new Set<string>(SECTIONS.map((s) => s.home));

/** In welke sectie een pad valt. Afleiden is goedkoper dan onthouden. */
export function sectionFor(pathname: string) {
  return (
    SECTIONS.find(
      (s) => s.prefix && (pathname === s.prefix || pathname.startsWith(`${s.prefix}/`))
    ) ?? SECTIONS[0]
  );
}

/**
 * Of een link de voorpagina van een sectie is.
 *
 * Die moet exact overeenkomen om op te lichten; de rest mag op het begin van
 * het pad matchen. Anders blijft "Campagnes" branden terwijl je op
 * /reclame/materiaal staat.
 */
export function isSectionHome(href: string) {
  return SECTION_HOMES.has(href);
}

/** Rollen zoals ze op het scherm heten. In de database blijven ze Engels. */
export const ROLE_LABELS: Record<string, string> = {
  admin: "Beheerder",
  sales: "Verkoop",
  reviewer: "Meelezer",
};

export function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

export const COMMISSION_TYPE_LABELS: Record<string, string> = {
  PERCENT: "Percentage van de verkoop",
  FIXED: "Vast bedrag per verkoop",
};

/** Hoe je iemand hebt bereikt — niet alleen bellen. */
export const CONTACT_TYPES = [
  { value: "CALL", label: "Gebeld" },
  { value: "EMAIL", label: "Gemaild" },
  { value: "VISIT", label: "Bezocht" },
  { value: "NOTE", label: "Notitie" },
] as const;

export type ContactType = (typeof CONTACT_TYPES)[number]["value"];

export function contactTypeLabel(type: string) {
  return CONTACT_TYPES.find((t) => t.value === type)?.label ?? type;
}

/**
 * Wat er standaard doorzocht wordt — de enige echte lijst.
 *
 * Stond eerder op drie plaatsen los van elkaar (osm.ts, de seed en de
 * standaardwaarde in het schema) en die liepen uiteen: de opgeslagen instelling
 * miste "ice cream" en "cheese", en omdat een ingevulde instelling wint boven
 * de scanstandaard werden ijssalons in het geheel niet meer gezocht. Precies de
 * categorie waar het ooit over ging.
 *
 * De standaardwaarde in `schema.prisma` moet hiermee overeenkomen; die kan geen
 * TypeScript importeren.
 */
export const DEFAULT_DETECTION_CATEGORIES = [
  "bakery",
  "patisserie",
  "butcher",
  "chocolatier",
  "ice cream",
  "traiteur",
  "cheese",
  "farm shop",
  "takeaway",
] as const;

export const FLANDERS_ZONES = [
  "Antwerpen",
  "Oost-Vlaanderen",
  "West-Vlaanderen",
  "Vlaams-Brabant",
  "Limburg",
] as const;

export const ZONE_CENTERS: Record<string, { lat: number; lng: number; cities: string[] }> = {
  Antwerpen: {
    lat: 51.2194,
    lng: 4.4025,
    cities: ["Antwerpen", "Mechelen", "Turnhout", "Lier"],
  },
  "Oost-Vlaanderen": {
    lat: 51.0543,
    lng: 3.7174,
    cities: ["Gent", "Aalst", "Sint-Niklaas", "Dendermonde"],
  },
  "West-Vlaanderen": {
    lat: 51.2093,
    lng: 3.2247,
    cities: ["Brugge", "Kortrijk", "Oostende", "Roeselare"],
  },
  "Vlaams-Brabant": {
    lat: 50.8798,
    lng: 4.7005,
    cities: ["Leuven", "Vilvoorde", "Tienen", "Halle"],
  },
  Limburg: {
    lat: 50.9307,
    lng: 5.3378,
    cities: ["Hasselt", "Genk", "Tongeren", "Sint-Truiden"],
  },
};

/**
 * Towns scanned per province, with coordinates.
 *
 * Overpass cannot reliably answer a province-sized query — those time out —
 * but a town-sized box answers every time. Scanning town by town is also how
 * the work is actually planned ("I'm doing Roeselare this week").
 */
export const ZONE_TOWNS: Record<string, Array<{ name: string; lat: number; lng: number }>> = {
  "West-Vlaanderen": [
    { name: "Brugge", lat: 51.2093, lng: 3.2247 },
    { name: "Kortrijk", lat: 50.8279, lng: 3.2649 },
    { name: "Oostende", lat: 51.2247, lng: 2.9125 },
    { name: "Roeselare", lat: 50.9447, lng: 3.1338 },
    { name: "Ieper", lat: 50.8514, lng: 2.8853 },
    { name: "Waregem", lat: 50.8886, lng: 3.4271 },
    { name: "Tielt", lat: 50.9994, lng: 3.3269 },
    { name: "Torhout", lat: 51.0656, lng: 3.1006 },
    { name: "Veurne", lat: 51.0722, lng: 2.6619 },
    { name: "Knokke-Heist", lat: 51.3506, lng: 3.2769 },
    { name: "Izegem", lat: 50.9153, lng: 3.2100 },
    { name: "Menen", lat: 50.7994, lng: 3.1219 },
    { name: "Diksmuide", lat: 51.0322, lng: 2.8639 },
    { name: "Poperinge", lat: 50.8544, lng: 2.7256 },
  ],
  "Oost-Vlaanderen": [
    { name: "Gent", lat: 51.0543, lng: 3.7174 },
    { name: "Aalst", lat: 50.9378, lng: 4.0409 },
    { name: "Sint-Niklaas", lat: 51.1650, lng: 4.1436 },
    { name: "Dendermonde", lat: 51.0281, lng: 4.1014 },
    { name: "Oudenaarde", lat: 50.8503, lng: 3.6017 },
    { name: "Deinze", lat: 50.9803, lng: 3.5292 },
    { name: "Eeklo", lat: 51.1867, lng: 3.5636 },
    { name: "Lokeren", lat: 51.1036, lng: 3.9928 },
    { name: "Ronse", lat: 50.7472, lng: 3.6008 },
    { name: "Wetteren", lat: 51.0006, lng: 3.8797 },
    { name: "Zottegem", lat: 50.8697, lng: 3.8100 },
    { name: "Geraardsbergen", lat: 50.7728, lng: 3.8756 },
    { name: "Beveren", lat: 51.2119, lng: 4.2569 },
  ],
  Antwerpen: [
    { name: "Antwerpen", lat: 51.2194, lng: 4.4025 },
    { name: "Mechelen", lat: 51.0259, lng: 4.4776 },
    { name: "Turnhout", lat: 51.3225, lng: 4.9447 },
    { name: "Lier", lat: 51.1319, lng: 4.5703 },
    { name: "Geel", lat: 51.1650, lng: 4.9906 },
    { name: "Herentals", lat: 51.1789, lng: 4.8319 },
    { name: "Mol", lat: 51.1892, lng: 5.1156 },
    { name: "Heist-op-den-Berg", lat: 51.0783, lng: 4.7256 },
    { name: "Boom", lat: 51.0906, lng: 4.3703 },
    { name: "Brasschaat", lat: 51.2917, lng: 4.4917 },
  ],
  "Vlaams-Brabant": [
    { name: "Leuven", lat: 50.8798, lng: 4.7005 },
    { name: "Vilvoorde", lat: 50.9281, lng: 4.4269 },
    { name: "Tienen", lat: 50.8069, lng: 4.9381 },
    { name: "Halle", lat: 50.7361, lng: 4.2372 },
    { name: "Diest", lat: 50.9856, lng: 5.0508 },
    { name: "Aarschot", lat: 50.9861, lng: 4.8353 },
    { name: "Dilbeek", lat: 50.8631, lng: 4.2606 },
    { name: "Asse", lat: 50.9114, lng: 4.1997 },
  ],
  Limburg: [
    { name: "Hasselt", lat: 50.9307, lng: 5.3378 },
    { name: "Genk", lat: 50.9650, lng: 5.5008 },
    { name: "Tongeren", lat: 50.7806, lng: 5.4644 },
    { name: "Sint-Truiden", lat: 50.8167, lng: 5.1861 },
    { name: "Beringen", lat: 51.0489, lng: 5.2278 },
    { name: "Lommel", lat: 51.2306, lng: 5.3125 },
    { name: "Bilzen", lat: 50.8722, lng: 5.5194 },
    { name: "Maasmechelen", lat: 50.9678, lng: 5.6939 },
  ],
};

/** south, west, north, east — for free OpenStreetMap Overpass scans */
export const ZONE_BBOX: Record<string, [number, number, number, number]> = {
  Antwerpen: [51.0, 4.15, 51.45, 5.0],
  "Oost-Vlaanderen": [50.7, 3.3, 51.45, 4.4],
  "West-Vlaanderen": [50.7, 2.5, 51.4, 3.55],
  "Vlaams-Brabant": [50.65, 4.0, 51.05, 5.05],
  Limburg: [50.7, 5.05, 51.25, 5.9],
};

export const PRODUCT_LINES = [
  { value: "MACHINE", label: "Machines" },
  { value: "BEHUIZING", label: "Behuizing" },
  { value: "PACKAGING", label: "Packaging" },
  { value: "TERMINAL", label: "Payment terminals" },
  { value: "TELEMETRY", label: "Telemetry" },
] as const;

export const LEAD_STATUSES = [
  "NEW",
  "TO_CALL",
  "CONTACTED",
  "FOLLOW_UP",
  "NEGOTIATION",
  "WON",
  "LOST",
  "SKIPPED",
  "DO_NOT_CONTACT",
] as const;

/**
 * De statuswaarden blijven Engels in de database — alleen de weergave is
 * Nederlands. Zo blijft alle bestaande data geldig.
 */
export const STATUS_LABELS: Record<string, string> = {
  NEW: "Nieuw",
  TO_CALL: "Te bellen",
  CONTACTED: "Gecontacteerd",
  FOLLOW_UP: "Opvolgen",
  NEGOTIATION: "In gesprek",
  WON: "Klant",
  LOST: "Afgehaakt",
  SKIPPED: "Overgeslagen",
  DO_NOT_CONTACT: "Niet contacteren",
};

export const COMPLIANCE_LABELS: Record<string, string> = {
  PENDING: "Nog te beslissen",
  CLEARED: "Goedgekeurd",
  BLOCKED: "Geblokkeerd",
};

/** Categorieën komen uit OpenStreetMap/Places en worden Engels opgeslagen. */
export const CATEGORY_LABELS: Record<string, string> = {
  bakery: "Bakkerij",
  bakkerij: "Bakkerij",
  patisserie: "Patisserie",
  butcher: "Slagerij",
  slagerij: "Slagerij",
  chocolatier: "Chocolatier",
  "ice cream": "IJssalon",
  ijssalon: "IJssalon",
  traiteur: "Traiteur",
  cheese: "Kaaswinkel",
  "farm shop": "Hoevewinkel",
  hoevewinkel: "Hoevewinkel",
  florist: "Bloemist",
  takeaway: "Afhaal",
  cafe: "Café",
  convenience: "Buurtwinkel",
};

export function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status.replaceAll("_", " ").toLowerCase();
}

export function categoryLabel(category?: string | null) {
  if (!category) return "Onbekend";
  return CATEGORY_LABELS[category.toLowerCase()] ?? category;
}

/** Creative types (spec §30.2). */
export const CREATIVE_TYPES = [
  "SOCIAL_POST",
  "PAID_AD",
  "WEBSITE_BANNER",
  "PRODUCT_PAGE",
  "SALES_BROCHURE",
  "PROPOSAL_VISUAL",
  "CATALOGUE",
  "FLYER",
  "POSTER",
  "SIGNAGE_SLIDE",
  "PRODUCT_RENDER",
  "PRODUCT_ANIMATION",
  "AI_IMAGE",
  "AI_VIDEO",
  "INFOGRAPHIC",
  "EMAIL_CAMPAIGN",
  "CUSTOMER_MOCKUP",
  "LAUNCH_PACKAGE",
] as const;

/** Creative workflow (spec §30.3). */
export const CREATIVE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "BRIEF_APPROVED",
  "ASSIGNED",
  "IN_PRODUCTION",
  "INTERNAL_REVIEW",
  "REVISION_REQUESTED",
  "CUSTOMER_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
  "CANCELLED",
] as const;

export const CREATIVE_OPEN_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "BRIEF_APPROVED",
  "ASSIGNED",
  "IN_PRODUCTION",
  "INTERNAL_REVIEW",
  "REVISION_REQUESTED",
  "CUSTOMER_REVIEW",
] as const;

/** Campaign objectives (spec §34.2). */
export const CAMPAIGN_OBJECTIVES = [
  "LEAD_GENERATION",
  "BRAND_AWARENESS",
  "PRODUCT_LAUNCH",
  "EVENT_PROMOTION",
  "MACHINE_SALES",
  "PACKAGING_SALES",
  "RENTAL_PROMOTION",
  "LOCATION_RECRUITMENT",
  "PARTNER_RECRUITMENT",
  "RETARGETING",
] as const;

export const CAMPAIGN_STATUSES = ["PLANNED", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"] as const;

export const MARKETING_CHANNELS = [
  "INSTAGRAM",
  "FACEBOOK",
  "LINKEDIN",
  "TIKTOK",
  "YOUTUBE",
  "WEBSITE",
  "EMAIL",
  "SIGNAGE",
] as const;

/** Brand asset types (spec §31.1). */
export const BRAND_ASSET_TYPES = [
  "LOGO",
  "COLOR",
  "FONT",
  "ICON",
  "MACHINE_IMAGE",
  "MACHINE_VIDEO",
  "PRODUCT_RENDER",
  "PACKAGING_IMAGE",
  "SHOP_IMAGE",
  "TESTIMONIAL",
  "PRESENTATION",
  "BROCHURE",
  "SOCIAL_TEMPLATE",
  "VIDEO_TEMPLATE",
  "DOCUMENT_TEMPLATE",
  "APPROVED_COPY",
  "BRAND_GUIDELINE",
] as const;

export const ASSET_STATUSES = ["DRAFT", "APPROVED", "EXPIRED", "ARCHIVED"] as const;

/** Template lifecycle (spec §40.1). */
export const TEMPLATE_STATUSES = [
  "DRAFT",
  "UNDER_REVIEW",
  "MATO_APPROVED",
  "ACCOUNTANT_APPROVED",
  "LEGAL_APPROVED",
  "SUPERSEDED",
  "EXPIRED",
  "BLOCKED",
] as const;

export const TEMPLATE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  UNDER_REVIEW: "In nazicht",
  MATO_APPROVED: "Actief",
  ACCOUNTANT_APPROVED: "Goedgekeurd door boekhouder",
  LEGAL_APPROVED: "Juridisch goedgekeurd",
  SUPERSEDED: "Vervangen",
  EXPIRED: "Vervallen",
  BLOCKED: "Geblokkeerd",
};

export function templateStatusLabel(status: string) {
  return TEMPLATE_STATUS_LABELS[status] ?? status;
}

export const DOCUMENT_CATEGORIES = [
  "SALES",
  "MACHINE",
  "PACKAGING",
  "SUPPLIER",
  "PARTNERSHIP",
  "MARKETING",
  "INTERNAL",
] as const;

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  SALES: "Verkoop",
  MACHINE: "Automaat",
  PACKAGING: "Verpakking",
  SUPPLIER: "Leverancier",
  PARTNERSHIP: "Samenwerking",
  MARKETING: "Reclame",
  INTERNAL: "Intern",
};

export function documentCategoryLabel(category: string) {
  return DOCUMENT_CATEGORY_LABELS[category] ?? category;
}

/** Clause categories (spec §39.1). */
export const CLAUSE_CATEGORIES = [
  "PAYMENT_TERMS",
  "DEPOSIT",
  "LATE_PAYMENT",
  "OWNERSHIP_RESERVATION",
  "DELIVERY",
  "INSTALLATION",
  "WARRANTY",
  "MAINTENANCE",
  "DAMAGE",
  "ELECTRICITY",
  "PRODUCT_RESPONSIBILITY",
  "FOOD_SAFETY",
  "STOCK_RESPONSIBILITY",
  "COMMISSION",
  "REVENUE_REPORTING",
  "CONFIDENTIALITY",
  "INTELLECTUAL_PROPERTY",
  "DATA_PROTECTION",
  "CONTRACT_DURATION",
  "RENEWAL",
  "TERMINATION",
  "FORCE_MAJEURE",
  "LIABILITY",
  "APPLICABLE_LAW",
  "DISPUTE_RESOLUTION",
] as const;

export const CLAUSE_STATUSES = [
  "DRAFT",
  "UNDER_REVIEW",
  "MATO_APPROVED",
  "ACCOUNTANT_APPROVED",
  "LEGAL_APPROVED",
  "EXPIRED",
  "BLOCKED",
] as const;

export const DOCUMENT_STATUSES = [
  "DRAFT",
  "VALIDATED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "SENT",
  "SIGNED",
  "EXPIRED",
  "CANCELLED",
] as const;

/** Contact roles (spec §8.2). */
export const CONTACT_ROLES = [
  "OWNER",
  "DIRECTOR",
  "PURCHASING_MANAGER",
  "OPERATIONS_MANAGER",
  "MARKETING_MANAGER",
  "FACILITY_MANAGER",
  "STORE_MANAGER",
  "PRODUCTION_MANAGER",
  "FINANCE",
  "TECHNICAL",
  "GENERAL",
  "GATEKEEPER",
] as const;

export const CONTACT_ROLE_LABELS: Record<string, string> = {
  OWNER: "Eigenaar",
  DIRECTOR: "Directeur",
  PURCHASING_MANAGER: "Inkoop",
  OPERATIONS_MANAGER: "Operations",
  MARKETING_MANAGER: "Marketing",
  FACILITY_MANAGER: "Facility",
  STORE_MANAGER: "Winkelverantwoordelijke",
  PRODUCTION_MANAGER: "Productie",
  FINANCE: "Financiën",
  TECHNICAL: "Technisch",
  GENERAL: "Algemeen",
  GATEKEEPER: "Onthaal / poortwachter",
};

export function contactRoleLabel(role: string) {
  return CONTACT_ROLE_LABELS[role] ?? role;
}

export const CONTACT_INFLUENCE = ["UNKNOWN", "LOW", "MEDIUM", "HIGH"] as const;

export const CONTACT_INFLUENCE_LABELS: Record<string, string> = {
  UNKNOWN: "Onbekend",
  LOW: "Laag",
  MEDIUM: "Gemiddeld",
  HIGH: "Hoog",
};

/** GDPR-relevant consent state (spec §8.1, §58.4). */
export const CONTACT_CONSENT = ["UNKNOWN", "GIVEN", "WITHDRAWN"] as const;

export const CONTACT_CONSENT_LABELS: Record<string, string> = {
  UNKNOWN: "Onbekend",
  GIVEN: "Gegeven",
  WITHDRAWN: "Ingetrokken",
};

export function contactName(c: { firstName: string; lastName?: string | null }) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ");
}

/**
 * Task workflow (spec §46.2). OPEN and DONE are the historical values and
 * stay valid — the waiting/blocked states sit between them.
 */
export const TASK_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_CUSTOMER",
  "WAITING_SUPPLIER",
  "WAITING_APPROVAL",
  "BLOCKED",
  "DONE",
  "CANCELLED",
] as const;

/** Statuses that still need someone to act. */
export const TASK_ACTIVE_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_CUSTOMER",
  "WAITING_SUPPLIER",
  "WAITING_APPROVAL",
  "BLOCKED",
] as const;

export const TASK_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "Bezig",
  WAITING_CUSTOMER: "Wacht op klant",
  WAITING_SUPPLIER: "Wacht op leverancier",
  WAITING_APPROVAL: "Wacht op goedkeuring",
  BLOCKED: "Geblokkeerd",
  DONE: "Afgerond",
  CANCELLED: "Geannuleerd",
};

export function taskStatusLabel(status: string) {
  return TASK_STATUS_LABELS[status] ?? status;
}

/** Automaatplaatsing bij een klant — bewust licht, geen onderhoudsstatussen. */
export const MACHINE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actief",
  REMOVED: "Weggehaald",
};

export function machineStatusLabel(status: string) {
  return MACHINE_STATUS_LABELS[status] ?? status;
}

/**
 * Situaties waarvoor een herbruikbare mailtekst zinvol is.
 *
 * Bewust dezelfde taal als de cadans-stappen in `cadences.ts` — zodat een
 * "dag 5, geen reactie"-taak straks naar de bijpassende tekst kan wijzen.
 */
export const MAIL_SITUATIONS = [
  { value: "FIRST_OUTREACH", label: "Eerste contact" },
  { value: "NO_REPLY_FOLLOWUP", label: "Geen reactie — opvolgen" },
  { value: "POST_SALE_CHECKIN", label: "Klant — check-in" },
  { value: "POST_SALE_ONBOARDING", label: "Klant — opstart" },
] as const;

export function mailSituationLabel(situation: string) {
  return MAIL_SITUATIONS.find((s) => s.value === situation)?.label ?? situation;
}

export const SUPPLIER_STATUSES = [
  "NEW",
  "UNDER_REVIEW",
  "APPROVED",
  "PREFERRED",
  "RESTRICTED",
  "BLOCKED",
  "ARCHIVED",
] as const;

export const SOURCING_STATUSES = [
  "SUBMITTED",
  "SEARCHING",
  "QUOTES_REQUESTED",
  "QUOTES_RECEIVED",
  "SAMPLES",
  "SUPPLIER_SELECTED",
  "ORDERED",
  "IN_PRODUCTION",
  "SHIPPED",
  "DELIVERED",
  "CLOSED",
  "CANCELLED",
] as const;

export const SOURCING_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

/** Max points per supplier scoring pillar (spec §23). */
export const SUPPLIER_SCORE_CAPS = {
  qualityScore: 25,
  priceScore: 20,
  reliabilityScore: 20,
  communicationScore: 15,
  flexibilityScore: 10,
  documentationScore: 10,
} as const;

export function supplierOverallScore(s: {
  qualityScore: number;
  priceScore: number;
  reliabilityScore: number;
  communicationScore: number;
  flexibilityScore: number;
  documentationScore: number;
  adjustedScore?: number | null;
}) {
  const auto =
    s.qualityScore +
    s.priceScore +
    s.reliabilityScore +
    s.communicationScore +
    s.flexibilityScore +
    s.documentationScore;
  return { auto, effective: s.adjustedScore ?? auto };
}

export const DEAL_STAGES = [
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export const CALL_OUTCOMES = [
  { value: "NO_ANSWER", label: "Niet opgenomen" },
  { value: "VOICEMAIL", label: "Voicemail" },
  { value: "WRONG_NUMBER", label: "Verkeerd nummer" },
  { value: "INTERESTED", label: "Interesse" },
  { value: "NOT_INTERESTED", label: "Geen interesse" },
  { value: "CALLBACK", label: "Opvolgen" },
] as const;

export const EMAIL_OUTCOMES = [
  { value: "SENT", label: "Verstuurd" },
  { value: "NO_REPLY", label: "Geen antwoord" },
  { value: "INTERESTED", label: "Interesse" },
  { value: "NOT_INTERESTED", label: "Geen interesse" },
  { value: "CALLBACK", label: "Opvolgen" },
] as const;

export const VISIT_OUTCOMES = [
  { value: "INTERESTED", label: "Interesse" },
  { value: "NOT_INTERESTED", label: "Geen interesse" },
  { value: "CALLBACK", label: "Opvolgen" },
  { value: "OTHER", label: "Anders" },
] as const;

/** Alle mogelijke resultaten, voor labels in de geschiedenis. */
const ALL_OUTCOME_LABELS = new Map<string, string>([
  ...CALL_OUTCOMES.map((o) => [o.value, o.label] as const),
  ...EMAIL_OUTCOMES.map((o) => [o.value, o.label] as const),
  ...VISIT_OUTCOMES.map((o) => [o.value, o.label] as const),
]);

export function outcomeLabel(value: string) {
  return ALL_OUTCOME_LABELS.get(value) ?? value;
}

export function outcomesForType(type: string) {
  if (type === "EMAIL") return EMAIL_OUTCOMES;
  if (type === "VISIT") return VISIT_OUTCOMES;
  if (type === "NOTE") return [] as const;
  return CALL_OUTCOMES;
}

export function formatEUR(value: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Unit-level money. Packaging sells for cents per piece, so whole-euro
 * rounding would render every price as "€ 0". Keeps machines readable too.
 */
export function formatEURUnit(value: number) {
  const abs = Math.abs(value);
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: abs < 100 ? 2 : 0,
    maximumFractionDigits: abs < 1 ? 4 : abs < 100 ? 2 : 0,
  }).format(value);
}

export function dealTotal(
  lines: { qty: number; unitPrice: number }[],
  discountPercent = 0
) {
  const sub = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  return sub * (1 - discountPercent / 100);
}
