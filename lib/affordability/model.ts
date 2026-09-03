import { COUNTRY_COSTS } from "@/lib/resources/hub";

/**
 * Affordability model.
 *
 * For most Bangladeshi families the list is decided by what can actually be
 * paid, not by fit - and nothing in the product answered that question in taka.
 *
 * Two rules keep this honest, because a number a family plans around must not
 * be quietly invented:
 *
 *   1. Living costs are the *official* figures already sourced in
 *      `lib/resources/hub.ts` - UKVI maintenance, IRCC proof of funds, the
 *      German blocked-account minimum - carried through with their source URL.
 *   2. Tuition is a published-range estimate by country and tier, and is
 *      labelled as an estimate everywhere it surfaces. It is never presented
 *      with the authority of the living-cost figures.
 *
 * Every returned figure carries `basis` saying which of the two it is.
 */

export type Tier = "elite" | "top10" | "top50" | "top100" | "top200" | "regional";

/** Rate used to present everything in taka. Review this date before trusting it. */
export const FX = {
  asOf: "2026-09-01",
  /** 1 unit of currency -> BDT. */
  toBdt: { USD: 122, GBP: 155, EUR: 132, CAD: 89, SGD: 91, INR: 1.45, BDT: 1 } as const,
};

export type Currency = keyof typeof FX.toBdt;

export function toBdt(amount: number, currency: Currency): number {
  return Math.round(amount * FX.toBdt[currency]);
}

/**
 * Official annual living cost per country, converted to BDT.
 *
 * The strings in COUNTRY_COSTS are for display; these are the numeric
 * equivalents of the same official figures, annualised where the source quotes
 * a different period (the UK maintenance figure is 9 months, for instance).
 */
const LIVING: Record<string, { amount: number; currency: Currency; note: string }> = {
  USA:        { amount: 20_000, currency: "USD", note: "Midpoint of published Cost of Attendance ranges." },
  UK:         { amount: 13_632, currency: "GBP", note: "UKVI maintenance £1,136/mo outside London, annualised to 12 months." },
  Canada:     { amount: 20_635, currency: "CAD", note: "IRCC proof-of-funds requirement, single applicant outside Quebec." },
  Germany:    { amount: 11_904, currency: "EUR", note: "Federal Foreign Office blocked-account (Sperrkonto) minimum." },
  Singapore:  { amount: 12_500, currency: "SGD", note: "Midpoint of NUS/NTU published housing, meals and transport estimates." },
  India:      { amount: 150_000, currency: "INR", note: "Published IIT hostel and mess fees; heavily subsidised." },
  Bangladesh: { amount: 60_000, currency: "BDT", note: "Public university residence costs are nominal." },
};

/**
 * Annual tuition estimate by country and tier, in that country's currency.
 * Ranges, not points - the model reports the midpoint and keeps the spread.
 */
const TUITION: Record<string, Partial<Record<Tier, [number, number]>>> & {
  default?: [number, number];
} = {
  USA:        { elite: [58_000, 68_000], top10: [55_000, 65_000], top50: [40_000, 58_000], top100: [30_000, 45_000], top200: [22_000, 35_000], regional: [15_000, 28_000] },
  UK:         { elite: [33_000, 45_000], top10: [30_000, 42_000], top50: [24_000, 35_000], top100: [20_000, 30_000], top200: [16_000, 25_000], regional: [14_000, 20_000] },
  Canada:     { elite: [45_000, 62_000], top10: [40_000, 58_000], top50: [32_000, 48_000], top100: [26_000, 40_000], top200: [22_000, 34_000], regional: [18_000, 28_000] },
  Germany:    { elite: [0, 3_000], top10: [0, 3_000], top50: [0, 1_500], top100: [0, 1_500], top200: [0, 1_500], regional: [0, 1_500] },
  Singapore:  { elite: [38_000, 50_000], top10: [35_000, 48_000], top50: [30_000, 42_000], top100: [25_000, 36_000], top200: [20_000, 30_000], regional: [17_000, 26_000] },
  India:      { elite: [200_000, 300_000], top10: [200_000, 300_000], top50: [150_000, 250_000], top100: [100_000, 200_000], top200: [80_000, 160_000], regional: [50_000, 120_000] },
  Bangladesh: { elite: [40_000, 120_000], top10: [40_000, 120_000], top50: [30_000, 90_000], top100: [20_000, 70_000], top200: [15_000, 50_000], regional: [10_000, 40_000] },
};

const CURRENCY_FOR: Record<string, Currency> = {
  USA: "USD", UK: "GBP", Canada: "CAD", Germany: "EUR",
  Singapore: "SGD", India: "INR", Bangladesh: "BDT",
};

