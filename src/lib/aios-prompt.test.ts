import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBriefPrompt,
  buildOchtendbriefPrompt,
  leadBlock,
} from "./aios-prompt";

test("leadBlock lists only known facts", () => {
  const block = leadBlock({
    name: "Bakkerij Test",
    city: "Gent",
    province: "Oost-Vlaanderen",
    category: "bakery",
    website: null,
    hasVending: false,
    vendingDetail: null,
    nearbyVending: 0,
    sellsTakeaway: true,
    phone: "09 000 00 00",
  });
  assert.match(block, /Bakkerij Test/);
  assert.match(block, /afhaal|mee te nemen/i);
  assert.match(block, /09 000/);
  assert.doesNotMatch(block, /verzin|€/);
});

test("brief prompt asks for koop or huur", () => {
  const prompt = buildBriefPrompt(
    {
      name: "Slager X",
      city: "Brugge",
      province: null,
      category: "butcher",
      website: null,
      hasVending: true,
      vendingDetail: "snack",
      nearbyVending: 0,
      sellsTakeaway: false,
    },
    "Louis"
  );
  assert.match(prompt, /koop\/huur/);
  assert.match(prompt, /Louis/);
});

test("ochtendbrief prompt includes leads and tasks", () => {
  const prompt = buildOchtendbriefPrompt({
    senderName: "Louis",
    leads: [
      {
        name: "Zaak",
        city: "Torhout",
        category: "bakery",
        status: "Opvolgen",
        phone: null,
        nextActionAt: null,
        lastContact: null,
        hasVending: false,
        nearbyVending: 1,
        sellsTakeaway: true,
      },
    ],
    tasks: [{ title: "Terugbellen", dueAt: "morgen", leadName: "Zaak" }],
  });
  assert.match(prompt, /Zaak/);
  assert.match(prompt, /Terugbellen/);
  assert.match(prompt, /automaathuur|productverkoop/);
});
