/**
 * Brutowinst per deal — de rekenkern, zonder database.
 *
 * DealLine.unitCost is een momentopname: de kostprijs op het moment van de
 * deal, niet een join naar Product.cost. Zo blijft de winst van een oude deal
 * staan als de catalogusprijs later wijzigt.
 *
 * Als er geen kostprijs gezet is (alles nul), geeft `hasCostData` false terug
 * zodat de UI de marge kan verbergen in plaats van 100% te liegen.
 */

export type DealLineEconomics = {
  qty: number;
  unitPrice: number;
  /** Kostprijs per stuk op het moment van de deal. Ontbreekt = 0. */
  unitCost?: number;
};

export type DealEconomicsInput = {
  lines: readonly DealLineEconomics[];
  /** Korting in procent op de omzet (0–100). */
  discountPercent?: number;
  /** Eenmalige setupkost: transport, installatie, branding, terminal… */
  setupCost?: number;
  /** Maandelijkse kost die bij deze deal hoort (sim, telemetrie…). */
  monthlyCost?: number;
  /** Hoeveel maanden je meetelt voor de recurring-kost in dit overzicht. */
  monthlyHorizon?: number;
  /** Commissie die over deze deal uitbetaald wordt. */
  commissionCost?: number;
  /** Recurring omzet per maand (huur/commissie), optioneel. */
  recurringValue?: number;
};

export type DealEconomics = {
  /** Omzet na korting + recurring over de horizon. */
  revenue: number;
  /** Som van alle kostcomponenten. */
  cost: number;
  /** revenue − cost. */
  grossProfit: number;
  /**
   * Brutowinst als fractie van de omzet (0–1). `null` als er geen omzet is
   * of als er geen kostgegevens zijn — die twee gevallen liegen allebei als 0%.
   */
  margin: number | null;
  /** True als minstens één kost > 0 is gezet. */
  hasCostData: boolean;
  breakdown: {
    lineRevenue: number;
    discount: number;
    recurringRevenue: number;
    lineCost: number;
    setupCost: number;
    monthlyCostTotal: number;
    commissionCost: number;
  };
};

function nonNeg(n: number | undefined): number {
  if (n == null || Number.isNaN(n) || n < 0) return 0;
  return n;
}

/** Brutowinst en marge voor één deal. */
export function dealEconomics(input: DealEconomicsInput): DealEconomics {
  const discountPct = Math.min(100, nonNeg(input.discountPercent));
  const horizon = Math.max(0, Math.floor(nonNeg(input.monthlyHorizon) || 0));
  const setupCost = nonNeg(input.setupCost);
  const monthlyCost = nonNeg(input.monthlyCost);
  const commissionCost = nonNeg(input.commissionCost);
  const recurringValue = nonNeg(input.recurringValue);

  let lineRevenue = 0;
  let lineCost = 0;
  let hasLineCost = false;

  for (const line of input.lines) {
    const qty = Math.max(0, Math.floor(nonNeg(line.qty) || 0));
    const unitPrice = nonNeg(line.unitPrice);
    const unitCost = nonNeg(line.unitCost);
    lineRevenue += qty * unitPrice;
    lineCost += qty * unitCost;
    if (unitCost > 0) hasLineCost = true;
  }

  const discount = (lineRevenue * discountPct) / 100;
  const recurringRevenue = recurringValue * horizon;
  const monthlyCostTotal = monthlyCost * horizon;

  const revenue = lineRevenue - discount + recurringRevenue;
  const cost = lineCost + setupCost + monthlyCostTotal + commissionCost;
  const grossProfit = revenue - cost;

  const hasCostData =
    hasLineCost ||
    setupCost > 0 ||
    monthlyCostTotal > 0 ||
    commissionCost > 0;

  const margin =
    !hasCostData || revenue <= 0 ? null : grossProfit / revenue;

  return {
    revenue,
    cost,
    grossProfit,
    margin,
    hasCostData,
    breakdown: {
      lineRevenue,
      discount,
      recurringRevenue,
      lineCost,
      setupCost,
      monthlyCostTotal,
      commissionCost,
    },
  };
}

/**
 * Landed cost per stuk uit een leveranciersofferte — spiegelt de velden op
 * SupplierQuote die vandaag al in het schema staan maar nergens gerekend worden.
 */
export type LandedCostInput = {
  unitPrice: number;
  fxToEur?: number;
  sampleCost?: number;
  setupCost?: number;
  mouldCost?: number;
  domesticShipping?: number;
  intlShipping?: number;
  customsPct?: number;
  extraFees?: number;
  contingencyPct?: number;
  /** Hoeveel stuks je de eenmalige kosten over verdeelt. Minimaal 1. */
  qty?: number;
};

export type LandedCost = {
  /** Kost per stuk in euro, inclusief alle opslagen. */
  unitLandedEur: number;
  /** Totale kost voor de batch. */
  batchLandedEur: number;
};

export function landedCost(input: LandedCostInput): LandedCost {
  const qty = Math.max(1, Math.floor(nonNeg(input.qty) || 1));
  const fx = nonNeg(input.fxToEur) || 1;
  const unit = nonNeg(input.unitPrice) * fx;
  const oneOff =
    (nonNeg(input.sampleCost) +
      nonNeg(input.setupCost) +
      nonNeg(input.mouldCost) +
      nonNeg(input.domesticShipping) +
      nonNeg(input.intlShipping) +
      nonNeg(input.extraFees)) *
    fx;

  const goods = unit * qty;
  const withCustoms = goods * (1 + nonNeg(input.customsPct) / 100);
  const withContingency =
    (withCustoms + oneOff) * (1 + nonNeg(input.contingencyPct) / 100);

  return {
    batchLandedEur: withContingency,
    unitLandedEur: withContingency / qty,
  };
}

/**
 * Suggestie voor verkoopprijs bij een gewenste marge.
 * `requiredMarginPct` 40 → verkoop = kost / (1 − 0.40).
 * Geeft null als de marge ≥ 100% is (deling door nul).
 */
export function sellPriceForMargin(
  unitCost: number,
  requiredMarginPct: number
): number | null {
  const cost = nonNeg(unitCost);
  const margin = nonNeg(requiredMarginPct);
  if (margin >= 100) return null;
  return cost / (1 - margin / 100);
}
