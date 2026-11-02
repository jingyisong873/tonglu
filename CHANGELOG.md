# Changelog

## 0.2.0

- Research continues after the browser disconnects; reopening a project reconnects to the same task.
- Explicit stopping pauses a run; service restarts retain saved stages for manual resume without automatic model calls.
- Separate task execution from HTTP observers, preserve per-project exclusion and commit completed results with searchable facts.
- Record the broader market, country and company research scope separately from current capabilities.

## 0.1.0

Initial standalone source distribution.

- Local React workspace with SQLite projects, run history and evidence search.
- Source-based research through DeepSeek, bounded review stages and resumable checkpoints.
- Deterministic economics for recurring operations and one-off transactions, with 27 scenarios per route.
- Three synthetic examples and an offline replay mode.
- Request validation, revision conflicts, per-project run exclusion, loopback access checks and static-file containment.

- Reject truncated research streams, preserve split UTF-8 messages and propagate cancellation to background data requests.

- Updated Zod to 4.6.7 and Vite to 8.3.5 to address dependency advisories.

See [verification](docs/verification.md) for the checks completed before publication.
