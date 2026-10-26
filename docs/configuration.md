# Configuration

## Runtime

Node.js 24 provides native TypeScript stripping and SQLite. The development UI runs on `127.0.0.1:5173`, proxying `/api` to `127.0.0.1:8787`. The production server serves both the UI and API on port 8787; `PORT` changes that production port.

| Variable | Default | Purpose |
|---|---|---|
| `DEEPSEEK_API_KEY` | Empty | Empty selects fixture replay; a value enables live model requests |
| `DEEPSEEK_MODEL` | `deepseek-flash` | Model identifier supported by your DeepSeek account |
| `PORT` | `8787` | Production HTTP port; the dev proxy uses fixed ports |

Restart after changing `.env`. Never set credentials through `VITE_` variables.

## External requests

Live mode uses fixed provider origins:

| Service | Endpoint | Data sent |
|---|---|---|
| DeepSeek | `https://api.deepseek.com/chat/completions` | Project inputs, selected source text, feedback, calculations and review context |
| DeepSeek Search | `https://api.deepseek.com/v1/tools/search` | Research query and result options |
| DeepSeek Fetch | `https://api.deepseek.com/v1/tools/fetch` | Official-page URL |
| World Bank | `https://api.worldbank.org/v2/` | Country and indicator codes |

Web research can be disabled per project. Live mode still calls the language model when web research is disabled. Provider request redirects are rejected. No real API key is bundled.

Provider contracts: [Search](https://api-docs.deepseek.com/api/search/), [Fetch](https://api-docs.deepseek.com/api/fetch/), [Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/). Model availability and service charges are controlled by the provider.

## Recovery and backup

Research runs through the browser's streamed HTTP connection. Closing it cancels the active request; it is not a background queue. Reopen a failed or interrupted run to resume saved stages. If the input or feedback changed, start a new run so the recorded evidence and assumptions stay consistent.

Stop the application, then copy the complete `.tonglu` directory. SQLite uses WAL mode, so copying only `workspace.sqlite` while the service is running is not a reliable backup.

## Troubleshooting

- **Fixture replay appears:** no API key was loaded. Check the `.env` location and restart.
- **401 or 402 from the provider:** check the account's API credential or balance at the provider. Do not paste keys into issues.
- **Search or fetch is unavailable:** inspect account access and the provider's current service status. Saved run warnings identify missing source collection.
- **409 when saving:** the project revision changed. Reload before editing again.
- **409 when starting research:** a run for that project is already active.
- **Empty page after `npm start`:** run `npm run build` first.
