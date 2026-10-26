import test from "node:test";
import assert from "node:assert/strict";
import {
  calculate,
  evaluateMarket,
  evaluateStudy,
  selectPortfolio,
} from "../../lib/market/economics.ts";
import { forecastSales } from "../../lib/market/forecast.ts";
import {
  sampleInput,
  baseAssumptions,
  routeExample,
} from "../../lib/market/templates.ts";
import { inputSchema } from "../../lib/market/schema.ts";
import { locatedFacts, newRun, runHarness } from "../../lib/market/harness.ts";
import { worldBank } from "../../lib/market/data.ts";
const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const simple = () => ({
  ...baseAssumptions("SGP"),
  price: 100,
  variableCost: 40,
  crossBorderCost: 0,
  sellingCost: 0,
  channelFeePct: 0,
  annualUnits: 120,
  annualGrowthPct: 0,
  entryCost: 1000,
  monthlyFixedCost: 100,
  launchMonths: 0,
  rampMonths: 1,
  importChargePct: 0,
});
test("hand-calculated 12-month business: 120 units, 5000 contribution, month 2 payback", () => {
  const r = calculate({ kind: "goods", horizonMonths: 12 }, simple());
  close(r.units, 120);
  close(r.contribution, 5000);
  close(r.unitContribution, 60);
  close(r.breakEvenUnits!, 2200 / 60);
  assert.equal(r.paybackMonth, 2);
});
test("delay and ramp count fixed cost during prelaunch", () => {
  const r = calculate(
    { kind: "goods", horizonMonths: 12 },
    { ...simple(), launchMonths: 2, rampMonths: 4 },
  );
  close(r.units, 85);
  close(r.contribution, 2900);
  assert.equal(r.months[0].contribution, -100);
  close(r.months[2].units, 2.5);
  close(r.months[5].units, 10);
});
test("computed annual threshold breaks even with ramp and growth", () => {
  const a = {
    ...simple(),
    launchMonths: 3,
    rampMonths: 5,
    annualGrowthPct: 12,
  };
  const r = calculate({ kind: "goods", horizonMonths: 24 }, a);
  const boundary = calculate(
    { kind: "goods", horizonMonths: 24 },
    { ...a, annualUnits: r.breakEvenAnnualUnits! },
  );
  close(boundary.contribution, 0);
});
test("no launch in horizon gives no sales, no annual break-even, fixed costs remain", () => {
  const r = calculate(
    { kind: "goods", horizonMonths: 12 },
    { ...simple(), launchMonths: 14 },
  );
  close(r.units, 0);
  close(r.contribution, -2200);
  assert.equal(r.breakEvenAnnualUnits, null);
});
test("negative unit margin cannot produce a break-even target", () => {
  const r = evaluateMarket(
    { kind: "goods", horizonMonths: 12 },
    { ...simple(), price: 10 },
  );
  assert.equal(r.status, "negative-unit-margin");
  assert.equal(r.breakEvenUnits, null);
  assert.equal(r.paybackMonth, null);
});
test("declared import charges apply to goods only", () => {
  const a = { ...simple(), importChargeBase: 50, importChargePct: 20 };
  close(
    calculate({ kind: "goods", horizonMonths: 12 }, a).unitContribution,
    50,
  );
  close(
    calculate({ kind: "usage", horizonMonths: 12 }, a).unitContribution,
    60,
  );
});
test("27 scenario combinations contain base and preserve low <= base <= high", () => {
  const r = evaluateMarket({ kind: "goods", horizonMonths: 12 }, simple());
  assert.equal(r.scenario.total, 27);
  assert.ok(
    r.scenario.low <= r.contribution && r.contribution <= r.scenario.high,
  );
  assert.ok(r.sensitivity[0].spread >= r.sensitivity.at(-1)!.spread);
});
test("portfolio honors entry budget and a blocked destination", () => {
  const input = sampleInput();
  input.horizonMonths = 12;
  input.budgetUSD = 1500;
  input.models = input.targets.map((t) => ({
    ...simple(),
    marketCode: t.code,
  }));
  input.models[0].access = "blocked";
  const p = selectPortfolio(input, evaluateStudy(input));
  assert.equal(p.markets.length, 1);
  assert.ok(!p.markets.includes("SGP"));
  assert.ok(p.entryCost <= 1500);
  input.models = input.models.map((m) => ({ ...m, price: 10 }));
  assert.deepEqual(selectPortfolio(input, evaluateStudy(input)).markets, []);
});
test("input accepts domestic routes and rejects duplicate routes, orphan models and invalid ranges", () => {
  const input = sampleInput();
  assert.ok(inputSchema.safeParse(input).success);
  assert.ok(
    inputSchema.safeParse({ ...input, origin: input.targets[0] }).success,
  );
  assert.ok(
    !inputSchema.safeParse({
      ...input,
      targets: [input.targets[0], input.targets[0]],
    }).success,
  );
  assert.ok(
    !inputSchema.safeParse({
      ...input,
      models: [...input.models, { ...simple(), marketCode: "FRA" }],
    }).success,
  );
  assert.ok(
    !inputSchema.safeParse({
      ...input,
      models: input.models.map((m) => ({ ...m, volumeLow: 2 })),
    }).success,
  );
});
test("flat and all-zero history use perfect naive forecasts", () => {
  const r = forecastSales(Array(12).fill(20));
  assert.equal(r.method, "naive");
  assert.equal(r.mae, 0);
  close(r.total, 240);
  assert.ok(r.points.every((p) => p.low === 20 && p.high === 20));
  assert.equal(forecastSales(Array(8).fill(0)).total, 0);
  assert.throws(() => forecastSales([1, 2, 3]));
  assert.throws(() => forecastSales(Array(8).fill(1), 1.2));
});
test("forecast scores are out-of-sample one-step errors", () => {
  const values = [4, 7, 5, 8, 9, 7, 11, 10, 13, 12, 15, 14];
  const r = forecastSales(values);
  const expected =
    values
      .slice(6)
      .reduce((sum, v, i) => sum + Math.abs(v - values[5 + i]), 0) / 6;
  close(r.baselines.find((b) => b.method === "naive")!.mae, expected);
  assert.ok(
    r.points.every((p) => p.low >= 0 && p.low <= p.value && p.value <= p.high),
  );
});
test("facts must be locatable, in market scope, and one per source", () => {
  const source = {
    id: "S1",
    title: "Test",
    url: "",
    text: "Approved vendors must provide local support.",
    marketCode: "SGP",
    kind: "document" as const,
  };
  const f = {
    marketCode: "SGP",
    dimension: "channel" as const,
    statement: "Support is required",
    sourceId: "S1",
    quote: "must provide local support",
    qualification: "",
  };
  const facts = locatedFacts(
    [
      f,
      f,
      { ...f, sourceId: "S99" },
      { ...f, quote: "fabricated quotation" },
      { ...f, marketCode: "XXX" },
    ],
    [source],
    ["SGP"],
  );
  assert.equal(facts.length, 1);
});
test("World Bank null observations remain missing, metadata and years preserved", async () => {
  const original = globalThis.fetch;
  const fake = (async () =>
    new Response(
      JSON.stringify([
        { lastupdated: "2026-10-08" },
        [
          {
            countryiso3code: "SGP",
            indicator: { id: "SP.POP.TOTL" },
            date: "2025",
            value: 6,
          },
          {
            countryiso3code: "SGP",
            indicator: { id: "SP.POP.TOTL" },
            date: "2024",
            value: null,
          },
        ],
      ]),
    )) as typeof fetch;
  const r = await worldBank(["SGP"], fake);
  assert.equal(r.length, 1);
  assert.equal(r[0].updatedAt, "2026-10-08");
  assert.equal(r[0].year, 2025);
  assert.equal(globalThis.fetch, original);
});
test("harness resumes after synthesis failure without repeating collected evidence", async () => {
  const input = sampleInput();
  input.targets = [input.targets[0]];
  input.models = [{ ...input.models[0], access: "blocked" }];
  input.useWeb = false;
  input.sources = [
    {
      id: "D1",
      title: "Channel interview fixture",
      url: "",
      text: "Education buyers request a local demonstration before a purchase.",
      marketCode: "SGP",
      kind: "document",
    },
  ];
  const state = newRun("test-project", input, "test-model");
  state.observations = [];
  state.sources = input.sources.map((s) => ({ ...s, id: "S1" }));
  let stage = 0;
  const outputs: unknown[] = [
    { question: "Where to enter", queries: [], hypotheses: [] },
    {
      facts: [
        {
          marketCode: "SGP",
          dimension: "channel",
          statement: "Buyers ask for a demonstration",
          sourceId: "S1",
          quote: "request a local demonstration",
          qualification: "Fixture only",
        },
      ],
    },
    {
      reviews: [
        {
          id: "F1",
          verdict: "supported",
          statement: "Buyers ask for a demonstration",
          qualification: "Fixture only",
        },
      ],
    },
    null,
    {
      summary: "Test recommendation",
      markets: [
        {
          marketCode: "SGP",
          position: "pilot",
          reason: "Test",
          customerFit: "Test",
          routeToMarket: "Test",
          criticalCondition: "Test",
          factIds: ["F1", "invented"],
          actions: [],
        },
      ],
      crossMarketTradeoffs: [],
      missingInformation: [],
    },
  ];
  outputs.push({ issues: [], replacements: [] });
  const fetcher = (async () => {
    const data = outputs[stage++];
    if (data === null) return new Response("{}", { status: 502 });
    return new Response(
      JSON.stringify({
        model: "test-model",
        usage: { prompt_tokens: 10, completion_tokens: 20 },
        choices: [
          { finish_reason: "stop", message: { content: JSON.stringify(data) } },
        ],
      }),
    );
  }) as typeof fetch;
  const saved: string[] = [];
  const checkpoint = async () => {
    saved.push(JSON.stringify(state));
  };
  await assert.rejects(() =>
    runHarness(
      state,
      { key: "fixture", model: "test-model", fetcher },
      checkpoint,
      () => {},
    ),
  );
  assert.equal(state.status, "failed");
  assert.equal(state.facts?.length, 1);
  await runHarness(
    state,
    { key: "fixture", model: "test-model", fetcher },
    checkpoint,
    () => {},
  );
  assert.equal(stage, 6);
  assert.equal(state.status, "completed");
  assert.equal(state.synthesis?.markets[0].position, "defer");
  assert.deepEqual(state.synthesis?.markets[0].factIds, ["F1"]);
  assert.ok(saved.length >= 8);
  assert.equal(state.calculations?.markets[0].scenario.total, 27);
});

