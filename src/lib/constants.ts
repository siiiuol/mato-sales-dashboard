export const NAV_PRIMARY = [
  { href: "/", label: "Command", code: "00" },
  { href: "/work", label: "Work", code: "01" },
  { href: "/leads", label: "Leads", code: "02" },
] as const;

export const NAV_MORE = [
  { href: "/calls", label: "Calls", code: "03" },
  { href: "/review", label: "Review", code: "04" },
  { href: "/deals", label: "Deals", code: "05" },
  { href: "/quotes", label: "Quotes", code: "06" },
  { href: "/customers", label: "Customers", code: "07" },
  { href: "/contacts", label: "Contacts", code: "14" },
  { href: "/tasks", label: "Tasks", code: "13" },
  { href: "/sourcing", label: "Sourcing", code: "11" },
  { href: "/suppliers", label: "Suppliers", code: "12" },
  { href: "/marketing", label: "Marketing", code: "15" },
  { href: "/documents", label: "Documents", code: "16" },
  { href: "/catalog", label: "Catalog", code: "08" },
  { href: "/sales", label: "Reports", code: "09" },
  { href: "/settings", label: "Settings", code: "10" },
] as const;

/** Full admin nav keeps all channels visible. */
export const NAV = [...NAV_PRIMARY, ...NAV_MORE] as const;

export const WORK_STEPS = [
  { id: "review", code: "01", label: "Review" },
  { id: "call", code: "02", label: "Call" },
  { id: "log", code: "03", label: "Log" },
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
