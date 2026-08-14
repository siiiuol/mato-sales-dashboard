/**
 * Microsoft Graph, alleen de stukken die MATO gebruikt: een mail versturen en
 * de antwoorden erop ophalen.
 *
 * Krijgt het toegangstoken aangereikt in plaats van het zelf op te halen, zodat
 * dit bestand testbaar blijft en niets van de database hoeft te weten.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

export class GraphError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
  }
}

async function graph<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${GRAPH}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        ...init.headers,
      },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new GraphError("Microsoft is niet bereikbaar.");
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!response.ok) {
    // Graph verpakt de reden in error.message; die is bruikbaar (bijvoorbeeld
    // "The mailbox is not enabled for REST APIs").
    let detail = `${response.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      /* geen JSON — de status is dan het enige wat we hebben */
    }
    throw new GraphError(`Microsoft weigerde de aanvraag: ${detail}`, response.status);
  }

  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export type SentMessage = {
  graphMessageId: string;
  conversationId: string | null;
  sentAt: Date;
  from: string;
};

/**
 * Verstuurt een mail en geeft terug waar hij terechtkwam.
 *
 * In twee stappen — eerst opslaan als concept, dan versturen — omdat
 * `/sendMail` niets teruggeeft. Zonder de `conversationId` uit stap één is een
 * later antwoord nergens aan te koppelen, en dan staat de tijdlijn van de lead
 * halfleeg.
 */
export async function sendMail({
  accessToken,
  to,
  subject,
  body,
}: {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
}): Promise<SentMessage> {
  const created = await graph<{
    id: string;
    conversationId?: string;
    from?: { emailAddress?: { address?: string } };
  }>(accessToken, "/me/messages", {
    method: "POST",
    body: JSON.stringify({
      subject,
      // Tekst, geen HTML: de mail is door een mens geschreven en nagelezen als
      // tekst, en zo komt hij ook aan.
      body: { contentType: "Text", content: body },
      toRecipients: [{ emailAddress: { address: to } }],
    }),
  });

  await graph<void>(accessToken, `/me/messages/${created.id}/send`, {
    method: "POST",
  });

  return {
    graphMessageId: created.id,
    conversationId: created.conversationId ?? null,
    sentAt: new Date(),
    from: created.from?.emailAddress?.address ?? "",
  };
}

export type IncomingMessage = {
  graphMessageId: string;
  conversationId: string | null;
  subject: string;
  body: string;
  from: string;
  to: string;
  receivedAt: Date;
};

export type GraphMessage = {
  id: string;
  conversationId?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  body?: { content?: string | null; contentType?: string | null } | null;
  from?: { emailAddress?: { address?: string | null } | null } | null;
  toRecipients?: Array<{ emailAddress?: { address?: string | null } | null }> | null;
  receivedDateTime?: string | null;
};

/** Zet ruwe Graph-velden om naar wat wij bewaren. */
export function toIncoming(raw: GraphMessage): IncomingMessage {
  const html = raw.body?.contentType?.toLowerCase() === "html";
  const content = raw.body?.content ?? "";
  return {
    graphMessageId: raw.id,
    conversationId: raw.conversationId ?? null,
    subject: raw.subject ?? "(geen onderwerp)",
    body: html ? stripHtml(content) : content || (raw.bodyPreview ?? ""),
    from: raw.from?.emailAddress?.address ?? "",
    to: raw.toRecipients?.[0]?.emailAddress?.address ?? "",
    receivedAt: raw.receivedDateTime ? new Date(raw.receivedDateTime) : new Date(),
  };
}

/** Genoeg om een antwoord leesbaar te tonen; geen poging tot opmaak. */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Haalt binnengekomen mail op sinds een tijdstip.
 *
 * Oudste eerst, en met paginering. Dat is niet willekeurig: de aanroeper zet
 * zijn peilmerk op het nieuwste bericht dat hij bewaarde. Haalden we nieuwste
 * eerst op en paste de rest niet meer in de pagina, dan schuift dat peilmerk
 * over alle oudere berichten heen en zijn die voorgoed onzichtbaar — terwijl
 * het scherm "niets nieuws" meldt.
 *
 * `truncated` zegt of er nog meer klaarstond dan we in één ronde ophaalden, zodat
 * de medewerker te horen krijgt dat hij nog een keer moet drukken.
 */
export async function fetchInbox({
  accessToken,
  since,
  maxMessages = 200,
}: {
  accessToken: string;
  since: Date;
  maxMessages?: number;
}): Promise<{ messages: IncomingMessage[]; truncated: boolean }> {
  const params = new URLSearchParams({
    $filter: `receivedDateTime ge ${since.toISOString()}`,
    $orderby: "receivedDateTime asc",
    $top: "50",
    $select: "id,conversationId,subject,bodyPreview,body,from,toRecipients,receivedDateTime",
  });

  let url: string | null = `/me/mailFolders/inbox/messages?${params.toString()}`;
  const messages: IncomingMessage[] = [];
  let truncated = false;

  while (url) {
    const page: { value?: GraphMessage[]; "@odata.nextLink"?: string } = await graph(
      accessToken,
      url
    );
    messages.push(...(page.value ?? []).map(toIncoming));

    const next = page["@odata.nextLink"];
    if (!next) break;

    if (messages.length >= maxMessages) {
      // Een postvak met duizenden berichten mag één ronde niet laten hangen.
      // We stoppen, maar zeggen het — stil afkappen is precies de fout die dit
      // hele ontwerp probeert te vermijden.
      truncated = true;
      break;
    }
    // Graph geeft een volledige URL terug; die kort de helper zelf niet in.
    url = next.replace("https://graph.microsoft.com/v1.0", "");
  }

  return { messages, truncated };
}