test("source policy rejects lookalike official domains and nonofficial regulatory claims", async () => {
  const { isOfficial, regulatoryFactAllowed, officialQuery } = await import(
    "../../lib/market/source-policy.ts"
  );
  assert.equal(isOfficial("https://www.customs.gov.sg/imports"), true);
  assert.equal(
    isOfficial("https://www.customs.gov.sg.attacker.example/imports"),
    false,
  );
  assert.equal(
    isOfficial("https://single-market-economy.ec.europa.eu/sectors"),
    true,
  );
  assert.ok(
    officialQuery("DEU", "robot machinery requirements").includes(
      "site:europa.eu",
    ),
  );
  assert.ok(officialQuery("DEU", "a".repeat(200)).length <= 128);
  assert.equal(
    regulatoryFactAllowed({
      id: "S1",
      title: "Tariffs",
      url: "https://example.com",
      kind: "web",
      marketCode: "USA",
      text: "Claim",
    }),
    false,
  );
  assert.equal(
    regulatoryFactAllowed({
      id: "S1",
      title: "Tariffs",
      url: "https://cbp.gov",
      kind: "search-summary",
      marketCode: "USA",
      text: "Claim",
    }),
    false,
  );
});
test("source collection caps a repeated commercial site and upgrades full official text", async () => {
  const { addDiverseSource } = await import(
    "../../lib/market/source-policy.ts"
  );
  const sources: import("../../lib/market/schema.ts").MarketSource[] = [];
  for (let i = 0; i < 5; i++)
    addDiverseSource(sources, {
      title: "Page " + i,
      url: "https://vendor.example/" + i,
      text: "Vendor text",
      marketCode: "SGP",
      kind: "web",
    });
  assert.equal(sources.length, 2);
  addDiverseSource(sources, {
    title: "Customs",
    url: "https://cbp.gov/entry",
    text: "Summary",
    marketCode: "USA",
    kind: "search-summary",
  });
  addDiverseSource(sources, {
    title: "Customs",
    url: "https://cbp.gov/entry",
    text: "Retrieved full official document",
    marketCode: "USA",
    kind: "web",
  });
  assert.equal(sources.length, 3);
  assert.equal(sources[2].kind, "web");
  assert.ok(sources[2].text.includes("full official"));
});
test("a run preserves the original assumptions and field-observation snapshot", () => {
  const input = sampleInput();
  const actions = [
    {
      id: "a1",
      marketCode: "SGP",
      title: "Interview",
      status: "done" as const,
      outcome: "Two interview notes supplied by user",
      updatedAt: "2026-10-18",
    },
  ];
  const run = newRun("p", input, "test", actions);
  input.models[0].price = 999;
  actions[0].outcome = "Later observation";
  assert.notEqual(run.input.models[0].price, 999);
  assert.equal(
    run.actionsSnapshot?.[0].outcome,
    "Two interview notes supplied by user",
  );
});
test("digital-service research uses data and service authorities instead of goods customs queries", async () => {
  const { officialQuery } = await import("../../lib/market/source-policy.ts");
  const query = officialQuery("SGP", "AI API data processing", "usage");
  assert.ok(query.includes("site:pdpc.gov.sg"));
  assert.ok(!query.includes("customs"));
  assert.ok(
    officialQuery("USA", "software data requirements", "subscription").includes(
      "site:ftc.gov",
    ),
  );
});
test("escaped fetch Markdown is normalized to the displayed source text for quotations", async () => {
  const { readableSourceText } = await import(
    "../../lib/market/source-policy.ts"
  );
  assert.equal(
    readableSourceText("GST and\\/or duty\\, and a permit\\."),
    "GST and/or duty, and a permit.",
  );
  const facts = locatedFacts(
    [
      {
        marketCode: "SGP",
        dimension: "access",
        statement: "Import requires a permit",
        sourceId: "S1",
        quote: "GST and/or duty, and a permit.",
        qualification: "",
      },
    ],
    [
      {
        id: "S1",
        title: "Customs",
        url: "https://customs.gov.sg",
        kind: "web",
        marketCode: "SGP",
        text: "Subject to GST and\\/or duty\\, and a permit\\.",
      },
    ],
    ["SGP"],
  );
  assert.equal(facts.length, 1);
});
test("lowest entry cost and earliest payback have independent, deterministic rankings", async () => {
  const { quantitativeAnchors } = await import("../../lib/market/economics.ts");
  const input = sampleInput();
  const a = quantitativeAnchors(input, evaluateStudy(input));
  assert.deepEqual(a.lowestEntryCost.routes, ["新加坡"]);
  assert.deepEqual(a.earliestPayback.routes, ["美国"]);
  assert.equal(a.earliestPayback.month, 7);
});
test("final review changes only identified text fields and preserves calculations and citations", async () => {
  const { applyFinalReview } = await import("../../lib/market/harness.ts");
  const report = {
    summary: "Incorrect ranking",
    markets: [
      {
        marketCode: "SGP",
        position: "pilot" as const,
        reason: "Entry budget",
        customerFit: "Labs",
        routeToMarket: "Review",
        criticalCondition: "Demand",
        factIds: ["F1"],
        actions: [
          {
            title: "Interview",
            deliverable: "Notes",
            successSignal: "Interest",
          },
        ],
      },
    ],
    crossMarketTradeoffs: [],
    missingInformation: [],
  };
  const fixed = applyFinalReview(report, [
    {
      marketCode: "ALL",
      field: "summary",
      text: "Singapore needs less entry investment; the US has the earliest assumed payback.",
    },
    {
      marketCode: "SGP",
      field: "actionDeliverable",
      actionIndex: 0,
      text: "Dated interview notes",
    },
  ]);
  assert.equal(
    fixed.markets[0].actions[0].deliverable,
    "Dated interview notes",
  );
  assert.deepEqual(fixed.markets[0].factIds, ["F1"]);
  assert.equal(report.summary, "Incorrect ranking");
  assert.throws(() =>
    applyFinalReview(report, [
      { marketCode: "USA", field: "reason", text: "Missing country" },
    ]),
  );
});

