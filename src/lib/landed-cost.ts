/**
 * Landed cost calculator (spec §25).
 * All monetary inputs are in the supplier quote currency; `fxToEur` converts
 * them to EUR (EUR = amount × fxToEur). Customs is applied on goods + freight
 * (CIF approximation); contingency on the running subtotal.
 */

export type LandedCostInput = {
  quantity: number;
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
  /** EUR per unit; enables profit, margin and break-even outputs. */
  targetSellPrice?: number | null;
};

export type LandedCostResult = {
  goodsCostEur: number;
  fixedCostsEur: number;
  shippingEur: number;
  customsEur: number;
  extraFeesEur: number;
  contingencyEur: number;
  totalOrderCostEur: number;
  landedUnitCostEur: number;
  grossProfitPerUnitEur: number | null;
  grossMarginPct: number | null;
  breakEvenQty: number | null;
};

export function calculateLandedCost(input: LandedCostInput): LandedCostResult {
  const qty = Math.max(0, input.quantity);
  const fx = input.fxToEur && input.fxToEur > 0 ? input.fxToEur : 1;
  const toEur = (v: number | undefined) => (v ?? 0) * fx;

  const goodsCostEur = qty * toEur(input.unitPrice);
  const fixedCostsEur =
    toEur(input.sampleCost) + toEur(input.setupCost) + toEur(input.mouldCost);
  const shippingEur = toEur(input.domesticShipping) + toEur(input.intlShipping);
  const customsEur = ((input.customsPct ?? 0) / 100) * (goodsCostEur + shippingEur);
  const extraFeesEur = toEur(input.extraFees);

  const subtotal =
    goodsCostEur + fixedCostsEur + shippingEur + customsEur + extraFeesEur;
  const contingencyEur = ((input.contingencyPct ?? 0) / 100) * subtotal;
  const totalOrderCostEur = subtotal + contingencyEur;
  const landedUnitCostEur = qty > 0 ? totalOrderCostEur / qty : 0;

  const sell = input.targetSellPrice ?? null;
  let grossProfitPerUnitEur: number | null = null;
  let grossMarginPct: number | null = null;
  let breakEvenQty: number | null = null;

  if (sell != null && sell > 0 && qty > 0) {
    grossProfitPerUnitEur = sell - landedUnitCostEur;
    grossMarginPct = (grossProfitPerUnitEur / sell) * 100;

    // Break-even: order-level costs recovered at the target selling price.
    // Variable per-unit cost = goods + customs-on-goods, scaled by contingency;
    // everything else in the order is treated as fixed.
    const contingencyFactor = 1 + (input.contingencyPct ?? 0) / 100;
    const unitVariable =
      toEur(input.unitPrice) * (1 + (input.customsPct ?? 0) / 100) * contingencyFactor;
    const orderFixed = totalOrderCostEur - unitVariable * qty;
    if (sell > unitVariable) {
      breakEvenQty = Math.ceil(orderFixed / (sell - unitVariable));
      if (breakEvenQty < 0) breakEvenQty = 0;
    }
  }

  return {
    goodsCostEur,
    fixedCostsEur,
    shippingEur,
    customsEur,
    extraFeesEur,
    contingencyEur,
    totalOrderCostEur,
    landedUnitCostEur,
    grossProfitPerUnitEur,
    grossMarginPct,
    breakEvenQty,
  };
}
