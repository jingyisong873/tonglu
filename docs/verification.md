# Release verification

Local verification on 26 October 2026 with Node.js 24.22.1, Linux x64.

| Check | Result |
|---|---|
| Automated tests | 45 passed: 30 calculation/research tests, 5 stream/cancellation tests and 10 storage/HTTP tests |
| TypeScript | `npm run typecheck` passed |
| Production build | `npm run build` passed with Vite 8.3.5 |
| Dependency advisories | `npm audit` reported zero known vulnerabilities, including development dependencies, at verification time |
| Example regeneration | All three examples regenerated; robot case retains 81 scenarios |
| HTTP behavior | Covers invalid inputs, cross-site requests, stale writes, concurrent runs, immediate restart recovery, UTF-8 body limits and static-file containment |
| Persistence | Accepted updates survive SQLite close and reopen |

The runtime tests use synthetic fixtures and temporary databases. No paid-model call or current external-source accuracy evaluation was performed in this verification. A graphical review of the standalone UI was not completed. The application is not independently security audited or verified for multi-user deployment.

## Public release

[GitHub Actions run 40348273993](https://github.com/jingyisong873/tonglu/actions/runs/40348273993) verified commit `6152d0c8474b95875bb6be09c34da4c9f8f964c6` on Linux and Windows. Both jobs passed dependency installation, tests, type checking, production builds, example generation and the dependency advisory check. The release job then published [v0.1.0](https://github.com/jingyisong873/tonglu/releases/tag/v0.1.0), with ZIP and tar.gz source archives and SHA-256 checksums.

The repository's workflow badge reports the current branch status. This record refers to the versioned release above.
