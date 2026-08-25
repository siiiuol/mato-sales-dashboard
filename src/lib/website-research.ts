import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 200_000;
const MAX_RESEARCH_CHARS = 6_000;
const MAX_MAIL_CHARS = 1_500;
const REQUEST_TIMEOUT_MS = 7_000;
const MAX_EXTRA_PAGES = 2;

type LookupAddress = { address: string; family: number };
type LookupHost = (hostname: string) => Promise<LookupAddress[]>;
type FetchLike = typeof fetch;

export type WebsiteResearch = {
  url: string;
  title: string | null;
  description: string | null;
  text: string;
  email: string | null;
  pages: string[];
};

type WebsitePage = {
  url: string;
  html: string;
  title: string | null;
  description: string | null;
  text: string;
  email: string | null;
  links: string[];
};

export class WebsiteResearchError extends Error {}

function ipv4Parts(address: string): number[] | null {
  if (isIP(address) !== 4) return null;
  const parts = address.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => part >= 0 && part <= 255)
    ? parts
    : null;
}

/**
 * Externe website-ophaling mag nooit als doorgang naar het lokale netwerk
 * dienen. Ook documentatie- en multicastreeksen tellen daarom als niet-publiek.
 */
export function isPrivateOrReservedIp(address: string): boolean {
  const v4 = ipv4Parts(address);
  if (v4) {
    const [a, b] = v4;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51) ||
      (a === 203 && b === 0) ||
      a >= 224
    );
  }

  if (isIP(address) !== 6) return true;
  const value = address.toLowerCase().split("%")[0];
  if (
    value === "::" ||
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    /^fe[89ab]/.test(value) ||
    value.startsWith("ff") ||
    value.startsWith("2001:db8:")
  ) {
    return true;
  }
  const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mapped ? isPrivateOrReservedIp(mapped) : false;
}

const defaultLookup: LookupHost = async (hostname) => {
  const rows = await lookup(hostname, { all: true, verbatim: true });
  return rows.map((row) => ({ address: row.address, family: row.family }));
};

export async function assertSafePublicUrl(
  rawUrl: string,
  lookupHost: LookupHost = defaultLookup
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new WebsiteResearchError("De website-URL is ongeldig.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new WebsiteResearchError("Alleen publieke http- en https-websites zijn toegestaan.");
  }
  if (url.username || url.password) {
    throw new WebsiteResearchError("Een website-URL met aanmeldgegevens is niet toegestaan.");
  }
  if (
    (url.protocol === "http:" && url.port && url.port !== "80") ||
    (url.protocol === "https:" && url.port && url.port !== "443")
  ) {
    throw new WebsiteResearchError("Een website op een afwijkende poort wordt niet opgehaald.");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new WebsiteResearchError("Lokale netwerkadressen worden niet opgehaald.");
  }

  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await lookupHost(hostname).catch(() => []);
  if (
    addresses.length === 0 ||
    addresses.some((row) => isPrivateOrReservedIp(row.address))
  ) {
    throw new WebsiteResearchError("De website verwijst niet naar een publiek internetadres.");
  }

  return url;
}

async function readLimitedText(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      break;
    }
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return text
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match)
    .replace(/&#(\d+);/g, (match, value: string) => {
      const code = Number(value);
      return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    })
    .replace(/&#x([0-9a-f]+);/gi, (match, value: string) => {
      const code = Number.parseInt(value, 16);
      return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    });
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function attribute(tag: string, name: string): string | null {
  const match = tag.match(
    new RegExp(`${name}\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))`, "i")
  );
  return decodeEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim() || null;
}

function metaContent(html: string, names: string[]): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attribute(tag, "name") ?? attribute(tag, "property"))?.toLowerCase();
    if (key && names.includes(key)) {
      const content = attribute(tag, "content");
      if (content) return content;
    }
  }
  return null;
}

