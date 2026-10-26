# Tonglu

[![Verify](https://github.com/jingyisong873/tonglu/actions/workflows/ci.yml/badge.svg)](https://github.com/jingyisong873/tonglu/actions/workflows/ci.yml)

A local workspace for comparing markets, channels and transaction proposals. Keep source evidence, business assumptions and reproducible calculations together, then examine which conditions change the decision.

[中文](README.md) · [Examples](examples/) · [Architecture](docs/architecture.md) · [Configuration](docs/configuration.md) · [Security](SECURITY.md)

## Run locally

Install Node.js 24, then run from the project directory:

```sh
git clone https://github.com/jingyisong873/tonglu.git
cd tonglu
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. The default fixture replay needs no API key or network after installation. Prices, quantities, costs and timing drive real calculations. Customer evidence and explanatory text are fixed synthetic examples, labelled in the interface and exports. The application interface and research output are currently in Chinese.

For a production build on your own machine:

```sh
npm run build
npm start
# http://127.0.0.1:8787
```

Data lives in `.tonglu/workspace.sqlite`. Stop the service before backing up the entire `.tonglu` directory.

## What it does

- Compare up to four routes, with separate fields for buyers, geography, channels, delivery and settlement.
- Locate quotations in source text and retain source dates and scope.
- Calculate contribution, break-even timing, sensitivity and budget-constrained selections outside the language model.
- Evaluate 27 scenarios per route. One-off transactions count their quantity once; exclusive proposals select at most one option.
- Save input snapshots, research checkpoints, evidence and subsequent feedback.

The [examples](examples/) cover desktop robots in three overseas markets, regional distribution and a choice between two service proposals. All use synthetic assumptions. Scenario counts are not probabilities, and calculated operating contribution is not realized profit.

## Live research

Copy `.env.example` to `.env`, enter your `DEEPSEEK_API_KEY` and a model supported by your account, then restart. Web-enabled runs also use DeepSeek Search / Fetch and World Bank data. See [configuration](docs/configuration.md) for endpoints, data flow and troubleshooting.

The key stays on the server. Project inputs, selected documents and feedback are sent to the model provider during live research. A disconnected browser cancels the active request; saved checkpoints can be resumed.

## Development

```sh
npm test
npm run typecheck
npm run build
npm run example
```

The example command regenerates JSON and Markdown from the current calculation engine. Tests cover economics, source scope, quote matching, recovery, revision conflicts and HTTP behavior. See the [local verification record](docs/verification.md) for what was actually run.

This release is for a single user on a local machine. It has no multi-user authentication or tenant isolation. The model omits working capital, actual payment timing, financing, subscription retention and shared capacity.

## License

[MIT](LICENSE). Dependencies retain their own licenses; see [third-party notices](THIRD_PARTY_NOTICES.md). External model services and retrieved web content are not relicensed by this repository.
