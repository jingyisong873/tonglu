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

GitHub Actions configuration is included. Remote CI and public release status must be checked on the repository after publication; local results do not establish a successful GitHub run.
