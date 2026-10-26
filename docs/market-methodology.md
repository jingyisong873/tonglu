# Market and transaction research methodology

## What the product answers

For one concrete offer and customer segment, which destination deserves the next validation investment, under what operating assumptions, through which customer/channel route, and what new evidence would change that choice?

The common representation separates supplier, buyer, offer, geographic scope and jurisdiction, channel, delivery, settlement, economic conditions, success criteria and validation action. A route ID is not a country code. It supports multiple business units without claiming that a generic model captures every industry's economics.

## Evidence and model boundaries

- Public material is stored with its URL, retrieval time, available publication date, country and source type. Search summaries are explicitly distinguishable from full-page text.
- Each retained fact must have a quotation found in the collected source. A second model pass reviews interpretation and applicability. Exact matching and model review reduce some errors; neither proves independent factual correctness.
- Macroeconomic indicators come from the World Bank API. Population, GDP per person, imports and internet use describe context, not the number of buyers for a particular product.
- US-facing trade guides may contain origin-specific advice. Research instructions explicitly prevent assuming such preferences apply to other origins.
- User business assumptions and user-reported field observations remain identified as such. The system does not invent interviews, orders, willingness-to-pay or legal clearance.

## What the harness controls

The harness runs explicit stages, caps at two planned searches per target (eight total), with at most one targeted official-source follow-up per destination, stores stage checkpoints, deduplicates URLs and titles, limits repeated commercial domains, supplements curated official entry pages where applicable, checks quoted spans, filters cross-market references, executes arithmetic in code and preserves independent input snapshots for each run. Completed phases are reusable after a failure. Regulatory facts require official full-page text or explicitly attributed user documents. Curated pages are starting points for applicability research, not automatic legal clearance. New runs retrieve fresh sources and read saved field observations. There is no scheduled autonomous monitoring in this version.

The knowledge store is useful because a decision can be traced back to a route-specific fact and source, then reconsidered after changed assumptions or new observations. It is not described as a large proprietary corpus: its actual size is visible per research run.

## Calculation and evaluation

Monthly volumes are a parameterized scenario. Price and demand ranges have no estimated probability distribution. Recurring operations use volume, realized price and costs over three specified levels. One-off transactions hold quantity fixed and vary delay (0/1/3 months), price and costs; delivery beyond the horizon contributes no in-horizon revenue. Both models have 27 combinations, without calibrated probabilities. Sensitivity varies one factor at a time. Portfolio selection enumerates subsets of up to four routes, or only single routes when alternatives are mutually exclusive, and maximizes base-case contribution under the declared entry-investment ceiling; unresolved access is explicitly shown.

With supplied sales history, a rolling one-step validation compares a last-value model with a bounded damped log trend. The best historical MAE selects a method. The plotted range expands an empirical absolute-error quantile with square root of horizon. It is not a probabilistically calibrated confidence interval. Short series, regime changes, seasonality and model selection on a small holdout limit forecast reliability.

## Next evidence required for a stronger portfolio claim

1. Real product owner confirms the offer and operating costs.
2. Interview or channel outreach records establish actual customer problems and procurement constraints.
3. A held-out set of comparable research decisions is judged against manually verified sources and calculations.
4. Actual outcomes are compared to the recorded predictions and decision thresholds over time.

Engineering tests and live provider execution verify implementation; they do not establish that the product beats a professional analyst, a financial model or another AI tool. A candidate should describe only the work she actually performed and can explain.

## Geography and actor scope

Multiple province, customer or channel routes may share a country. World Bank requests use the explicit country jurisdiction and are deduplicated; observations remain labeled country-level. Domestic routes do not receive cross-border customs seed pages. Searches and synthesis receive buyer, geography, channel, delivery, settlement and success context. Regional and customer-level data are obtained through scoped source research and user materials; no structured regional statistics connector is claimed. The system does not forecast aggregate bilateral trade or execute payments.
