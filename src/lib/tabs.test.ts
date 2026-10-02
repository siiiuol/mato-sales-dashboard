import test from "node:test";
import assert from "node:assert/strict";
import {
  APP_MENU_NAV,
  APP_TABS,
  isTabActive,
  isTabHome,
  PLATFORM_ADMIN_NAV,
  tabFor,
} from "./constants";

// Deze test verving sections.test.ts, dat nog de oude secties-indeling
// (verkoop/reclame/klanten met eigen nav en Meer-menu) testte. Die is
// vervangen door één tabbalk van vier, dus de oude beweringen konden niet
// bijgewerkt worden — ze gingen over concepten die niet meer bestaan.

test("elke tab-home wijst naar zichzelf terug", () => {
  for (const tab of APP_TABS) {
    assert.equal(tabFor(tab.href).key, tab.key, `${tab.label} wijst naar zichzelf`);
  }
});

test("Vandaag is de terugval, dus geen pad is dakloos", () => {
  for (const pad of ["/", "", "/calls", "/team", "/settings", "/handleiding", "/wat-dan-ook"]) {
    assert.equal(tabFor(pad).key, "vandaag", `${pad} hoort bij Vandaag`);
  }
});

test("een genest pad blijft in zijn eigen tab", () => {
  assert.equal(tabFor("/leads/abc").key, "zaken");
  assert.equal(tabFor("/klantdocumenten/cmsir5yeh0080tyw1xktfslrr").key, "documenten");
  assert.equal(tabFor("/shop/nieuw").key, "shop");
});

test("reclame hoort bij Documenten", () => {
  assert.equal(tabFor("/reclame").key, "documenten");
  assert.equal(tabFor("/reclame/materiaal").key, "documenten");
});

test("isTabActive is exact op de home en prefix daaronder", () => {
  assert.equal(isTabActive("/", "/"), true);
  assert.equal(isTabActive("/", "/leads"), false);
  assert.equal(isTabActive("/leads", "/leads"), true);
  assert.equal(isTabActive("/leads", "/leads/abc"), true);
  // De reden dat isTabActive een eigen prefixcontrole heeft: /leadership is geen /leads.
  assert.equal(isTabActive("/leads", "/leadership"), false);
});

test("alleen tab-homes zijn een home", () => {
  for (const tab of APP_TABS) assert.equal(isTabHome(tab.href), true, `${tab.href} is een home`);
  assert.equal(isTabHome("/leads/abc"), false);
  assert.equal(isTabHome("/reclame"), false);
});

test("geen enkele tab-link staat dubbel", () => {
  const hrefs = APP_TABS.map((tab) => tab.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
});

test("de links achter de eigen naam zijn geen tab", () => {
  for (const item of [...APP_MENU_NAV, ...PLATFORM_ADMIN_NAV]) {
    assert.equal(isTabHome(item.href), false, `${item.href} staat dubbel`);
  }
});
