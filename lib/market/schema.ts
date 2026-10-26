import { z } from "zod";
const number = z.number().finite().min(0);
export const countrySchema = z.object({
  code: z.string().regex(/^[A-Z]{3}$/),
  name: z.string().min(1).max(100),
});
export const actorSchema = z.object({
  kind: z.enum(["company", "individual", "institution", "segment"]),
  name: z.string().max(200),
});
// A route identifier is separate from its country jurisdiction. Legacy ISO3 IDs remain valid.
const routeCode = z.string().regex(/^[A-Z][A-Z0-9_-]{2,39}$/);
export const marketSchema = z
  .object({
    code: routeCode,
    name: z.string().min(1).max(100),
    countryCode: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    scope: z.enum(["country", "region", "segment"]).optional(),
    buyer: actorSchema.optional(),
    channel: z.string().max(1000).optional(),
    delivery: z.string().max(1000).optional(),
    settlement: z.string().max(1000).optional(),
  })
  .superRefine((v, c) => {
    if (!v.countryCode && !/^[A-Z]{3}$/.test(v.code))
      c.addIssue({ code: "custom", message: "区域或客户方案需要指定所属国家" });
  });
export type Market = z.infer<typeof marketSchema>;
export const assumptionsSchema = z.object({
  marketCode: routeCode,
  dealUnits: number.max(1e12).optional(),
  price: number.max(1e9),
  variableCost: number.max(1e9),
  crossBorderCost: number.max(1e9),
  sellingCost: number.max(1e9),
  channelFeePct: number.max(100),
  importChargePct: number.max(300),
  importChargeBase: number.max(1e9),
  annualUnits: number.max(1e12),
  annualGrowthPct: z.number().min(-90).max(300),
  entryCost: number.max(1e12),
  monthlyFixedCost: number.max(1e12),
  launchMonths: number.int().max(36),
  rampMonths: number.int().min(1).max(24),
  volumeLow: z.number().min(0).max(1),
  volumeHigh: z.number().min(1).max(10),
  fxLow: z.number().min(0.1).max(1),
  fxHigh: z.number().min(1).max(3),
  costHigh: z.number().min(1).max(5),
  note: z.string().max(3000),
  access: z.enum(["unknown", "reviewed", "blocked"]).default("unknown"),
  accessNote: z.string().max(2000).default(""),
  salesHistory: z.array(number.max(1e12)).max(120).default([]),
});
export type Assumptions = z.infer<typeof assumptionsSchema>;
export const sourceSchema = z.object({
  id: z.string(),
  title: z.string().max(500),
  url: z.string().max(2048).default(""),
  text: z.string().min(1).max(30000),
  marketCode: z.string().default("ALL"),
  kind: z.enum(["document", "web", "search-summary"]).default("document"),
  publishedAt: z.string().optional(),
  retrievedAt: z.string().optional(),
});
export type MarketSource = z.infer<typeof sourceSchema>;
export const inputSchema = z
  .object({
    name: z.string().min(2).max(150),
    offering: z.string().min(8).max(5000),
    kind: z.enum(["goods", "subscription", "usage", "service"]),
    unit: z.string().min(1).max(50),
    origin: marketSchema,
    targets: z.array(marketSchema).min(1).max(4),
    supplier: actorSchema.optional(),
    decisionMode: z.enum(["market-entry", "single-deal"]).optional(),
    portfolioMode: z.enum(["independent", "exclusive"]).optional(),
    currency: z.enum(["USD", "CNY", "EUR", "GBP", "SGD"]).optional(),
    successCriterion: z.string().max(2000).optional(),
    customer: z.string().min(4).max(3000),
    horizonMonths: z.number().int().min(1).max(36),
    budgetUSD: number.max(1e12),
    hsCode: z
      .string()
      .regex(/^(\d{6})?$/)
      .default(""),
    useWeb: z.boolean().default(true),
    sources: z.array(sourceSchema).max(10).default([]),
    models: z.array(assumptionsSchema).max(4),
    context: z.string().max(6000).default(""),
  })
  .superRefine((v, c) => {
    if (new Set(v.targets.map((x) => x.code)).size !== v.targets.length)
      c.addIssue({ code: "custom", message: "目标市场不能重复" });
    if (
      v.decisionMode === "single-deal" &&
      v.models.some((m) => m.dealUnits === undefined)
    )
      c.addIssue({
        code: "custom",
        message: "一次性交易需要填写每个方案的本次数量",
      });
    if (v.targets.some((x) => !v.models.some((m) => m.marketCode === x.code)))
      c.addIssue({ code: "custom", message: "每个市场都需要一组商业假设" });
    if (new Set(v.models.map((x) => x.marketCode)).size !== v.models.length)
      c.addIssue({ code: "custom", message: "模型不能重复" });
    if (v.models.some((m) => !v.targets.some((t) => t.code === m.marketCode)))
      c.addIssue({ code: "custom", message: "模型必须对应目标市场" });
    if (v.sources.reduce((n, s) => n + s.text.length, 0) > 100000)
      c.addIssue({ code: "custom", message: "资料总量超过100000字符" });
  });
