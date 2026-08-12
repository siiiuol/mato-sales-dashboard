/**
 * Dunne laag over de OpenAI-API.
 *
 * Geen SDK: er wordt één endpoint aangeroepen met één vorm van antwoord, en een
 * bibliotheek zou daar afhankelijkheden en een eigen versiebeleid voor
 * meebrengen. `fetch` volstaat.
 *
 * Bewust géén `server-only` hier: dit bestand bevat zelf geen geheim, het
 * krijgt de sleutel als argument. Die grens ligt in `mail-actions.ts`, dat de
 * sleutel uit de database leest en wél afgeschermd is. Zonder die uitzondering
 * is dit bestand niet te testen of vanuit een script te draaien — en juist de
 * parse hieronder is het stukje dat stil fout kan gaan.
 */

const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const TIMEOUT_MS = 45_000;

export class OpenAiConfigError extends Error {}

export type MailDraft = { subject: string; body: string };

/**
 * Vraagt een mail op en geeft onderwerp en tekst terug.
 *
 * Het antwoord wordt als JSON afgedwongen; bij vrije tekst zou elke variatie in
 * opmaak hier een parsefout worden.
 */
export async function draftMail({
  apiKey,
  model,
  system,
  prompt,
}: {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
}): Promise<MailDraft> {
  if (!apiKey.trim()) {
    throw new OpenAiConfigError(
      "Er is nog geen OpenAI-sleutel ingesteld. Vul die in bij Instellingen."
    );
  }

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 700,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new OpenAiConfigError(
      err instanceof Error && err.name === "TimeoutError"
        ? "OpenAI antwoordde niet binnen 45 seconden. Probeer opnieuw."
        : "OpenAI is niet bereikbaar."
    );
  }

  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; code?: string };
    };
    // De sleutel zelf komt nooit in een foutmelding terecht.
    if (response.status === 401) {
      throw new OpenAiConfigError(
        "OpenAI weigert de sleutel. Controleer hem bij Instellingen."
      );
    }
    if (response.status === 429) {
      // OpenAI gebruikt 429 zowel voor "te snel achter elkaar" als voor "geen
      // tegoed meer", en dat zijn heel verschillende problemen. De code in het
      // antwoord zegt welke van de twee het is.
      const noCredit =
        detail.error?.code === "insufficient_quota" ||
        detail.error?.code === "credit_balance_exhausted";
      throw new OpenAiConfigError(
        noCredit
          ? "Geen tegoed meer op het OpenAI-account. Voeg krediet toe via platform.openai.com/settings/organization/billing."
          : "Te veel aanvragen na elkaar bij OpenAI. Probeer het zo opnieuw."
      );
    }
    if (response.status === 404) {
      throw new OpenAiConfigError(
        `Het model "${model}" bestaat niet of is niet beschikbaar voor deze sleutel. Pas het aan bij Instellingen.`
      );
    }
    throw new OpenAiConfigError(
      `OpenAI gaf een fout (${response.status}): ${detail.error?.message ?? "onbekend"}`
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new OpenAiConfigError("OpenAI gaf een leeg antwoord.");

  return parseDraft(content);
}

/**
 * Leest onderwerp en tekst uit het antwoord.
 *
 * Apart en streng, want een half gelukte parse zou een mail opleveren met
 * `{"subject":` er nog in — en die gaat dan naar een klant.
 */
export function parseDraft(content: string): MailDraft {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new OpenAiConfigError("Het antwoord van OpenAI was geen geldige JSON.");
  }

  const record = parsed as Record<string, unknown>;
  const subject = typeof record.subject === "string" ? record.subject.trim() : "";
  const body = typeof record.body === "string" ? record.body.trim() : "";

  if (!subject || !body) {
    throw new OpenAiConfigError(
      "Het antwoord van OpenAI miste een onderwerp of een tekst."
    );
  }
  return { subject, body };
}
