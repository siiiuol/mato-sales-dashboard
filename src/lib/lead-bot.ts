import "server-only";

function config() {
  return {
    url: process.env.LEAD_BOT_URL || "http://127.0.0.1:8000",
    key: process.env.LEAD_BOT_API_KEY || "mato-dev-key",
  };
}

export async function leadBotFetch(path: string, init?: RequestInit) {
  const { url, key } = config();
  const headers = new Headers(init?.headers);
  headers.set("x-mato-key", key);
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  return response;
}
