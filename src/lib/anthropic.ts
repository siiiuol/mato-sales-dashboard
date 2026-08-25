/**
 * Dunne laag over de Anthropic Messages-API.
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

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 45_000;
const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Ruim, en dat is met opzet.
 *
 * Op de huidige modellen staat "denken" standaard aan, en `max_tokens` is één
 * plafond voor het denken én de tekst samen. Krap zetten — 700 leek genoeg voor
 * een mail van honderd woorden — laat het denken de ruimte opsnoepen en levert
 * een halve zin op. Het is een plafond, geen uitgave: er wordt betaald voor wat
 * er werkelijk gegenereerd wordt.
 */
const MAX_TOKENS = 16_000;

/**
 * Dwingt de vorm van het antwoord af aan de kant van de API.
 *
 * Vragen om JSON in de opdracht werkt meestal, en "meestal" is hier te weinig:
 * wat er misgaat belandt als tekst in een mail naar een klant. Met een schema
 * kán het antwoord geen andere vorm hebben.
 */
const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string", description: "De onderwerpregel." },
    body: { type: "string", description: "De volledige mailtekst." },
  },
  required: ["subject", "body"],
  additionalProperties: false,
} as const;

export class AnthropicConfigError extends Error {}

export type MailDraft = { subject: string; body: string };

type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required: readonly string[];
  additionalProperties: boolean;
};

/**
 * Vraagt een gestructureerd JSON-antwoord op (zodat de UI het kan tonen/opslaan).
 *
 * Zelfde foutpaden als bij mail: sleutel, model, timeout — geen geheimen in
 * de boodschap.
 */
export async function completeJson({
  apiKey,
  model,
  system,
  prompt,
  schema,
}: {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  schema: JsonSchema;
}): Promise<string> {
  if (!apiKey.trim()) {
    throw new AnthropicConfigError(
      "Er is nog geen Anthropic-sleutel ingesteld. Vul die in bij Instellingen."
    );
  }

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey.trim(),
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        // Géén `temperature`: die is op de huidige modellen afgeschaft en geeft
        // een 400. Toon en variatie stuur je via de opdracht, niet via een knop.
        system,
        messages: [{ role: "user", content: prompt }],
        output_config: {
          format: { type: "json_schema", schema },
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new AnthropicConfigError(
      err instanceof Error && err.name === "TimeoutError"
        ? "Anthropic antwoordde niet binnen 45 seconden. Probeer opnieuw."
        : "Anthropic is niet bereikbaar."
    );
  }

  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; type?: string };
    };
    // De sleutel zelf komt nooit in een foutmelding terecht.
    if (response.status === 401) {
      throw new AnthropicConfigError(
        "Anthropic weigert de sleutel. Controleer hem bij Instellingen."
      );
    }
    if (response.status === 429) {
      throw new AnthropicConfigError(
        "Te veel aanvragen na elkaar bij Anthropic. Probeer het zo opnieuw."
      );
    }
    if (response.status === 404) {
      throw new AnthropicConfigError(
        `Het model "${model}" bestaat niet of is niet beschikbaar voor deze sleutel. Pas het aan bij Instellingen.`
      );
    }
    if (response.status === 400) {
      // Vrijwel altijd het model: een ouder model kent het opgelegde
      // antwoordschema niet. De boodschap van de API zelf is hier preciezer dan
      // wat wij kunnen raden, dus die gaat mee.
      throw new AnthropicConfigError(
        `Anthropic wees de aanvraag af: ${detail.error?.message ?? "onbekende reden"}. ` +
          `Controleer het model bij Instellingen — oudere modellen ondersteunen niet alles.`
      );
    }
    throw new AnthropicConfigError(
      `Anthropic gaf een fout (${response.status}): ${detail.error?.message ?? "onbekend"}`
    );
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const content = data.content
    ?.filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (!content) throw new AnthropicConfigError("Anthropic gaf een leeg antwoord.");
  return content;
}

/** Vraagt een mail op en geeft onderwerp en tekst terug. */
export async function draftMail(args: {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
}): Promise<MailDraft> {
  const content = await completeJson({ ...args, schema: DRAFT_SCHEMA });
  return parseDraft(content);
}

/**
 * Leest onderwerp en tekst uit het antwoord.
 *
 * Apart en streng, want een half gelukte parse zou een mail opleveren met
 * `{"subject":` er nog in — en die gaat dan naar een klant.
 *
 * Claude zet JSON soms in een codeblok; dat wordt hier eerst afgepeld.
 */
export function parseDraft(content: string): MailDraft {
  const stripped = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new AnthropicConfigError(
      "Het antwoord van Anthropic was geen geldige JSON."
    );
  }

  const record = parsed as Record<string, unknown>;
  const subject = typeof record.subject === "string" ? record.subject.trim() : "";
  const body = typeof record.body === "string" ? record.body.trim() : "";

  if (!subject || !body) {
    throw new AnthropicConfigError(
      "Het antwoord van Anthropic miste een onderwerp of een tekst."
    );
  }
  return { subject, body };
}
