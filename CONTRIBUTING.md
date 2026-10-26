# Contributing

Please start with a reproducible problem or a concrete workflow. Useful contributions include a failing calculation case, an incorrectly scoped quotation, clearer output wording, or a small sector-specific example with explicit assumptions.

For a bug report, include the Node.js version, replay or live mode, minimal synthetic input, expected result and actual result. Remove credentials, personal details and company documents before attaching anything. For model-related reports, include only a short permitted quotation and source link, with the date and relevant scope.

Run `npm test`, `npm run typecheck` and `npm run build` before proposing code changes. Add a focused test when a business rule or failure mode changes. Keep calculations outside model-generated prose, and do not present scenario counts as probabilities.

Ideas for focused work: benchmark source interpretation against a small labelled set; measure how often users change a decision after reviewing sensitivity; add a documented cash-collection model; or create a tested sector adapter. More features without a task and an evaluation criterion are difficult to assess.

## Releases

Update `package.json`, the lockfile, `CHANGELOG.md` and `docs/releases/vX.Y.Z.md` together. A push to `main` publishes a previously unreleased package version only after the Linux and Windows verification jobs pass. Published releases are left unchanged. GitHub creates the version tag at the verified commit; the release includes source archives and SHA-256 checksums.