test("regional and personal studies separate route IDs, jurisdictions and actors", async () => {
  const { jurisdiction, routeContext } = await import(
    "../../lib/market/domain.ts"
  );
  for (const type of ["regional", "personal"] as const) {
    const input = routeExample(type);
    assert.ok(inputSchema.safeParse(input).success);
    assert.equal(new Set(input.targets.map(jurisdiction)).size, 1);
    assert.equal(new Set(input.targets.map((t) => t.code)).size, 2);
    assert.ok(
      routeContext(input).routes.every(
        (r) => r.countryCode === "CHN" && !r.crossBorder,
      ),
    );
  }
  const input = routeExample("regional");
  delete input.targets[0].countryCode;
  assert.ok(!inputSchema.safeParse(input).success);
});
test("one-off delivery counts the quantity once and includes preparation and horizon overhead", () => {
  const input = {
    kind: "service" as const,
    horizonMonths: 3,
    decisionMode: "single-deal" as const,
  };
  const a = {
    ...simple(),
    dealUnits: 50,
    launchMonths: 1,
    rampMonths: 24,
    annualGrowthPct: 300,
    annualUnits: 999999,
  };
  const r = calculate(input, a);
  close(r.units, 50);
  close(r.revenue, 5000);
  close(r.contribution, 1700);
  assert.deepEqual(
    r.months.map((m) => m.units),
    [0, 50, 0],
  );
  assert.equal(r.paybackMonth, 2);
  close(
    calculate(input, { ...a, dealUnits: r.breakEvenAnnualUnits! }).contribution,
    0,
  );
  const delayed = calculate(input, a, { delay: 3 });
  close(delayed.units, 0);
  close(delayed.contribution, -1300);
  assert.equal(delayed.breakEvenAnnualUnits, null);
});
test("exclusive alternatives cannot be added even when their combined cost fits the budget", () => {
  const input = routeExample("personal"),
    results = evaluateStudy(input);
  const p = selectPortfolio(input, results);
  assert.deepEqual(p.markets, ["CLIENT_B"]);
  close(p.contribution, 2100);
  input.portfolioMode = "independent";
  assert.equal(selectPortfolio(input, results).markets.length, 2);
  delete input.portfolioMode;
  assert.equal(selectPortfolio(input, results).markets.length, 1);
});
test("one-off quantity is required and annual forecast does not silently replace it", () => {
  const input = routeExample("personal");
  delete input.models[0].dealUnits;
  assert.ok(!inputSchema.safeParse(input).success);
  assert.equal(evaluateStudy(input)[0].status, "incomplete");
  input.models[0].dealUnits = 0;
  assert.equal(evaluateStudy(input)[0].status, "incomplete");
});
test("domestic research uses local market requirements and does not inject customs seeds", async () => {
  const { officialSeeds, queryForRoute } = await import(
    "../../lib/market/source-policy.ts"
  );
  const input = routeExample("regional");
  assert.deepEqual(officialSeeds(input), []);
  const q = queryForRoute(
    input,
    input.targets[0].code,
    "teaching robot product requirements",
    true,
  );
  assert.ok(q.includes("浙江"));
  assert.ok(q.includes("samr.gov.cn"));
  assert.ok(!q.includes("customs"));
  assert.ok(q.length <= 128);
  const overseas = sampleInput();
  overseas.targets[0] = {
    ...overseas.targets[0],
    code: "SINGAPORE_LABS",
    countryCode: "SGP",
    scope: "segment",
  };
  assert.ok(
    officialSeeds(overseas).some((s) => s.marketCode === "SINGAPORE_LABS"),
  );
  assert.ok(
    queryForRoute(overseas, "SINGAPORE_LABS", "robot import", true).includes(
      "customs.gov.sg",
    ),
  );
});
test("decision export preserves actors, one-off semantics, alternatives and declared currency", async () => {
  const { decisionMarkdown } = await import("../../lib/market/export.ts");
  const input = routeExample("personal");
  const text = decisionMarkdown(input, null, []);
  assert.ok(text.includes("币种：CNY"));
  assert.ok(text.includes("独立创作者 A"));
  assert.ok(text.includes("互斥，最多选一条"));
  assert.ok(text.includes("本次数量仅在等待期后的第一个月交付一次"));
  assert.ok(!text.includes("贡献 USD"));
});
test("regional harness keeps two same-country paths distinct and passes transaction context to the model", async () => {
  const input = routeExample("regional");
  input.useWeb = false;
  const state = newRun("regional-fixture", input, "test-model");
  const seen: any[] = [];
  const outputs = [
    { question: "Compare two routes", queries: [], hypotheses: [] },
    {
      summary: "Compare independently",
      markets: input.targets.map((t) => ({
        marketCode: t.code,
        position: "investigate",
        reason: "Need verified demand",
        customerFit: "Teaching labs",
        routeToMarket: t.channel,
        criticalCondition: "Obtain quotes",
        factIds: [],
        actions: [],
      })),
      crossMarketTradeoffs: [],
      missingInformation: [],
    },
    { issues: [], replacements: [] },
  ];
  let at = 0;
  const fetcher = (async (_url, init) => {
    const payload = JSON.parse(init!.body as string);
    seen.push(JSON.parse(payload.messages[1].content));
    return new Response(
      JSON.stringify({
        model: "test-model",
        usage: { prompt_tokens: 10, completion_tokens: 10 },
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(outputs[at++]) },
          },
        ],
      }),
    );
  }) as typeof fetch;
  await runHarness(
    state,
    { key: "fixture", model: "test-model", fetcher },
    async () => {},
    () => {},
  );
  assert.equal(at, 3);
  assert.equal(state.status, "completed");
  assert.equal(state.synthesis?.markets.length, 2);
  assert.equal(state.usage.searchCalls, 0);
  assert.deepEqual(state.observations, []);
  assert.ok(seen.every((x) => x.routeContext.routes.length === 2));
  assert.equal(seen[1].routeContext.alternatives.startsWith("互斥"), true);
  assert.equal(state.calculations?.portfolio.markets.length, 1);
});

