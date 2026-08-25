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
  assert.equal(sectionFor("/reclame/materiaal").key, "reclame");
  assert.equal(sectionFor("/reclame/cmsir5yeh0080tyw1xktfslrr").key, "reclame");
});

test("shop section owns /shop paths", () => {
  assert.equal(sectionFor("/shop").key, "shop");
  assert.equal(sectionFor("/shop/nieuw").key, "shop");
  assert.equal(sectionFor("/shop/abc").key, "shop");
});

test("verkoop is the fallback, so no path is homeless", () => {
  for (const pad of [
    "/",
    "/leads",
    "/leads/abc",
    "/calls",
    "/team",
    "/settings",
    "/handleiding",
    "/wat-dan-ook",
  ]) {
    assert.equal(sectionFor(pad).key, "verkoop", `${pad} hoort bij Verkoop`);
  }
});

test("a path that merely starts with the same letters is not the section", () => {
  assert.equal(sectionFor("/reclamefolder").key, "verkoop");
});

test("only section homes match exactly", () => {
  assert.equal(isSectionHome("/"), true);
  assert.equal(isSectionHome("/reclame"), true);
  assert.equal(isSectionHome("/reclame/materiaal"), false);
  assert.equal(isSectionHome("/leads"), false);
});

test("every section has a home that resolves back to itself", () => {
  for (const s of SECTIONS) {
    assert.equal(sectionFor(s.home).key, s.key, `${s.label} wijst naar zichzelf`);
  }
});

test("no primary nav link is duplicated across sections", () => {
  const alle = SECTIONS.flatMap((s) => s.nav.map((n) => n.href));
  assert.equal(new Set(alle).size, alle.length);
});

test("the platform links belong to no section", () => {
  const sectieLinks = new Set<string>(
    SECTIONS.flatMap((s) => s.nav.map((n) => n.href))
  );
  for (const item of PLATFORM_ADMIN_NAV) {
    assert.equal(sectieLinks.has(item.href), false, `${item.href} staat dubbel`);
  }
});

test("verkoop primary nav is the four daily sales routes", () => {
  const verkoop = SECTIONS[0];
  assert.deepEqual(
    verkoop.nav.map((n) => n.href),
    ["/", "/bellen", "/leads", "/deals"]
  );
  assert.deepEqual(
    verkoop.more.map((n) => n.href),
    ["/aios", "/rapporten", "/taken", "/handleiding"]
  );
});

test("shop and klanten keep secondary routes out of the primary bar", () => {
  assert.deepEqual(
    SECTIONS.find((s) => s.key === "shop")?.nav.map((n) => n.href),
    ["/shop"]
  );
  assert.deepEqual(
    SECTIONS.find((s) => s.key === "klanten")?.nav.map((n) => n.href),
    ["/klanten"]
  );
  assert.deepEqual(
    SECTIONS.find((s) => s.key === "reclame")?.nav.map((n) => n.href),
    ["/reclame"]
  );
});
