"use client";

import { useMemo, useState } from "react";
import { generateContract } from "@/lib/document-actions";
import { CONTRACT_BODY, CONTRACT_DEFAULTS } from "@/lib/contract-template";
import { documentAmount, priceBreakdown } from "@/lib/documents";
import { productImageMarkdown } from "@/lib/product-image";
import { DocumentLivePreview } from "@/components/DocumentLivePreview";

type Product = {
  id: string;
  name: string;
  line: string;
  listPrice: number;
  imageUrl?: string | null;
};

type LeadPreview = {
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  phone: string | null;
};

/**
 * Contract maken met live preview terwijl u product, prijs en aantal kiest.
 */
export function ContractForm({
  leadId,
  dealId,
  products,
  lead,
}: {
  leadId: string;
  dealId?: string | null;
  products: Product[];
  lead: LeadPreview;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [price, setPrice] = useState(String(products[0]?.listPrice ?? 0));
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");

  const chosen = products.find((p) => p.id === productId);
  const qty = Number(quantity) || 1;
  const unit = Number(price) || 0;
  const total = unit * qty;
  const { net, vat, gross } = priceBreakdown(total);

  const context = useMemo(
    () => ({
      ...CONTRACT_DEFAULTS,
      documentnummer: "VOORBEELD",
      datum: new Date().toLocaleDateString("nl-BE"),
      verkoper_medewerker: "…",
      plaats: lead.city ?? "",
      klant_naam: lead.name,
      klant_adres: lead.address ?? "",
      klant_gemeente: [lead.city, lead.province].filter(Boolean).join(", "),
      klant_telefoon: lead.phone ?? "",
      artikel_naam: chosen?.name ?? "",
      artikel_omschrijving: "",
      product_afbeelding: productImageMarkdown(
        chosen?.name ?? "Product",
        chosen?.imageUrl
      ),
      aantal: String(qty),
      prijs_excl: documentAmount(net),
      btw_bedrag: documentAmount(vat),
      prijs_incl: documentAmount(gross),
      leveringsadres: [lead.address, lead.city].filter(Boolean).join(", "),
      ...(note.trim()
        ? { betalingsvoorwaarden: note.trim() }
        : {}),
    }),
    [chosen, gross, lead, net, note, qty, vat]
  );

  if (!products.length) {
    return (
      <p className="text-sm text-[var(--text-dim)]">
        Er staan nog geen producten in de catalogus.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form action={generateContract} className="space-y-2">
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="dealId" value={dealId ?? ""} />

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
                {product.listPrice > 0
                  ? ` · € ${product.listPrice}`
                  : " · prijs op aanvraag"}
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
            Catalogusprijs is € {chosen.listPrice.toLocaleString("nl-BE")} — u
            wijkt hiervan af.
          </p>
        )}

        <div className="text-sm border border-[var(--border)] px-3 py-2 space-y-0.5">
          <div className="flex justify-between">
            <span className="text-[var(--text-dim)]">Excl. btw</span>
            <span className="mono">€ {net.toLocaleString("nl-BE")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-dim)]">Btw 21%</span>
            <span className="mono">€ {vat.toLocaleString("nl-BE")}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Incl. btw</span>
            <span className="mono">€ {gross.toLocaleString("nl-BE")}</span>
          </div>
        </div>

        <label className="block">
          <span className="label">Betalingsafspraak</span>
          <input
            name="note"
            className="input mt-1"
            placeholder="50% voorschot, saldo bij levering"
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        <button type="submit" className="btn btn-primary w-full btn-press">
          Contract opmaken
        </button>
        <p className="text-xs text-[var(--text-dim)]">
          Uw naam komt als dossierbeheerder op het contract te staan.
        </p>
      </form>

      <DocumentLivePreview
        templateBody={CONTRACT_BODY}
        context={context}
        title="Live contractvoorbeeld"
      />
    </div>
  );
}