test("one-off stress scenarios keep contract quantity fixed and vary delivery timing instead", () => {
  const input = {
    kind: "service" as const,
    horizonMonths: 3,
    decisionMode: "single-deal" as const,
  };
  const a = { ...simple(), dealUnits: 50, launchMonths: 0 };
  const r = evaluateMarket(input, a);
  const changed = evaluateMarket(input, { ...a, volumeLow: 0, volumeHigh: 9 });
  assert.deepEqual(r.scenario, changed.scenario);
  assert.equal(r.scenario.total, 27);
  close(r.scenario.low, -1300);
  assert.ok(!r.sensitivity.some((s) => s.name === "销量"));
});

test("final review can correct cross-route tradeoffs and information gaps without rewriting other evidence", async () => {
  const { applyFinalReview } = await import("../../lib/market/harness.ts");
  const report = {
    summary: "Summary",
    markets: [],
    crossMarketTradeoffs: ["Unqualified cause"],
    missingInformation: [
      {
        marketCode: "CLIENT_A",
        question: "Unknown",
        whyItMatters: "Old reason",
        howToLearn: "Ask buyer",
      },
    ],
  };
  const corrected = applyFinalReview(report, [
    {
      marketCode: "ALL",
      field: "tradeoff",
      itemIndex: 0,
      text: "A hypothesis to verify",
    },
    {
      marketCode: "CLIENT_A",
      field: "gapWhyItMatters",
      itemIndex: 0,
      text: "Changes the decision",
    },
  ]);
  assert.equal(corrected.crossMarketTradeoffs[0], "A hypothesis to verify");
  assert.equal(
    corrected.missingInformation[0].whyItMatters,
    "Changes the decision",
  );
  assert.equal(corrected.missingInformation[0].howToLearn, "Ask buyer");
  assert.throws(() =>
    applyFinalReview(report, [
      {
        marketCode: "ALL",
        field: "tradeoff",
        itemIndex: 8,
        text: "Out of range",
      },
    ]),
  );
  assert.throws(() =>
    applyFinalReview(report, [
      {
        marketCode: "CLIENT_B",
        field: "gapQuestion",
        itemIndex: 0,
        text: "Wrong route",
      },
    ]),
  );
});
