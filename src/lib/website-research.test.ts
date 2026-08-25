import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafePublicUrl,
  extractWebsitePage,
  fetchWebsiteResearch,
  isPrivateOrReservedIp,
  WebsiteResearchError,
} from "./website-research";

test("website research blocks private and reserved addresses", () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
  ]) {
    assert.equal(isPrivateOrReservedIp(address), true, address);
  }
  assert.equal(isPrivateOrReservedIp("8.8.8.8"), false);
  assert.equal(isPrivateOrReservedIp("2606:4700:4700::1111"), false);
});

test("website research checks every DNS answer", async () => {
  await assert.rejects(
    () =>
      assertSafePublicUrl("https://voorbeeld.be", async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ]),
    WebsiteResearchError
  );
  const url = await assertSafePublicUrl("https://voorbeeld.be", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  assert.equal(url.hostname, "voorbeeld.be");
});

test("website page extraction keeps facts and removes active content", () => {
  const page = extractWebsitePage(
    `<html>
      <head>
        <title>De Testbakker</title>
        <meta name="description" content="Brood en patisserie in Diksmuide">
        <script>ignore@example.com</script>
      </head>
      <body>
        <h1>Welkom</h1>
        <a href="/contact">Contact</a>
        <a href="mailto:info@testbakker.be">Mail ons</a>
      </body>
    </html>`,
    "https://testbakker.be/"
  );
  assert.equal(page.title, "De Testbakker");
  assert.equal(page.description, "Brood en patisserie in Diksmuide");
  assert.equal(page.email, "info@testbakker.be");
  assert.equal(page.text.includes("ignore@example.com"), false);
  assert.deepEqual(page.links, ["https://testbakker.be/contact"]);
});

test("website research refuses a redirect into the local network", async () => {
  const fakeFetch = async () =>
    new Response("", {
      status: 302,
      headers: { location: "http://127.0.0.1/admin" },
    });
  await assert.rejects(
    () =>
      fetchWebsiteResearch("https://voorbeeld.be", {
        fetchImpl: fakeFetch as typeof fetch,
        lookupHost: async () => [{ address: "93.184.216.34", family: 4 }],
      }),
    WebsiteResearchError
  );
});

test("website research follows at most relevant same-origin pages", async () => {
  const requested: string[] = [];
  const fakeFetch = async (input: string | URL | Request) => {
    const url = String(input);
    requested.push(url);
    if (url.endsWith("/contact")) {
      return new Response("<p>Mail info@bakker.be</p>", {
        headers: { "content-type": "text/html" },
      });
    }
    return new Response(
      `<title>Bakker</title><meta property="og:description" content="Vers brood">
       <p>Brood en koffiekoeken</p><a href="/contact">Contact</a>
       <a href="https://ander.be/over-ons">Extern</a>`,
      { headers: { "content-type": "text/html" } }
    );
  };
  const result = await fetchWebsiteResearch("https://bakker.be", {
    fetchImpl: fakeFetch as typeof fetch,
    lookupHost: async () => [{ address: "93.184.216.34", family: 4 }],
  });
  assert.equal(result.description, "Vers brood");
  assert.equal(result.email, "info@bakker.be");
  assert.deepEqual(requested, ["https://bakker.be/", "https://bakker.be/contact"]);
});
