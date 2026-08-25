import assert from "node:assert/strict";
import test from "node:test";
import { encryptSecret, SecretError } from "./secrets";
import {
  hasSettingSecret,
  readSettingSecret,
  storeSettingSecret,
} from "./settings-secrets";

test("bestaande platte instellingen blijven tijdelijk leesbaar", () => {
  assert.equal(readSettingSecret("oude-sleutel"), "oude-sleutel");
});

test("nieuwe instellingen worden versleuteld en opnieuw leesbaar", () => {
  const stored = storeSettingSecret("mijn-zeer-geheime-api-sleutel");
  assert.ok(stored?.startsWith("v1."));
  assert.equal(readSettingSecret(stored), "mijn-zeer-geheime-api-sleutel");
});

test("een versleutelde instelling wordt niet dubbel versleuteld", () => {
  const stored = storeSettingSecret("mijn-zeer-geheime-api-sleutel");
  assert.equal(storeSettingSecret(stored), stored);
});

test("een onleesbaar versleuteld geheim vraagt om opnieuw in te vullen", () => {
  const stored = encryptSecret("clientgeheim");
  const parts = stored.split(".");
  parts[3] = parts[3].replace(/.$/, parts[3].endsWith("A") ? "B" : "A");
  assert.throws(() => readSettingSecret(parts.join(".")), SecretError);
});

test("lege instellingen worden consequent behandeld", () => {
  assert.equal(readSettingSecret(""), "");
  assert.equal(storeSettingSecret(""), "");
  assert.equal(storeSettingSecret(undefined), undefined);
  assert.equal(hasSettingSecret(""), false);
  assert.equal(hasSettingSecret("v1.test"), true);
});