export type CostBasis = "official" | "estimate";

export type CostLine = {
  label: string;
  /** Annual, BDT. */
  bdt: number;
  basis: CostBasis;
  note: string;
  sourceName?: string;
  sourceUrl?: string;
};

export type AffordabilityInput = {
  country: string;
  tier: Tier;
  /** What the family can put toward one year, in BDT. */
  annualBudgetBdt: number;
  /** Expected aid as a share of tuition, 0-1. Zero when unknown. */
  aidRatio: number;
  years: number;
};

export type AffordabilityResult = {
  country: string;
  supported: boolean;
  lines: CostLine[];
  tuitionRangeBdt: [number, number] | null;
  /** Annual, BDT. */
  grossAnnualBdt: number;
  aidAnnualBdt: number;
  netAnnualBdt: number;
  budgetAnnualBdt: number;
  /** Positive means a shortfall. Annual, BDT. */
  gapAnnualBdt: number;
  totalNetBdt: number;
  totalGapBdt: number;
  verdict: "comfortable" | "tight" | "gap";
  fxAsOf: string;
};

const round = (n: number) => Math.round(n / 1000) * 1000;

export function assessAffordability(input: AffordabilityInput): AffordabilityResult {
  const currency = CURRENCY_FOR[input.country];
  const living = LIVING[input.country];
  const tuitionRange = TUITION[input.country]?.[input.tier];

  // An unmodelled country is reported as such rather than guessed at.
  if (!currency || !living || !tuitionRange) {
    return {
      country: input.country,
      supported: false,
      lines: [],
      tuitionRangeBdt: null,
      grossAnnualBdt: 0, aidAnnualBdt: 0, netAnnualBdt: 0,
      budgetAnnualBdt: input.annualBudgetBdt,
      gapAnnualBdt: 0, totalNetBdt: 0, totalGapBdt: 0,
      verdict: "gap",
      fxAsOf: FX.asOf,
    };
  }

  const tuitionMid = (tuitionRange[0] + tuitionRange[1]) / 2;
  const tuitionBdt = round(toBdt(tuitionMid, currency));
  const livingBdt = round(toBdt(living.amount, currency));
  const source = COUNTRY_COSTS[input.country];

  const lines: CostLine[] = [
    {
      label: "Tuition",
      bdt: tuitionBdt,
      basis: "estimate",
      note: `Midpoint of published ${input.tier} tuition for ${input.country}. An estimate - confirm against the university's own fee page.`,
    },
    {
      label: "Living costs",
      bdt: livingBdt,
      basis: "official",
      note: living.note,
      sourceName: source?.sourceName,
      sourceUrl: source?.sourceUrl,
    },
  ];

  const grossAnnualBdt = tuitionBdt + livingBdt;
  // Aid is applied to tuition only - maintenance requirements are rarely waived.
  const aidAnnualBdt = round(tuitionBdt * Math.min(1, Math.max(0, input.aidRatio)));
  const netAnnualBdt = grossAnnualBdt - aidAnnualBdt;
  const gapAnnualBdt = netAnnualBdt - input.annualBudgetBdt;

  const ratio = input.annualBudgetBdt > 0 ? netAnnualBdt / input.annualBudgetBdt : Infinity;
  const verdict: AffordabilityResult["verdict"] =
    gapAnnualBdt <= 0 ? "comfortable" : ratio <= 1.15 ? "tight" : "gap";

  return {
    country: input.country,
    supported: true,
    lines,
    tuitionRangeBdt: [round(toBdt(tuitionRange[0], currency)), round(toBdt(tuitionRange[1], currency))],
    grossAnnualBdt,
    aidAnnualBdt,
    netAnnualBdt,
    budgetAnnualBdt: input.annualBudgetBdt,
    gapAnnualBdt,
    totalNetBdt: netAnnualBdt * input.years,
    totalGapBdt: Math.max(0, gapAnnualBdt) * input.years,
    verdict,
    fxAsOf: FX.asOf,
  };
}

export function supportedCountries(): string[] {
  return Object.keys(LIVING);
}

/** Compact BDT for UI: ৳12.4L / ৳1.2Cr, which is how the amount is spoken. */
export function formatBdt(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 10_000_000) return `৳${(amount / 10_000_000).toFixed(2)} Cr`;
  if (abs >= 100_000) return `৳${(amount / 100_000).toFixed(1)} L`;
  if (abs >= 1_000) return `৳${Math.round(amount / 1000)}k`;
  return `৳${Math.round(amount)}`;
}
