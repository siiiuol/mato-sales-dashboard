import "server-only";

type LearningOutcome = {
  idempotency_key: string;
  intelligence_establishment_id: string;
  enterprise_number?: string | null;
  establishment_number?: string | null;
  outcome_type: "review" | "outreach" | "meeting" | "deal";
  outcome_value: string;
  machine_count?: number | null;
  revenue_eur?: number | null;
  gross_margin_eur?: number | null;
  sales_cycle_days?: number | null;
  occurred_at: string;
  cohort?: string | null;
};

const baseUrl = process.env.LEAD_BOT_URL || "http://127.0.0.1:8000";

export async function sendLearningOutcome(outcome: LearningOutcome) {
  const serviceKey = process.env.LEARNING_SERVICE_KEY;
  if (!serviceKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("LEARNING_SERVICE_KEY is required");
    }
    return { skipped: true, reason: "service_not_configured" };
  }
  const response = await fetch(`${baseUrl}/internal/learning/outcomes`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-mato-service-key": serviceKey,
      "x-mato-service-id": "mato-crm",
    },
    body: JSON.stringify(outcome),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Learning outcome sync failed (${response.status})`);
  }
  return response.json();
}

export async function sendLearningOutcomeSafely(outcome: LearningOutcome) {
  try {
    return await sendLearningOutcome(outcome);
  } catch (error) {
    console.error("Learning outcome sync deferred", error);
    return { skipped: true, reason: "sync_failed" };
  }
}

export async function fetchLearningReport() {
  const apiKey = process.env.LEAD_BOT_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch(`${baseUrl}/internal/learning/metrics`, {
      headers: { "x-mato-key": apiKey },
      cache: "no-store",
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}
