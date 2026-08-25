import assert from "node:assert/strict";
import test from "node:test";
import { fillTemplate } from "./documents";
import { productImageMarkdown } from "./product-image";

test("productfoto wordt markdown-afbeelding of spatie zonder url", () => {
  assert.equal(
    productImageMarkdown("MATO Mini", "/uploads/product.jpg"),
    "![MATO Mini](/uploads/product.jpg)"
  );
  assert.equal(productImageMarkdown("X", null), " ");
  assert.equal(productImageMarkdown("X", "  "), " ");
});

test("preview-context vult productfoto in het sjabloon", () => {
  const body = "Artikel\n\n{{product_afbeelding}}\n\nKlaar";
  const withPhoto = fillTemplate(body, {
    product_afbeelding: productImageMarkdown("Automaat", "https://cdn.example/p.png"),
  });
  assert.match(withPhoto, /!\[Automaat\]\(https:\/\/cdn\.example\/p\.png\)/);

  const without = fillTemplate(body, {
    product_afbeelding: productImageMarkdown("Automaat", null),
  });
  assert.equal(without.includes("{{product_afbeelding}}"), false);
});
