export const NAV = [
  { href: "/", label: "Work" },
  { href: "/leads", label: "Leads" },
  { href: "/calls", label: "Calls" },
] as const;

export const NAV_ADMIN = [{ href: "/settings", label: "Settings" }] as const;

/** Triage → Call → Log is genuinely ordered, so the steps stay numbered. */
export const WORK_STEPS = [
  { id: "review", code: "1", label: "Triage" },
  { id: "call", code: "2", label: "Call" },
  { id: "log", code: "3", label: "Log" },
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
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  MATO_APPROVED: "MATO approved",
  ACCOUNTANT_APPROVED: "Accountant approved",
  LEGAL_APPROVED: "Legal approved",
  SUPERSEDED: "Superseded",
  EXPIRED: "Expired",
  BLOCKED: "Blocked",
};

export const DOCUMENT_CATEGORIES = [
  "SALES",
  "MACHINE",
  "PACKAGING",
  "SUPPLIER",
  "PARTNERSHIP",
  "MARKETING",
  "INTERNAL",
] as const;

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

export const CONTACT_INFLUENCE = ["UNKNOWN", "LOW", "MEDIUM", "HIGH"] as const;

/** GDPR-relevant consent state (spec §8.1, §58.4). */
export const CONTACT_CONSENT = ["UNKNOWN", "GIVEN", "WITHDRAWN"] as const;

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
  OPEN: "Not started",
  IN_PROGRESS: "In progress",
  WAITING_CUSTOMER: "Waiting for customer",
  WAITING_SUPPLIER: "Waiting for supplier",
  WAITING_APPROVAL: "Waiting for approval",
  BLOCKED: "Blocked",
  DONE: "Completed",
  CANCELLED: "Cancelled",
};

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
  { value: "NO_ANSWER", label: "No answer" },
  { value: "VOICEMAIL", label: "Voicemail" },
  { value: "WRONG_NUMBER", label: "Wrong number" },
  { value: "INTERESTED", label: "Interested" },
  { value: "NOT_INTERESTED", label: "Not interested" },
  { value: "CALLBACK", label: "Callback" },
] as const;

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
