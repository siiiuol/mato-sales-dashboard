"use client";

import { useState } from "react";
import { generateContract } from "@/lib/document-actions";

type Product = {
  id: string;
  name: string;
  line: string;
  listPrice: number;
};

/**
 * Contract maken voor deze lead.
 *
 * De prijs volgt de catalogusprijs zodra je een automaat kiest, maar blijft
 * aanpasbaar — er wordt in de praktijk onderhandeld, en een veld dat je niet
 * kunt overschrijven zou betekenen dat het contract niet klopt met wat er
 * afgesproken is.
 */
export function ContractForm({ leadId, products }: { leadId: string; products: Product[] }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [price, setPrice] = useState(String(products[0]?.listPrice ?? 0));
  const [quantity, setQuantity] = useState("1");

  const chosen = products.find((p) => p.id === productId);
  const total = (Number(price) || 0) * (Number(quantity) || 1);
  const vat = Math.round(total * 21) / 100;

  if (!products.length) {
    return (
      <p className="text-sm text-[var(--text-dim)]">
        Er staan nog geen producten in de catalogus.
      </p>
    );
  }

  return (
    <form action={generateContract} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />

      <label className="block">
        <span className="label">Wat verkoop je</span>
        <select
          name="productId"
          className="select mt-1"
          value={productId}
          onChange={(event) => {
            setProductId(event.target.value);
            const next = products.find((p) => p.id === event.target.value);
            if (next) setPrice(String(next.listPrice));
          }}
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="label">Aantal</span>
          <input
            name="quantity"
            type="number"
            min="1"
            step="1"
            className="input mt-1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Stukprijs excl. btw</span>
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            className="input mt-1"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>
      </div>

      {chosen && chosen.listPrice !== Number(price) && (
        <p className="text-xs text-[var(--text-dim)]">
          Catalogusprijs is € {chosen.listPrice.toLocaleString("nl-BE")} — je wijkt
          hiervan af.
        </p>
      )}

      <div className="text-sm border border-[var(--border)] px-3 py-2 space-y-0.5">
        <div className="flex justify-between">
          <span className="text-[var(--text-dim)]">Excl. btw</span>
          <span className="mono">€ {total.toLocaleString("nl-BE")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-dim)]">Btw 21%</span>
          <span className="mono">€ {vat.toLocaleString("nl-BE")}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>Incl. btw</span>
          <span className="mono">€ {(total + vat).toLocaleString("nl-BE")}</span>
        </div>
      </div>

      <label className="block">
        <span className="label">Betalingsafspraak</span>
        <input
          name="note"
          className="input mt-1"
          placeholder="50% voorschot, saldo bij levering"
          maxLength={500}
        />
      </label>

      <button type="submit" className="btn btn-primary w-full">
        Contract opmaken
      </button>
      <p className="text-xs text-[var(--text-dim)]">
        Jouw naam komt als dossierbeheerder op het contract te staan.
      </p>
    </form>
  );
}
