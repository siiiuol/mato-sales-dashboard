"use client";

import { useMemo, useState } from "react";
import {
  adviseProduct,
  type ProductAdvisorInput,
} from "@/lib/product-advisor";

export function ProductAdvisor({ category }: { category?: string | null }) {
  const [productType, setProductType] =
    useState<ProductAdvisorInput["productType"]>(() => inferType(category));
  const [temperature, setTemperature] =
    useState<ProductAdvisorInput["temperature"]>("CHILLED");
  const [fragile, setFragile] = useState(false);
  const [assortment, setAssortment] =
    useState<ProductAdvisorInput["assortment"]>("MEDIUM");
  const [location, setLocation] =
    useState<ProductAdvisorInput["location"]>("OUTDOOR");
  const advice = useMemo(
    () =>
      adviseProduct({
        productType,
        temperature,
        fragile,
        assortment,
        location,
      }),
    [assortment, fragile, location, productType, temperature]
  );

  return (
    <section className="panel p-4 space-y-3">
      <div>
        <h3 className="label text-[var(--accent)]">Productkeuze-assistent</h3>
        <p className="text-xs text-[var(--text-dim)] mt-1">
          Eerste modelhint; uitvoering, beschikbaarheid en prijs altijd bevestigen.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Producttype">
          <select
            className="select"
            value={productType}
            onChange={(event) =>
              setProductType(event.target.value as ProductAdvisorInput["productType"])
            }
          >
            <option value="FOOD">Food</option>
            <option value="DRINK">Drank</option>
            <option value="FROZEN">Diepvries / ijs</option>
            <option value="FLOWERS_GIFTS">Bloemen / cadeaus / losse vakken</option>
            <option value="MIXED">Gemengd assortiment</option>
          </select>
        </Field>
        <Field label="Temperatuur">
          <select
            className="select"
            value={temperature}
            onChange={(event) =>
              setTemperature(
                event.target.value as ProductAdvisorInput["temperature"]
              )
            }
          >
            <option value="AMBIENT">Ongekoeld</option>
            <option value="CHILLED">Gekoeld</option>
            <option value="FROZEN">Diepvries</option>
          </select>
        </Field>
        <Field label="Assortiment">
          <select
            className="select"
            value={assortment}
            onChange={(event) =>
              setAssortment(
                event.target.value as ProductAdvisorInput["assortment"]
              )
            }
          >
            <option value="SMALL">Klein</option>
            <option value="MEDIUM">Middelgroot</option>
            <option value="LARGE">Groot</option>
          </select>
        </Field>
        <Field label="Locatie">
          <select
            className="select"
            value={location}
            onChange={(event) =>
              setLocation(event.target.value as ProductAdvisorInput["location"])
            }
          >
            <option value="INDOOR">Binnen bij klant</option>
            <option value="OUTDOOR">Buiten</option>
            <option value="SHOP">MATO Automatenshop</option>
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={fragile}
          onChange={(event) => setFragile(event.target.checked)}
        />
        Fragiel product (brood, gebak, taart…)
      </label>
      <div className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-3">
        <span className="label">Eerste hint</span>
        <p className="display text-2xl mt-1">MATO {advice.model}</p>
        <p className="text-sm mt-1">{advice.reason}</p>
        {advice.alternatives.length ? (
          <p className="text-xs text-[var(--text-dim)] mt-2">
            Alternatieven om te vergelijken: {advice.alternatives.join(", ")}
          </p>
        ) : null}
        <p className="text-xs text-[var(--text-dim)] mt-2">{advice.caveat}</p>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs text-[var(--text-dim)]">
      {label}
      <span className="block mt-1">{children}</span>
    </label>
  );
}

function inferType(category?: string | null): ProductAdvisorInput["productType"] {
  const value = (category ?? "").toLowerCase();
  if (/ijs|ice|gelato|frozen/.test(value)) return "FROZEN";
  if (/bloem|florist|gift|cadeau/.test(value)) return "FLOWERS_GIFTS";
  if (/drank|drink|café|cafe/.test(value)) return "DRINK";
  return "FOOD";
}
