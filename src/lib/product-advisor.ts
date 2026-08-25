export type ProductAdvisorInput = {
  productType: "FOOD" | "DRINK" | "FROZEN" | "FLOWERS_GIFTS" | "MIXED";
  temperature: "AMBIENT" | "CHILLED" | "FROZEN";
  fragile: boolean;
  assortment: "SMALL" | "MEDIUM" | "LARGE";
  location: "INDOOR" | "OUTDOOR" | "SHOP";
};

export type ProductAdvice = {
  model: "B1" | "M1" | "S1" | "C1" | "F1" | "L1" | "T1";
  alternatives: string[];
  reason: string;
  caveat: string;
};

export function adviseProduct(input: ProductAdvisorInput): ProductAdvice {
  const locationNote =
    input.location === "OUTDOOR"
      ? "Bevestig buitenopstelling, bescherming en behuizing."
      : input.location === "SHOP"
        ? "Bevestig beschikbare plaats en winkelopstelling."
        : "Bevestig doorgang, stroom en binnenopstelling.";

  if (input.temperature === "FROZEN" || input.productType === "FROZEN") {
    return {
      model: "F1",
      alternatives: [],
      reason: "Diepvriesproducten vragen de F1 tot −20 °C met schuifbak.",
      caveat: `${locationNote} Temperatuurvereiste en productmaten blijven te controleren.`,
    };
  }
  if (input.productType === "FLOWERS_GIFTS") {
    return {
      model: "L1",
      alternatives: input.assortment === "LARGE" ? ["T1"] : [],
      reason: "Losse vakken en een indeling op maat passen bij bloemen, taarten en cadeaus.",
      caveat: `${locationNote} Vakmaten en eventuele koeling eerst bevestigen.`,
    };
  }
  if (input.fragile) {
    const model =
      input.assortment === "SMALL"
        ? "S1"
        : input.assortment === "MEDIUM"
          ? "M1"
          : "B1";
    return {
      model,
      alternatives: ["B1", "M1", "S1"].filter((candidate) => candidate !== model),
      reason: `Fragiele producten vragen een liftsysteem; ${model} past als eerste hint bij een ${assortmentLabel(input.assortment)} assortiment.`,
      caveat: `${locationNote} Capaciteit, productmaten en temperatuur bepalen de definitieve uitvoering.`,
    };
  }
  if (input.productType === "DRINK" && input.assortment !== "LARGE") {
    return {
      model: "C1",
      alternatives: input.assortment === "MEDIUM" ? ["T1"] : [],
      reason: "Blikjes en flessen passen bij het valsysteem van de C1.",
      caveat: `${locationNote} Bevestig formaat, capaciteit en koeling.`,
    };
  }
  if (input.assortment === "LARGE" || input.productType === "MIXED") {
    return {
      model: "T1",
      alternatives: input.productType === "DRINK" ? ["C1"] : ["B1", "M1"],
      reason: "Een groot of gemengd assortiment past bij bestellen via touchscreen en meerdere producten per aankoop.",
      caveat: `${locationNote} Fragiele producten kunnen alsnog een liftmodel vereisen.`,
    };
  }
  const model = input.assortment === "SMALL" ? "S1" : "M1";
  return {
    model,
    alternatives: model === "S1" ? ["M1"] : ["B1", "S1"],
    reason: `${model} is een eerste liftmodelhint voor dit assortiment en de gekozen temperatuur.`,
    caveat: `${locationNote} Vraag productmaten, aantallen en gewenste koeling na vóór een voorstel.`,
  };
}

function assortmentLabel(value: ProductAdvisorInput["assortment"]) {
  if (value === "SMALL") return "klein";
  if (value === "LARGE") return "groot";
  return "middelgroot";
}
