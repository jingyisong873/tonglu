# Architecture

This standalone release separates the portable project logic from its original hosted deployment.

| Component | Responsibility |
|---|---|
| `app/market` | Input editing, scenario views, evidence, actions and run history |
| `lib/market/harness.ts` | Bounded LLM/tool orchestration, quotation checks, scoped review and checkpoints |
| `lib/market/economics.ts` | Deterministic monthly economics, discrete scenarios, sensitivities and portfolios |
| `lib/market/forecast.ts` | Rolling baseline comparison for supplied monthly observations |
| `lib/market/data.ts` | World Bank data with observed-year and retrieval metadata |
| `server/research.mjs` | Task ownership, cancellation, observer subscriptions and shutdown |
| `server/store.mjs` | Local SQLite projects, immutable run inputs, facts and optimistic revisions |
| `server/server.mjs` | Local HTTP API and static production assets |
| `server/replay.mjs` | Explicitly synthetic fixture provider; no network or real model calls |

The original hosted version used D1 behind its owner's access boundary. This distribution uses the Node.js SQLite API and a loopback-only HTTP server. It contains no hosted workspace identifiers, platform credentials or production records.

Live mode calls the provider on the server. Browser code receives progress, validated output and calculations, never API credentials. Source text is treated as input data in the prompts. Quote-location checks establish that text occurs in a source; they cannot establish that the source is true or that the model's interpretation is always correct.

Research execution belongs to the local server; HTTP streams are detachable observers. Reconnecting replays recorded progress and subscribes to the same active task. Explicit cancellation pauses the task. Terminal results and searchable facts are committed together. Shutdown waits for task cancellation and persistence before closing SQLite; startup marks interrupted tasks paused for manual resume. Each execution retains the nine-minute limit. One server process owns each workspace; there is no automatic scheduler or multi-process queue. The single-user store is not a tenant-isolated database. Research actions are recorded plans and observations; the software does not contact customers, execute trades or transfer funds.
