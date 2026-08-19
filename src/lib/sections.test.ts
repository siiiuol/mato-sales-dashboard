import test from "node:test";
import assert from "node:assert/strict";
import {
  isSectionHome,
  PLATFORM_ADMIN_NAV,
  SECTIONS,
  sectionFor,
} from "./constants";

test("the reclame home selects the reclame section", () => {
  assert.equal(sectionFor("/reclame").key, "reclame");
});

test("a nested reclame path stays in the reclame section", () => {
  // Anders springt de balk terug naar Verkoop zodra je een campagne opent.
  assert.equal(sectionFor("/reclame/materiaal").key, "reclame");
  assert.equal(sectionFor("/reclame/cmsir5yeh0080tyw1xktfslrr").key, "reclame");
});

test("verkoop is the fallback, so no path is homeless", () => {
  for (const pad of ["/", "/leads", "/leads/abc", "/calls", "/team", "/settings", "/wat-dan-ook"]) {
    assert.equal(sectionFor(pad).key, "verkoop", `${pad} hoort bij Verkoop`);
  }
});

test("a path that merely starts with the same letters is not the section", () => {
  // "/reclamefolder" is geen sectiepad; alleen "/reclame" en "/reclame/…".
  assert.equal(sectionFor("/reclamefolder").key, "verkoop");
});

test("only section homes match exactly", () => {
  assert.equal(isSectionHome("/"), true);
  assert.equal(isSectionHome("/reclame"), true);
  assert.equal(isSectionHome("/reclame/materiaal"), false);
  assert.equal(isSectionHome("/leads"), false);
});

test("every section has a home that resolves back to itself", () => {
  // Klik op de schakelaar en je komt in de sectie die oplicht — anders wijst de
  // balk naar iets anders dan waar je terechtkomt.
  for (const s of SECTIONS) {
    assert.equal(sectionFor(s.home).key, s.key, `${s.label} wijst naar zichzelf`);
  }
});

test("no section link is duplicated across sections, except the deliberate shared taken-link", () => {
  // /taken staat bewust in zowel Verkoop als Klanten: taken kunnen aan een lead
  // óf een klant hangen, en de medewerker wil ze op één plek zien ongeacht
  // welke sectie hij net verliet.
  const alle = SECTIONS.flatMap((s) => s.nav.map((n) => n.href));
  const gedeeld = new Set(["/taken"]);
  const zonderGedeelde = alle.filter((href) => !gedeeld.has(href));
  assert.equal(new Set(zonderGedeelde).size, zonderGedeelde.length);
  assert.equal(alle.filter((href) => href === "/taken").length, 2);
});

test("the platform links belong to no section", () => {
  // Team en Instellingen gelden overal; ze horen niet in één sectielijst thuis.
  const sectieLinks = new Set<string>(
    SECTIONS.flatMap((s) => s.nav.map((n) => n.href))
  );
  for (const item of PLATFORM_ADMIN_NAV) {
    assert.equal(sectieLinks.has(item.href), false, `${item.href} staat dubbel`);
  }
});

test("verkoop keeps its own routes, plus the shared taken-link", () => {
  const verkoop = SECTIONS[0];
  assert.deepEqual(
    verkoop.nav.map((n) => n.href),
    ["/", "/leads", "/taken"]
  );
});
