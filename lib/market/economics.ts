import type { Assumptions, StudyInput } from "./schema.ts";
import { isExclusive } from "./domain.ts";
export type Economics = {
  marketCode: string;
  months: {
    month: number;
    units: number;
    revenue: number;
    contribution: number;
    cumulative: number;
  }[];
  units: number;
  revenue: number;
  contribution: number;
  unitContribution: number;
  breakEvenUnits: number | null;
  breakEvenAnnualUnits: number | null;
  paybackMonth: number | null;
  fixedCost: number;
  entryCost: number;
  status: "incomplete" | "negative-unit-margin" | "positive" | "negative";
  scenario: {
    low: number;
    base: number;
    high: number;
    profitable: number;
    total: number;
  };
  sensitivity: { name: string; low: number; high: number; spread: number }[];
};
type Shock = { volume?: number; fx?: number; cost?: number; delay?: number };
export function calculate(
  input: Pick<StudyInput, "kind" | "horizonMonths" | "decisionMode">,
  a: Assumptions,
  shock: Shock = {},
) {
  const volume = shock.volume ?? 1,
    fx = shock.fx ?? 1,
    cost = shock.cost ?? 1;
  const price = a.price * fx;
  // Import charge is an explicitly supplied economic assumption, never a tariff lookup.
  const importCharge =
    input.kind === "goods" ? (a.importChargeBase * a.importChargePct) / 100 : 0;
  const unitCost =
    (a.variableCost + a.crossBorderCost) * cost + a.sellingCost + importCharge;
  const unitContribution = price * (1 - a.channelFeePct / 100) - unitCost;
  const launch = a.launchMonths + (shock.delay ?? 0);
  let cumulative = -a.entryCost,
    units = 0,
    revenue = 0;
  let paybackMonth: number | null = null;
  const single = input.decisionMode === "single-deal";
  const months = Array.from({ length: input.horizonMonths }, (_, i) => {
    const month = i + 1;
    const active = Math.max(0, month - launch);
    const sold = single
      ? month === launch + 1
        ? (a.dealUnits ?? 0) * volume
        : 0
      : active <= 0
        ? 0
        : (a.annualUnits / 12) *
          volume *
          Math.min(1, active / a.rampMonths) *
          Math.pow(1 + a.annualGrowthPct / 100, (active - 1) / 12);
    const rev = sold * price;
    const contribution = sold * unitContribution - a.monthlyFixedCost;
    cumulative += contribution;
    units += sold;
    revenue += rev;
    if (paybackMonth === null && cumulative >= 0) paybackMonth = month;
    return { month, units: sold, revenue: rev, contribution, cumulative };
  });
  const fixedCost = a.entryCost + a.monthlyFixedCost * input.horizonMonths;
  const breakEvenUnits =
    unitContribution > 0 ? fixedCost / unitContribution : null;
  const unitVolumeFactor = single
    ? launch < input.horizonMonths
      ? 1
      : 0
    : calculateVolumeFactor(input.horizonMonths, a, shock.delay ?? 0);
  const breakEvenAnnualUnits =
    unitContribution > 0 && unitVolumeFactor > 0
      ? fixedCost / (unitContribution * unitVolumeFactor)
      : null;
  return {
    marketCode: a.marketCode,
    months,
    units,
    revenue,
    contribution: cumulative,
    unitContribution,
    breakEvenUnits,
    breakEvenAnnualUnits,
    paybackMonth,
    fixedCost,
    entryCost: a.entryCost,
  };
}
function calculateVolumeFactor(horizon: number, a: Assumptions, delay: number) {
  return Array.from({ length: horizon }, (_, i) => {
    const active = Math.max(0, i + 1 - a.launchMonths - delay);
    return active <= 0
      ? 0
      : (Math.min(1, active / a.rampMonths) *
          Math.pow(1 + a.annualGrowthPct / 100, (active - 1) / 12)) /
          12;
  }).reduce((a, b) => a + b, 0);
}
export function evaluateMarket(
  input: Pick<StudyInput, "kind" | "horizonMonths" | "decisionMode">,
  a: Assumptions,
): Economics {
  const base = calculate(input, a);
  const values: number[] = [];
  const single = input.decisionMode === "single-deal";
  for (const factor of single ? [0, 1, 3] : [a.volumeLow, 1, a.volumeHigh])
    for (const fx of [a.fxLow, 1, a.fxHigh])
      for (const cost of [1, (1 + a.costHigh) / 2, a.costHigh])
        values.push(
          calculate(input, a, {
            ...(single ? { delay: factor } : { volume: factor }),
            fx,
            cost,
          }).contribution,
        );
  const sensitivity = [
    ...(!single
      ? [
          {
            name: "销量",
            low: calculate(input, a, { volume: a.volumeLow }).contribution,
            high: calculate(input, a, { volume: a.volumeHigh }).contribution,
          },
        ]
      : []),
    {
      name: "实际售价 / 折算",
      low: calculate(input, a, { fx: a.fxLow }).contribution,
      high: calculate(input, a, { fx: a.fxHigh }).contribution,
    },
    {
      name: "供给与交付成本",
      low: calculate(input, a, { cost: a.costHigh }).contribution,
      high: base.contribution,
    },
    {
      name: single ? "交付延迟 3 个月" : "进入延迟 3 个月",
      low: calculate(input, a, { delay: 3 }).contribution,
      high: base.contribution,
    },
  ]
    .map((s) => ({ ...s, spread: Math.abs(s.high - s.low) }))
    .sort((a, b) => b.spread - a.spread);
  return {
    ...base,
    status:
      a.price <= 0 ||
      (input.decisionMode === "single-deal"
        ? (a.dealUnits ?? 0)
        : a.annualUnits) <= 0
        ? "incomplete"
        : base.unitContribution <= 0
          ? "negative-unit-margin"
          : base.contribution >= 0
            ? "positive"
            : "negative",
    scenario: {
      low: Math.min(...values),
      base: base.contribution,
      high: Math.max(...values),
      profitable: values.filter((x) => x >= 0).length,
      total: values.length,
    },
    sensitivity,
  };
}
export function evaluateStudy(input: StudyInput) {
  return input.targets.map((c) =>
    evaluateMarket(input, input.models.find((m) => m.marketCode === c.code)!),
  );
}
export function selectPortfolio(input: StudyInput, results: Economics[]) {
  // Budget covers declared one-time entry investments. Operating liquidity is separate.
  const candidates = results.filter(
    (r) =>
      input.models.find((m) => m.marketCode === r.marketCode)?.access !==
        "blocked" && r.status !== "incomplete",
  );
  let best = {
    markets: [] as string[],
    entryCost: 0,
    contribution: 0,
    worstCase: 0,
  };
  for (let mask = 1; mask < 1 << candidates.length; mask++) {
    const picked = candidates.filter((_, i) => mask & (1 << i));
    if (isExclusive(input) && picked.length > 1) continue;
    const entryCost = picked.reduce((n, r) => n + r.entryCost, 0),
      contribution = picked.reduce((n, r) => n + r.contribution, 0);
    if (entryCost <= input.budgetUSD && contribution > best.contribution)
      best = {
        markets: picked.map((r) => r.marketCode),
        entryCost,
        contribution,
        worstCase: picked.reduce((n, r) => n + r.scenario.low, 0),
      };
  }
  return best;
}
export function quantitativeAnchors(input: StudyInput, results: Economics[]) {
  const label = (code: string) =>
    input.targets.find((t) => t.code === code)?.name ?? code;
  const ranked = results
    .slice()
    .sort((a, b) => b.contribution - a.contribution);
  const minimum = Math.min(...results.map((r) => r.entryCost));
  const paybacks = results.filter((r) => r.paybackMonth !== null);
  const earliest = paybacks.length
    ? Math.min(...paybacks.map((r) => r.paybackMonth!))
    : null;
  return {
    contributionOrder: ranked.map((r) => ({
      route: label(r.marketCode),
      contribution: r.contribution,
    })),
    lowestEntryCost: {
      routes: results
        .filter((r) => r.entryCost === minimum)
        .map((r) => label(r.marketCode)),
      amount: minimum,
    },
    earliestPayback: {
      routes: paybacks
        .filter((r) => r.paybackMonth === earliest)
        .map((r) => label(r.marketCode)),
      month: earliest,
    },
    meaning:
      "仅是输入商业假设下的算术比较，不代表已验证销量、最优实际选择或准入许可",
  };
}