function extractEmail(html: string, text: string): string | null {
  const mailto = html.match(/mailto:([^"'? >]+)/i)?.[1];
  const visible = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  let decoded = mailto ?? visible ?? "";
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Een fout geëncodeerde mailto-link mag de rest van de pagina niet wissen.
  }
  const value = decoded.trim().toLowerCase();
  return /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(value) && value.length <= 254
    ? value
    : null;
}

function relevantSameOriginLinks(html: string, pageUrl: string): string[] {
  const base = new URL(pageUrl);
  const candidates: Array<{ url: string; priority: number }> = [];
  const seen = new Set<string>();

  for (const tag of html.match(/<a\b[^>]*>/gi) ?? []) {
    const href = attribute(tag, "href");
    if (!href) continue;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (
      url.origin !== base.origin ||
      !["http:", "https:"].includes(url.protocol) ||
      seen.has(url.toString())
    ) {
      continue;
    }
    const target = `${url.pathname} ${url.search}`.toLowerCase();
    const priority = /contact/.test(target)
      ? 1
      : /(over[-_/]?ons|about|wie[-_/]?zijn|assortiment|producten|winkel)/.test(target)
        ? 2
        : 0;
    if (!priority) continue;
    url.hash = "";
    seen.add(url.toString());
    candidates.push({ url: url.toString(), priority });
  }

  return candidates
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_EXTRA_PAGES)
    .map((candidate) => candidate.url);
}

export function extractWebsitePage(html: string, url: string): WebsitePage {
  const text = htmlToText(html);
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return {
    url,
    html,
    title: title || null,
    description: metaContent(html, ["description", "og:description"]),
    text,
    email: extractEmail(html, text),
    links: relevantSameOriginLinks(html, url),
  };
}

async function fetchPage(
  rawUrl: string,
  fetchImpl: FetchLike,
  lookupHost: LookupHost
): Promise<WebsitePage> {
  let current = await assertSafePublicUrl(rawUrl, lookupHost);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    let response: Response;
    try {
      response = await fetchImpl(current.toString(), {
        headers: {
          accept: "text/html,text/plain;q=0.9",
          "user-agent": "MATO-Dashboard/1.0 (+lead research)",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new WebsiteResearchError("De website antwoordde niet op tijd.");
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) {
        throw new WebsiteResearchError("De website stuurde te vaak door.");
      }
      current = await assertSafePublicUrl(new URL(location, current).toString(), lookupHost);
      continue;
    }
    if (!response.ok) {
      throw new WebsiteResearchError(`De website antwoordde met status ${response.status}.`);
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new WebsiteResearchError("De website gaf geen leesbare webpagina terug.");
    }
    const html = await readLimitedText(response);
    return extractWebsitePage(html, current.toString());
  }

  throw new WebsiteResearchError("De website kon niet veilig worden gevolgd.");
}

export async function fetchWebsiteResearch(
  url: string,
  options: { fetchImpl?: FetchLike; lookupHost?: LookupHost } = {}
): Promise<WebsiteResearch> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const lookupHost = options.lookupHost ?? defaultLookup;
  const homepage = await fetchPage(url, fetchImpl, lookupHost);
  const extras = await Promise.allSettled(
    homepage.links.map((link) => fetchPage(link, fetchImpl, lookupHost))
  );
  const pages = [
    homepage,
    ...extras.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
  ];
  const joined = pages
    .map((page) => page.text)
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_RESEARCH_CHARS);

  return {
    url: homepage.url,
    title: homepage.title,
    description: homepage.description,
    text: joined,
    email: pages.find((page) => page.email)?.email ?? null,
    pages: pages.map((page) => page.url),
  };
}

/** Compacte compatibiliteitslaag voor de bestaande mailgenerator. */
export async function fetchWebsiteText(url: string): Promise<string | null> {
  try {
    const research = await fetchWebsiteResearch(url);
    return research.text.slice(0, MAX_MAIL_CHARS) || null;
  } catch {
    return null;
  }
}
