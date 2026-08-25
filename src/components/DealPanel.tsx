import {
  LOSS_REASONS,
  formatEUR,
} from "@/lib/constants";
import {
  closeDealWithHandoff,
  markDealLost,
  saveDeal,
} from "@/lib/deal-actions";

export type DealPanelDeal = {
  id: string;
  title: string;
  stage: string;
  expectedValue: number;
  probability: number;
  expectedCloseAt: Date | null;
  nextStep: string | null;
  expectedMachineCount: number;
  lines: Array<{
    productId: string;
    qty: number;
    unitPrice: number;
    product: { name: string };
  }>;
};

type ProductOption = {
  id: string;
  name: string;
  line: string;
  listPrice: number;
};

export function DealPanel({
  lead,
  deal,
  products,
}: {
  lead: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
  };
  deal: DealPanelDeal | null;
  products: ProductOption[];
}) {
  const line = deal?.lines[0];
  const defaultClose = new Date();
  defaultClose.setUTCDate(defaultClose.getUTCDate() + 30);

  return (
    <section className="panel p-4 space-y-4" id="deal">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="label text-[var(--accent)]">Open deal</h2>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Verwachting, kans, sluitdatum en eerstvolgende stap.
          </p>
        </div>
        {deal ? (
          <span className="badge badge-live">{deal.stage}</span>
        ) : (
          <span className="badge">Nog niet aangemaakt</span>
        )}
      </div>

      {deal ? (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <DealStat label="Waarde" value={formatEUR(deal.expectedValue)} />
          <DealStat label="Kans" value={`${deal.probability}%`} />
          <DealStat
            label="Sluitdatum"
            value={deal.expectedCloseAt?.toLocaleDateString("nl-BE") ?? "—"}
          />
          <DealStat label="Volgende stap" value={deal.nextStep ?? "—"} />
        </div>
      ) : null}

      <details open={!deal}>
        <summary className="text-sm font-medium cursor-pointer">
          {deal ? "Deal aanpassen" : "Deal aanmaken"}
        </summary>
        <form action={saveDeal} className="space-y-2 mt-3">
          <input type="hidden" name="leadId" value={lead.id} />
          <input type="hidden" name="dealId" value={deal?.id ?? ""} />
          <input
            name="title"
            className="input"
            required
            maxLength={200}
            defaultValue={deal?.title ?? `Verkoop ${lead.name}`}
            placeholder="Dealnaam"
          />
          <div className="grid grid-cols-2 gap-2">
            <select name="stage" className="select" defaultValue={deal?.stage ?? "QUALIFIED"}>
              <option value="QUALIFIED">Gekwalificeerd</option>
              <option value="PROPOSAL">Voorstel</option>
              <option value="NEGOTIATION">Onderhandeling</option>
            </select>
            <input
              name="probability"
              type="number"
              min={0}
              max={100}
              className="input"
              defaultValue={deal?.probability ?? 25}
              aria-label="Slaagkans in procent"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              name="expectedValue"
              type="number"
              min={0}
              step="1"
              className="input"
              required
              defaultValue={deal?.expectedValue ?? line?.unitPrice ?? 0}
              placeholder="Verwachte waarde"
            />
            <input
              name="expectedCloseAt"
              type="date"
              className="input"
              defaultValue={
                deal?.expectedCloseAt?.toISOString().slice(0, 10) ??
                defaultClose.toISOString().slice(0, 10)
              }
            />
          </div>
          <input
            name="nextStep"
            className="input"
            required
            maxLength={1000}
            defaultValue={deal?.nextStep ?? ""}
            placeholder="Volgende concrete stap"
          />
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <select name="productId" className="select" defaultValue={line?.productId ?? ""}>
              <option value="">Product nog te bepalen</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.line} · {product.name}
                </option>
              ))}
            </select>
            <input
              name="expectedMachineCount"
              type="number"
              min={1}
              max={100}
              className="input"
              defaultValue={deal?.expectedMachineCount ?? 1}
              aria-label="Aantal automaten"
            />
          </div>
          <input
            name="unitPrice"
            type="hidden"
            value={line?.unitPrice ?? deal?.expectedValue ?? 0}
          />
          <button type="submit" className="btn btn-primary w-full">
            Deal bewaren
          </button>
        </form>
      </details>

      {deal ? (
        <>
          <details>
            <summary className="text-sm font-medium cursor-pointer">
              Verkoop gewonnen — installatie starten
            </summary>
            <form action={closeDealWithHandoff} className="space-y-2 mt-3">
              <input type="hidden" name="leadId" value={lead.id} />
              <input type="hidden" name="dealId" value={deal.id} />
              <input
                name="title"
                className="input"
                required
                defaultValue={deal.title}
              />
              <input
                name="value"
                type="number"
                min={0}
                className="input"
                required
                defaultValue={deal.expectedValue}
                placeholder="Definitieve waarde"
              />
              <select
                name="productId"
                className="select"
                required
                defaultValue={line?.productId ?? ""}
              >
                <option value="" disabled>
                  Kies verkochte automaat…
                </option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.line} · {product.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="model" className="input" placeholder="Model" />
                <input
                  name="serialNumber"
                  className="input"
                  placeholder="Serienummer"
                />
              </div>
              <input
                name="address"
                className="input"
                required
                defaultValue={lead.address ?? ""}
                placeholder="Installatieadres"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="city"
                  className="input"
                  required
                  defaultValue={lead.city ?? ""}
                  placeholder="Plaats"
                />
                <input name="installAt" type="date" className="input" />
              </div>
              <button type="submit" className="btn btn-primary w-full">
                Win registreren en installatietaken maken
              </button>
            </form>
          </details>

          <details>
            <summary className="text-xs text-[var(--text-dim)] cursor-pointer">
              Deal verloren
            </summary>
            <form action={markDealLost} className="flex gap-2 mt-2">
              <input type="hidden" name="leadId" value={lead.id} />
              <input type="hidden" name="dealId" value={deal.id} />
              <select name="lossReason" className="select" required defaultValue="">
                <option value="" disabled>
                  Reden…
                </option>
                {LOSS_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn">
                Afsluiten
              </button>
            </form>
          </details>
        </>
      ) : null}
    </section>
  );
}

function DealStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-2)] p-3">
      <span className="label">{label}</span>
      <span className="block text-sm mt-1">{value}</span>
    </div>
  );
}
