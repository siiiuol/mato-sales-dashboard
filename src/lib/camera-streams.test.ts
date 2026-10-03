import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCameraStreams } from "./camera-streams";

test("leest naam en link van één regel", () => {
  const streams = parseCameraStreams(
    "Automaat 1 & 2 = https://monitor.ui.com/29f7fba6-7aa3-4159-af40-d2cae7c5f7ae"
  );
  assert.deepEqual(streams, [
    {
      name: "Automaat 1 & 2",
      url: "https://monitor.ui.com/29f7fba6-7aa3-4159-af40-d2cae7c5f7ae",
    },
  ]);
});

test("slaat lege regels en commentaar over", () => {
  const streams = parseCameraStreams(
    ["# buiten gebruik", "", "  ", "Gang = https://monitor.ui.com/abc-123"].join("\n")
  );
  assert.equal(streams.length, 1);
  assert.equal(streams[0].name, "Gang");
});

test("een regel zonder naam krijgt de code als naam", () => {
  const streams = parseCameraStreams("https://monitor.ui.com/abc-123");
  assert.equal(streams[0].name, "abc-123");
});

test("leegte levert niets op", () => {
  assert.deepEqual(parseCameraStreams(""), []);
  assert.deepEqual(parseCameraStreams(null), []);
  assert.deepEqual(parseCameraStreams(undefined), []);
});

// De kern van deze module: wat hier doorheen komt, wordt in een iframe gezet.
// Alles buiten de deelpagina van UniFi hoort geweigerd te worden, anders kan wie
// bij Instellingen kan een willekeurige pagina in het dashboard hangen.
test("weigert alles wat niet de deelpagina van UniFi is", () => {
  const geweigerd = [
    "Kwaad = https://kwaadaardig.example/pagina",
    "Http = http://monitor.ui.com/abc-123",
    "Subdomein = https://monitor.ui.com.kwaad.example/abc",
    "Pad = https://monitor.ui.com/abc/../../iets",
    "Script = javascript:alert(1)",
    "Data = data:text/html,<script>alert(1)</script>",
    "Console = https://unifi.ui.com/consoles/abc/protect",
    "Querystring = https://monitor.ui.com/abc?next=https://kwaad.example",
  ].join("\n");
  assert.deepEqual(parseCameraStreams(geweigerd), []);
});

test("goede en foute regels door elkaar: alleen de goede blijven", () => {
  const streams = parseCameraStreams(
    [
      "Goed = https://monitor.ui.com/aaa-111",
      "Fout = https://kwaadaardig.example/bbb",
      "Ook goed = https://monitor.ui.com/ccc-333",
    ].join("\n")
  );
  assert.deepEqual(
    streams.map((s) => s.name),
    ["Goed", "Ook goed"]
  );
});

test("spaties rond naam en link doen er niet toe", () => {
  const streams = parseCameraStreams("   Gang   =   https://monitor.ui.com/abc-123   ");
  assert.deepEqual(streams, [{ name: "Gang", url: "https://monitor.ui.com/abc-123" }]);
});
