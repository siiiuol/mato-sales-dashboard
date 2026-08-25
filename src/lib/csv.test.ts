import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, toCsv } from "./csv";

test("CSV round-trips commas, quotes and line breaks", () => {
  const csv = toCsv(["name", "notes"], [["Bakker, Jan", 'Zegt "ja"\nlater']]);
  assert.deepEqual(parseCsv(csv), [
    ["name", "notes"],
    ["Bakker, Jan", 'Zegt "ja"\nlater'],
  ]);
});

test("CSV accepts semicolon-delimited files", () => {
  assert.deepEqual(parseCsv("naam;stad\nMATO;Diksmuide"), [
    ["naam", "stad"],
    ["MATO", "Diksmuide"],
  ]);
});

test("CSV rejects an unclosed quoted value", () => {
  assert.throws(() => parseCsv('name\n"open'), /aanhalingsteken/);
});
