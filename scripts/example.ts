import { mkdirSync, writeFileSync } from "node:fs";
import { sampleInput, routeExample } from "../lib/market/templates.ts";
import { evaluateStudy, selectPortfolio } from "../lib/market/economics.ts";
import { decisionMarkdown } from "../lib/market/export.ts";

mkdirSync("examples", { recursive: true });
for (const [name, input] of [
  ["robot-markets", sampleInput()],
  ["regional-channels", routeExample("regional")],
  ["personal-service", routeExample("personal")],
] as const) {
  const markets = evaluateStudy(input);
  writeFileSync(
    `examples/${name}.json`,
    JSON.stringify(
      {
        kind: "synthetic-business-assumptions",
        input,
        markets,
        portfolio: selectPortfolio(input, markets),
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(`examples/${name}.md`, decisionMarkdown(input, null, []));
  console.log(
    name,
    markets
      .map(
        (m) =>
          `${m.marketCode}: ${m.contribution.toFixed(2)} ${input.currency ?? "USD"} / ${m.scenario.total} scenarios`,
      )
      .join("; "),
  );
}