export type StudyInput = z.infer<typeof inputSchema>;
export type Observation = {
  countryCode: string;
  indicator: string;
  label: string;
  year: number;
  value: number;
  unit: string;
  url: string;
  retrievedAt: string;
  updatedAt: string;
};
export type MarketFact = {
  id: string;
  marketCode: string;
  dimension:
    | "demand"
    | "competition"
    | "channel"
    | "access"
    | "cost"
    | "delivery"
    | "settlement";
  statement: string;
  sourceId: string;
  quote: string;
  qualification: string;
};
export type TraceEvent = {
  stage: string;
  message: string;
  at: string;
  detail?: string;
};
export const planSchema = z.object({
  question: z.string(),
  queries: z
    .array(
      z.object({
        marketCode: z.string(),
        query: z.string().max(128),
        purpose: z.string(),
      }),
    )
    .max(12),
  hypotheses: z
    .array(
      z.object({
        marketCode: z.string(),
        claim: z.string(),
        wouldChangeDecision: z.string(),
      }),
    )
    .max(12),
});
export type MarketPlan = z.infer<typeof planSchema>;
export const synthesisSchema = z.object({
  summary: z.string().max(5000),
  markets: z
    .array(
      z.object({
        marketCode: z.string(),
        position: z.enum(["pilot", "investigate", "defer"]),
        reason: z.string(),
        customerFit: z.string(),
        routeToMarket: z.string(),
        criticalCondition: z.string(),
        factIds: z.array(z.string()),
        actions: z
          .array(
            z.object({
              title: z.string(),
              deliverable: z.string(),
              successSignal: z.string(),
            }),
          )
          .max(5),
      }),
    )
    .max(4),
  crossMarketTradeoffs: z.array(z.string()).max(8),
  missingInformation: z
    .array(
      z.object({
        marketCode: z.string(),
        question: z.string(),
        whyItMatters: z.string(),
        howToLearn: z.string(),
      }),
    )
    .max(12),
});
export type Synthesis = z.infer<typeof synthesisSchema>;
export type RunState = {
  id: string;
  projectId: string;
  input: StudyInput;
  status: "running" | "completed" | "failed";
  stage: string;
  createdAt: string;
  updatedAt: string;
  events: TraceEvent[];
  actionsSnapshot?: ActionRecord[];
  plan?: MarketPlan;
  observations?: Observation[];
  sources?: MarketSource[];
  facts?: MarketFact[];
  synthesis?: Synthesis;
  warnings: string[];
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    calls: number;
    searchCalls: number;
    fetchCalls?: number;
  };
  error?: string;
  engineVersion: string;
  finalReview?: { issues: string[]; checkedAt: string; patchCount?: number };
  sourceChecks?: {
    officialSources: number;
    domains: number;
    followupQueries: number;
    excludedRegulatoryFacts: number;
  };
  calculations?: {
    markets: import("./economics").Economics[];
    portfolio: {
      markets: string[];
      entryCost: number;
      contribution: number;
      worstCase: number;
    };
  };
};
export type ActionRecord = {
  id: string;
  marketCode: string;
  title: string;
  status: "todo" | "doing" | "done";
  outcome: string;
  updatedAt: string;
};
export type StudyProject = {
  id: string;
  input: StudyInput;
  revision: number;
  createdAt: string;
  updatedAt: string;
  actions: ActionRecord[];
  latestRunId?: string;
};
