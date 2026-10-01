/**
 * Cross-sell- en hernieuwingssignalen uit bestaande klant-/plaatsingsdata.
 *
 * Puur — geen Prisma. De homepage levert rijen aan; hier wordt besloten welke
 * signalen scherp genoeg zijn om op Vandaag te tonen.
 */

export type PlacementSignalInput = {
  id: string;
  customerId: string;
  customerName: string;
  /** Lead-id als die nog bestaat — voor de link. */
  leadId?: string | null;
  site: string;
  status: string;
  contractEndsAt: Date | null;
  monthlyFee?: number;
  /** Laatste aankoopdatum voor deze klant, of null als er nooit gekocht is. */
  lastPurchaseAt?: Date | null;
  /** Heeft deze klant minstens één actieve plaatsing. */
  hasActiveMachine: boolean;
};

export type CrossSellSignal = {
  id: string;
  customerId: string;
  customerName: string;
  leadId: string | null;
  kind: "renewal" | "no_purchase" | "silent_machine";
  reason: string;
  /** Dagen tot contracteinde (negatief = al verlopen), of stilte-dagen. */
  urgencyDays: number;
};

export type CrossSellOptions = {
  /** Contracten die binnen zoveel dagen eindigen. Default 90. */
  renewalWithinDays?: number;
  /** Geen aankoop in zoveel dagen terwijl er een automaat staat. Default 90. */
  purchaseQuietDays?: number;
  now?: Date;
};

/**
 * Twee scherpe signalen eerst: contract dat bijna afloopt, en automaat zonder
 * recente afname. Zwakkere signalen houden we bewust buiten — die worden ruis.
 */
export function crossSellSignals(
  rows: readonly PlacementSignalInput[],
  options: CrossSellOptions = {}
): CrossSellSignal[] {
  const now = options.now ?? new Date();
  const renewalWithin = options.renewalWithinDays ?? 90;
  const quietDays = options.purchaseQuietDays ?? 90;
  const renewalMs = renewalWithin * 86_400_000;
  const quietMs = quietDays * 86_400_000;

  const signals: CrossSellSignal[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.status !== "ACTIVE") continue;

    if (row.contractEndsAt) {
      const msLeft = row.contractEndsAt.getTime() - now.getTime();
      if (msLeft <= renewalMs) {
        const days = Math.ceil(msLeft / 86_400_000);
        const key = `renewal:${row.customerId}:${row.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          signals.push({
            id: key,
            customerId: row.customerId,
            customerName: row.customerName,
            leadId: row.leadId ?? null,
            kind: "renewal",
            reason:
              days < 0
                ? `Contract verlopen · ${Math.abs(days)} d`
                : days === 0
                  ? "Contract eindigt vandaag"
                  : `Contract eindigt over ${days} d`,
            urgencyDays: days,
          });
        }
      }
    }

    if (row.hasActiveMachine) {
      const last = row.lastPurchaseAt?.getTime() ?? 0;
      const quiet = last === 0 || now.getTime() - last >= quietMs;
      if (quiet) {
        const daysSilent =
          last === 0
            ? quietDays
            : Math.floor((now.getTime() - last) / 86_400_000);
        const key = `nopurchase:${row.customerId}`;
        if (!seen.has(key)) {
          seen.add(key);
          signals.push({
            id: key,
            customerId: row.customerId,
            customerName: row.customerName,
            leadId: row.leadId ?? null,
            kind: last === 0 ? "silent_machine" : "no_purchase",
            reason:
              last === 0
                ? "Automaat zonder afname"
                : `${daysSilent} d geen aankoop`,
            urgencyDays: last === 0 ? 0 : daysSilent,
          });
        }
      }
    }
  }

  return signals.sort((a, b) => {
    // Hernieuwing eerst (kleinste days-to-end), dan stilte (grootste stilte).
    if (a.kind === "renewal" && b.kind !== "renewal") return -1;
    if (b.kind === "renewal" && a.kind !== "renewal") return 1;
    if (a.kind === "renewal" && b.kind === "renewal") {
      return a.urgencyDays - b.urgencyDays;
    }
    return b.urgencyDays - a.urgencyDays;
  });
}
