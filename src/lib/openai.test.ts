import test from "node:test";
import assert from "node:assert/strict";
import { OpenAiConfigError, parseDraft } from "./openai";

test("a well-formed answer yields subject and body", () => {
  const draft = parseDraft('{"subject":"Automaat","body":"Beste,\\n\\nGroeten"}');
  assert.equal(draft.subject, "Automaat");
  assert.match(draft.body, /Beste/);
});

test("surrounding whitespace is trimmed", () => {
  const draft = parseDraft('{"subject":"  Automaat  ","body":"  tekst  "}');
  assert.equal(draft.subject, "Automaat");
  assert.equal(draft.body, "tekst");
});

test("text that is not JSON is refused, not passed through", () => {
  // Zonder deze grens zou "Sorry, ik kan dat niet" als mailtekst naar een klant
  // gaan.
  assert.throws(() => parseDraft("Sorry, ik kan dat niet."), OpenAiConfigError);
});

test("a missing subject or body is refused", () => {
  assert.throws(() => parseDraft('{"body":"alleen tekst"}'), OpenAiConfigError);
  assert.throws(() => parseDraft('{"subject":"alleen onderwerp"}'), OpenAiConfigError);
});

test("an empty subject or body is refused", () => {
  // Een lege onderwerpregel is erger dan een fout: de mail vertrekt wel.
  assert.throws(() => parseDraft('{"subject":"","body":"tekst"}'), OpenAiConfigError);
  assert.throws(() => parseDraft('{"subject":"x","body":"   "}'), OpenAiConfigError);
});

test("non-string values are refused rather than coerced", () => {
  assert.throws(() => parseDraft('{"subject":42,"body":["a"]}'), OpenAiConfigError);
});

test("an empty key is caught before any request is made", async () => {
  // Anders zou er een aanroep vertrekken die gegarandeerd 401 teruggeeft.
  await assert.rejects(
    () =>
      import("./openai").then((m) =>
        m.draftMail({ apiKey: "   ", model: "x", system: "s", prompt: "p" })
      ),
    OpenAiConfigError
  );
});
