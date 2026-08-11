/**
 * De rekenkant van het medewerkersoverzicht.
 *
 * Bewust zonder database-afhankelijkheid: dit is geld, en geld hoort testbaar
 * te zijn zonder server. De queries staan in de pagina's zelf.
 */

export type CommissionSettings = {
  /** PERCENT = deel van de dealwaarde · FIXED = vast bedrag per verkoop. */
  commissionType: string;
  commissionValue: number;
};

/**
 * Wat één verkoop deze medewerker oplevert aan commissie.
 *
 * Een vast bedrag staat los van de dealwaarde — dat is precies het punt van die
 * afspraak, dus een deal van nul euro levert nog steeds het vaste bedrag op.
 */
export function commissionForDeal(
  employee: CommissionSettings,
  dealValue: number
): number {
  if (employee.commissionType === "FIXED") return employee.commissionValue;
  return (dealValue * employee.commissionValue) / 100;
}

/** De commissie over een reeks verkopen. */
export function commissionForDeals(
  employee: CommissionSettings,
  dealValues: readonly number[]
): number {
  return dealValues.reduce(
    (total, value) => total + commissionForDeal(employee, value),
    0
  );
}

export type RoiInput = {
  /** Omzet die deze persoon binnenhaalde in de periode. */
  revenue: number;
  /** Wat de persoon in die periode kostte, los van commissie. */
  cost: number;
  /** Uitbetaalde commissie over diezelfde periode. */
  commission: number;
};

export type Roi = {
  totalCost: number;
  profit: number;
  /**
   * Omzet gedeeld door totale kost. `null` wanneer de kost nul is: dan is er
   * geen verhouding te berekenen, en "oneindig" op een dashboard zetten liegt.
   */
  ratio: number | null;
};

export function roi({ revenue, cost, commission }: RoiInput): Roi {
  const totalCost = cost + commission;
  return {
    totalCost,
    profit: revenue - totalCost,
    ratio: totalCost > 0 ? revenue / totalCost : null,
  };
}

/**
 * Hoeveel van de gebelde zaken tot een gesprek leidden.
 *
 * `null` bij nul gesprekken — nog niemand gebeld is iets anders dan nul procent
 * scoren, en dat verschil hoort op het scherm te blijven staan.
 */
export function conversionRate(won: number, calls: number): number | null {
  if (calls <= 0) return null;
  return won / calls;
}

/** Sorteert medewerkers op wat ze opbrachten; de beste eerst. */
export function rankByRevenue<T extends { revenue: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.revenue - a.revenue);
}

/**
 * Sleutel per kalenderdag in lokale tijd.
 *
 * Bewust niet via `toISOString()`: dat rekent naar UTC, waardoor een gesprek van
 * een uur 's avonds in de Belgische zomertijd op de volgende dag zou belanden.
 */
function dayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export type DayBucket = { key: string; label: string; count: number };

/**
 * Telt datums per dag over een aaneengesloten reeks die vandaag eindigt.
 *
 * Dagen zonder activiteit blijven als nul in de reeks staan. Ze weglaten zou de
 * grafiek laten liegen: een week stilte zou dan hetzelfde beeld geven als een
 * week doorwerken.
 */
export function bucketByDay(
  dates: readonly Date[],
  days: number,
  now: Date = new Date()
): DayBucket[] {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const key = dayKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const buckets: DayBucket[] = [];
  for (let back = days - 1; back >= 0; back--) {
    const day = new Date(now);
    // setDate loopt vanzelf over maand- en jaargrenzen heen.
    day.setDate(day.getDate() - back);
    const key = dayKey(day);
    buckets.push({
      key,
      label: `${day.getDate()}/${day.getMonth() + 1}`,
      count: counts.get(key) ?? 0,
    });
  }
  return buckets;
}

/** Euro's zoals ze in België geschreven worden. */
export function euro(amount: number): string {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function percent(fraction: number | null): string {
  if (fraction === null) return "—";
  return `${Math.round(fraction * 100)}%`;
}
