import { z } from "zod";

export const idSchema = z.string().cuid();
export const roleSchema = z.enum(["admin", "sales", "reviewer"]);
export const leadStatusSchema = z.enum([
  "NEW",
  "TO_CALL",
  "CONTACTED",
  "FOLLOW_UP",
  "NEGOTIATION",
  "WON",
  "LOST",
  "SKIPPED",
  "DO_NOT_CONTACT",
]);
export const dealStageSchema = z.enum([
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
]);
export const callOutcomeSchema = z.enum([
  "NO_ANSWER",
  "VOICEMAIL",
  "WRONG_NUMBER",
  "INTERESTED",
  "NOT_INTERESTED",
  "CALLBACK",
  "OTHER",
]);
export const reviewActionSchema = z.enum([
  "approve_for_call",
  "approve_for_email",
  "request_research",
  "reject_temporary",
  "reject_permanent",
  "do_not_contact",
  "mark_duplicate",
  "mark_existing_customer",
]);

const optionalText = z.string().trim().max(5000).optional().nullable();
const optionalUrl = z.string().url().max(2048).optional().nullable().or(z.literal(""));

export const intelligenceImportSchema = z.object({
  intelligence_establishment_id: z.union([z.string(), z.number()]).transform(String),
  intelligence_enterprise_id: z.union([z.string(), z.number()]).optional().transform((v) =>
    v == null ? undefined : String(v)
  ),
  enterprise_number: z.union([z.string(), z.number()]).optional().transform((v) =>
    v == null ? undefined : String(v)
  ),
  source_version: z.string().max(100).optional(),
  name: z.string().trim().min(1).max(300),
  establishment_name: optionalText,
  enterprise_name: optionalText,
  address: optionalText,
  city: optionalText,
  province: optionalText,
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  category: optionalText,
  phone: optionalText,
  email: z.string().email().optional().nullable().or(z.literal("")),
  website: optionalUrl,
  score: z.coerce.number().min(0).max(100).default(0),
  timing_score: z.coerce.number().min(0).max(100).default(0),
  distance_km: z.coerce.number().min(0).optional().nullable(),
  tier: optionalText,
  reason: optionalText,
  evidence_summary: optionalText,
  recommended_machine: optionalText,
  recommended_contact_angle: optionalText,
  phone_opener: optionalText,
  discovery_questions: z.array(z.string().max(500)).optional(),
  likely_objection: optionalText,
  outreach_prep: z.record(z.string(), z.unknown()).optional(),
  action: z.string().optional(),
  compliance_status: z.enum(["PENDING", "CLEARED", "BLOCKED"]).default("PENDING"),
});

export function formObject(formData: FormData) {
  return Object.fromEntries(
    [...formData.entries()].filter(([key]) => !key.startsWith("$ACTION_"))
  );
}
