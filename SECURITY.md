# Security

Tonglu is a single-user application intended to run on a trusted local machine. The server binds to `127.0.0.1`, validates Host and Origin, rejects cross-site requests, limits request bodies, and serves files only from the built asset directory. SQLite writes use bound parameters and optimistic revisions. These controls do not provide multi-user authentication.

## Data and credentials

- Keep API credentials in `.env` or process environment variables. They must never use the `VITE_` prefix, which exposes variables to browser bundles.
- `.env`, `.tonglu`, database files and logs are excluded from Git. The local database is not encrypted; protect it with operating-system permissions and disk encryption where needed.
- Live research sends project inputs, selected documents, feedback and research context to DeepSeek. Web mode also sends search queries and official-page URLs to DeepSeek, and country codes to World Bank.
- Fixture replay makes no external research requests. It contains synthetic examples rather than customer records.
- Retrieved text is untrusted. Quote matching checks that a passage occurs in a source; it does not establish the truth of that source or every model interpretation.

Do not expose the server through a public tunnel, reverse proxy or a shared network without adding authentication, authorization, encrypted transport and usage controls.

## Reporting a vulnerability

Use the repository's private vulnerability reporting feature if it is enabled. Otherwise, contact the maintainer privately through the contact method on their GitHub profile. Do not post credentials, private documents or a working data-exfiltration payload in a public issue. Include the affected version, a minimal synthetic reproduction and the impact.

Security fixes target the latest published version. This project does not offer an incident-response SLA.
