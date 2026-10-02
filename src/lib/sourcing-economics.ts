/**
 * Offertevergelijking voor packaging/sourcing.
 *
 * Bouwt voort op landedCost / sellPriceForMargin uit deal-economics.ts — die
 * velden stonden al op SupplierQuote maar werden nergens gerekend.
 */

import {
  landedCost,
  sellPriceForMargin,
  type LandedCostInput,
} from "./deal-economics";

export type QuoteCostInput = LandedCostInput & {
  id: string;
  supplierName: string;
  currency?: string;
  moq?: number | null;
  productionDays?: number | null;
  selected?: boolean;
};

export type RankedQuote = {
  id: string;
  supplierName: string;
  currency: string;
  moq: number | null;
  productionDays: number | null;
  selected: boolean;
  unitLandedEur: number;
  batchLandedEur: number;
  /** Adviesverkoopprijs bij requiredMarginPct, of null. */
  suggestedSellEur: number | null;
  /** Marge als fractie bij gegeven targetSellPrice, of null. */
  marginAtTarget: number | null;
  /** False als MOQ hoger is dan de gevraagde quantity. */
  passesMoq: boolean;
};

export type RankQuotesOptions = {
  quantity: number;
  requiredMarginPct?: number | null;
  targetSellPrice?: number | null;
  maxMoq?: number | null;
};

/**
 * Rangschikt offertes van laagste naar hoogste landed cost per stuk.
 * MOQ-overschrijdingen blijven zichtbaar maar zakken onderaan.
 */
export function rankSupplierQuotes(
  quotes: readonly QuoteCostInput[],
  options: RankQuotesOptions
): RankedQuote[] {
  const qty = Math.max(1, Math.floor(options.quantity || 1));
  const requiredMargin = options.requiredMarginPct ?? null;
  const targetSell = options.targetSellPrice ?? null;
  const maxMoq = options.maxMoq ?? null;

  const ranked = quotes.map((quote) => {
    const cost = landedCost({ ...quote, qty });
    const suggestedSellEur =
      requiredMargin != null && requiredMargin > 0
        ? sellPriceForMargin(cost.unitLandedEur, requiredMargin)
        : null;
    const marginAtTarget =
      targetSell != null && targetSell > 0 && cost.unitLandedEur > 0
        ? (targetSell - cost.unitLandedEur) / targetSell
        : null;
    const moq = quote.moq ?? null;
    const passesMoq =
      moq == null ||
      (moq <= qty && (maxMoq == null || moq <= maxMoq));

    return {
      id: quote.id,
      supplierName: quote.supplierName,
      currency: quote.currency ?? "USD",
      moq,
      productionDays: quote.productionDays ?? null,
      selected: Boolean(quote.selected),
      unitLandedEur: cost.unitLandedEur,
      batchLandedEur: cost.batchLandedEur,
      suggestedSellEur,
      marginAtTarget,
      passesMoq,
    };
  });

  return ranked.sort((a, b) => {
    if (a.passesMoq !== b.passesMoq) return a.passesMoq ? -1 : 1;
    if (a.unitLandedEur !== b.unitLandedEur) {
      return a.unitLandedEur - b.unitLandedEur;
    }
    return a.supplierName.localeCompare(b.supplierName, "nl");
  });
}

/** Euro weergave, 2 decimalen — packagingprijzen zijn vaak centen. */
export function euroCents(amount: number): string {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
