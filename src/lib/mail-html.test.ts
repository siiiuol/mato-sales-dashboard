import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, renderBodyBlocks, renderMatoMail } from "./mail-html";

test("tekens die markup zouden worden, worden ontsnapt", () => {
  assert.equal(escapeHtml("a & b"), "a &amp; b");
  assert.equal(escapeHtml("<script>"), "&lt;script&gt;");
  assert.equal(escapeHtml(`"dubbel" 'enkel'`), "&quot;dubbel&quot; &#39;enkel&#39;");
});

// De tekst komt van een mens die hem in een invoerveld typt. Zou die
// ongefilterd in de HTML belanden, dan bepaalt de inhoud van een mail de opmaak
// ervan — en bij een doorgestuurd stuk klanttekst zelfs de werking.
test("een body met HTML erin wordt tekst, geen markup", () => {
  const html = renderBodyBlocks('<img src=x onerror="alert(1)">');
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("onerror=\""));
});

test("een bedrijfsnaam met een ampersand blijft leesbaar", () => {
  const html = renderBodyBlocks("Beste Jansen & Zonen,");
  assert.ok(html.includes("Jansen &amp; Zonen"));
});

test("een lege regel start een nieuwe alinea, een enkele regel een breuk", () => {
  const html = renderBodyBlocks("Eerste regel\ntweede regel\n\nNieuwe alinea");
  assert.equal((html.match(/<p /g) ?? []).length, 2);
  assert.equal((html.match(/<br \/>/g) ?? []).length, 1);
});

test("streepjes worden een lijst", () => {
  const html = renderBodyBlocks("Wat we leveren:\n\n- koffie\n- soep\n- broodjes");
  assert.equal((html.match(/<li /g) ?? []).length, 3);
  assert.ok(html.includes("koffie"));
  // De inleidende regel blijft een alinea, geen lijstitem.
  assert.equal((html.match(/<p /g) ?? []).length, 1);
});

test("een webadres wordt aanklikbaar", () => {
  const html = renderBodyBlocks("Kijk op https://www.matoautomaat.be voor meer.");
  assert.ok(html.includes('href="https://www.matoautomaat.be"'));
});

test("een punt achter een link hoort niet bij de link", () => {
  const html = renderBodyBlocks("Zie https://matoautomaat.be/prijzen.");
  assert.ok(html.includes('href="https://matoautomaat.be/prijzen"'));
  assert.ok(html.includes("</a>."));
});

test("een queryreeks met & overleeft het ontsnappen", () => {
  const html = renderBodyBlocks("https://x.be/a?b=1&c=2");
  // In een href is &amp; de juiste schrijfwijze van één ampersand.
  assert.ok(html.includes('href="https://x.be/a?b=1&amp;c=2"'));
  assert.ok(!html.includes("&c=2\""));
});

test("een mailadres wordt een mailto", () => {
  const html = renderBodyBlocks("Mail naar info@matoautomaat.be als het past.");
  assert.ok(html.includes('href="mailto:info@matoautomaat.be"'));
});

// Eén doorloop voor links en adressen samen: anders kan de tweede doorloop het
// adres binnen een href van de eerste nog eens aanpassen.
test("een adres in een link wordt niet dubbel verwerkt", () => {
  const html = renderBodyBlocks("https://x.be/mail/info@matoautomaat.be");
  assert.equal((html.match(/<a /g) ?? []).length, 1);
  assert.ok(!html.includes("mailto:"));
});

test("de volledige mail heeft de huisstijl en geen afbeelding die kan breken", () => {
  const html = renderMatoMail({ body: "Dag Xin,\n\nAlles is geregeld.", senderName: "Xin" });
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes("#a97a1f")); // het goud van de huisstijl
  assert.ok(html.includes("Space Grotesk"));
  assert.ok(html.includes("info@matoautomaat.be"));
  assert.ok(html.includes("Alles is geregeld."));
  // Het woordmerk is tekst: een geblokkeerde of kapotte afbeelding kan de kop
  // niet verpesten, zoals bij de gedrukte sjablonen wel gebeurde.
  assert.ok(!html.includes("<img"));
  // Outlook negeert flex en grid, dus de opmaak moet op tabellen staan.
  assert.ok(html.includes('role="presentation"'));
  assert.ok(!html.includes("display:flex"));
  // Een expliciete achtergrond, zodat een client in donkere modus de tekst niet
  // omklapt naar onleesbaar.
  assert.ok(html.includes("background-color:#faf7f1"));
});

test("zonder afzendernaam blijft er geen lege ondertekening staan", () => {
  const html = renderMatoMail({ body: "Kort bericht.", senderName: null });
  assert.ok(html.includes("Kort bericht."));
  assert.ok(!html.includes("<p style=\"margin:0;font-family:'Inter'"));
});

test("een lege body levert een geldige mail op in plaats van een fout", () => {
  const html = renderMatoMail({ body: "" });
  assert.ok(html.includes("<!doctype html>"));
  assert.ok(html.includes("MATO"));
});
