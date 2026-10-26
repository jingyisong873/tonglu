import { createServer } from "vite";
import { createApp } from "../server/server.mjs";

const api = createApp();
await new Promise((resolve, reject) => {
  api.once("error", reject);
  api.listen(8787, "127.0.0.1", resolve);
});
const ui = await createServer();
await ui.listen();
ui.printUrls();
console.log(
  process.env.DEEPSEEK_API_KEY
    ? "Live mode: your configured model is enabled."
    : "Fixture replay: no API key, no LLM calls; all customer evidence is synthetic.",
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await ui.close();
    api.close(() => process.exit(0));
  });
