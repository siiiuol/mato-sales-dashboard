import test from "node:test";
import assert from "node:assert/strict";
import {
  APP_TABS,
  PLATFORM_ADMIN_NAV,
  isTabActive,
  isTabHome,
  tabFor,
} from "./constants";

test("the four tabs are Vandaag, Zaken, Documenten, Shop", () => {
  assert.deepEqual(
    APP_TABS.map((tab) => tab.href),
    ["/", "/leads", "/klantdocumenten", "/shop"]
  );
  assert.deepEqual(
    APP_TABS.map((tab) => tab.label),
    ["Vandaag", "Zaken", "Documenten", "Shop"]
  );
});

test("a nested zaak path stays on Zaken", () => {
  assert.equal(tabFor("/leads").key, "zaken");
  assert.equal(tabFor("/leads/abc").key, "zaken");
});

test("documenten owns klantdocumenten and old reclame URLs", () => {
  assert.equal(tabFor("/klantdocumenten").key, "documenten");
  assert.equal(tabFor("/klantdocumenten/werkblad.html").key, "documenten");
  assert.equal(tabFor("/reclame").key, "documenten");
  assert.equal(tabFor("/reclame/materiaal").key, "documenten");
});

test("shop owns /shop paths", () => {
  assert.equal(tabFor("/shop").key, "shop");
  assert.equal(tabFor("/shop/nieuw").key, "shop");
  assert.equal(tabFor("/shop/abc").key, "shop");
});

test("unknown paths fall back to Vandaag", () => {
  for (const pad of ["/", "/bellen", "/team", "/settings", "/handleiding", "/wat-dan-ook"]) {
    assert.equal(tabFor(pad).key, "vandaag", `${pad} valt terug op Vandaag`);
  }
});

test("a path that merely starts with the same letters is not the tab", () => {
  assert.equal(isTabActive("/leads", "/leadership"), false);
  assert.equal(isTabActive("/shop", "/shopping"), false);
});

test("only tab homes match exactly for Vandaag", () => {
  assert.equal(isTabHome("/"), true);
  assert.equal(isTabHome("/leads"), true);
  assert.equal(isTabHome("/klantdocumenten"), true);
  assert.equal(isTabHome("/shop"), true);
  assert.equal(isTabHome("/reclame"), false);
  assert.equal(isTabActive("/", "/"), true);
  assert.equal(isTabActive("/", "/leads"), false);
  assert.equal(isTabActive("/leads", "/leads/abc"), true);
});

test("every tab home resolves back to itself", () => {
  for (const tab of APP_TABS) {
    assert.equal(tabFor(tab.href).key, tab.key, `${tab.label} wijst naar zichzelf`);
  }
});

test("no tab href is duplicated", () => {
  const hrefs = APP_TABS.map((tab) => tab.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
});

test("the platform links belong to no tab", () => {
  const tabLinks = new Set<string>(APP_TABS.map((tab) => tab.href));
  for (const item of PLATFORM_ADMIN_NAV) {
    assert.equal(tabLinks.has(item.href), false, `${item.href} staat dubbel`);
  }
});

test("admin account menu is only Team and Instellingen", () => {
  assert.deepEqual(
    PLATFORM_ADMIN_NAV.map((item) => item.href),
    ["/team", "/settings"]
  );
});
