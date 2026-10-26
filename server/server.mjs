import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { Store } from "./store.mjs";
import { replayConfig } from "./replay.mjs";
import { inputSchema } from "../lib/market/schema.ts";
import { newRun, runHarness } from "../lib/market/harness.ts";
import { providerConfig } from "../lib/deepseek.ts";

const actionSchema = z.object({
  id: z.string().max(100),
  marketCode: z.string().max(80),
  title: z.string().max(1000),
  status: z.enum(["todo", "doing", "done"]),
  outcome: z.string().max(10000),
  updatedAt: z.string().max(100),
});
const updateSchema = z.object({
  revision: z.number().int().positive(),
  input: inputSchema,
  actions: z.array(actionSchema).max(100),
});
const runSchema = z.object({ resume: z.string().uuid().optional() }).strict();
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};
const reply = (res, status, body) => {
  res.writeHead(status, {
    ...securityHeaders,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
};
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
async function body(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    // A valid 100,000-character document may take 400,000 UTF-8 bytes.
    if (length > 600000) throw fail("资料过长", 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw fail("JSON 格式无效");
  }
}

export function createApp({
  store = new Store(),
  live = Boolean(process.env.DEEPSEEK_API_KEY),
  uiPort = 5173,
  staticDir = resolve("dist"),
  configForRun = live ? providerConfig : replayConfig,
} = {}) {
  staticDir = resolve(staticDir);
  const activeProjects = new Set();
  return createServer(async (req, res) => {
    try {
      // Loopback binding + Host and Origin checks protect this local workspace.
      const host = req.headers.host || "";
      if (!/^(localhost|127\.0\.0\.1):\d+$/.test(host))
        throw fail("仅支持本机访问", 403);
      const url = new URL(req.url, `http://${host}`);
      const origins = new Set([
        `http://${host}`,
        `http://127.0.0.1:${uiPort}`,
        `http://localhost:${uiPort}`,
      ]);
      if (req.headers.origin && !origins.has(req.headers.origin))
        throw fail("请求来源不符", 403);
      if (req.headers["sec-fetch-site"] === "cross-site")
        throw fail("不接受跨站访问", 403);
      if (url.pathname === "/api/status" && req.method === "GET")
        return reply(res, 200, {
          configured: live,
          enabled: true,
          mode: live ? "live" : "fixture-replay",
          model: live
            ? process.env.DEEPSEEK_MODEL || "deepseek-flash"
            : "fixture-replay",
        });
      if (url.pathname === "/api/market/projects" && req.method === "GET")
        return reply(res, 200, { projects: store.listProjects() });
      if (url.pathname === "/api/market/projects" && req.method === "POST")
        return reply(res, 201, {
          project: store.createProject(inputSchema.parse(await body(req))),
        });
      const match = url.pathname.match(
        /^\/api\/market\/projects\/([a-zA-Z0-9-]+)(?:\/(knowledge|run))?$/,
      );
      if (match) {
        const [, id, action] = match;
        let p = store.getProject(id);
        if (!p) throw fail("项目不存在", 404);
        if (!action && req.method === "GET")
          return reply(res, 200, {
            project: p,
            run: p.latestRunId ? store.getRun(p.latestRunId) : null,
            history: store.runHistory(id),
          });
        if (!action && req.method === "PATCH") {
          const b = updateSchema.parse(await body(req));
          return reply(res, 200, {
            project: store.updateProject(id, b.revision, b.input, b.actions),
          });
        }
        if (action === "knowledge" && req.method === "GET")
          return reply(res, 200, {
            facts: store.searchFacts(
              id,
              ...["q", "market", "dimension", "run"].map(
                (k) => url.searchParams.get(k) || "",
              ),
            ),
          });
        if (action === "run" && req.method === "POST") {
          const b = runSchema.parse(await body(req));
          // The project may change while a request body is still arriving.
          p = store.getProject(id);
          if (activeProjects.has(id))
            throw fail("项目已有研究正在运行", 409);
          let run;
          if (b.resume) {
            run = store.getRun(b.resume);
            if (
              !run ||
              run.projectId !== id ||
              run.id !== p.latestRunId ||
              run.status === "completed"
            )
              throw fail("无法恢复这次研究");
            if (
              JSON.stringify(run.input) !== JSON.stringify(p.input) ||
              JSON.stringify(run.actionsSnapshot ?? []) !==
                JSON.stringify(p.actions)
            )
              throw fail("输入或反馈已变化，请开始新的研究", 409);
          } else {
            run = newRun(
              id,
              p.input,
              live
                ? process.env.DEEPSEEK_MODEL || "deepseek-flash"
                : "fixture-replay",
              p.actions,
            );
            p = store.startRun(p, run);
          }
          const abort = new AbortController();
          res.on("close", () => {
            if (!res.writableEnded) abort.abort();
          });
          const config = configForRun(run);
          config.signal = AbortSignal.any([
            abort.signal,
            AbortSignal.timeout(540000),
          ]);
          res.writeHead(200, {
            ...securityHeaders,
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-store",
          });
          activeProjects.add(id);
          const send = (event) => {
            if (!res.destroyed) res.write(JSON.stringify(event) + "\n");
          };
          const heartbeat = setInterval(
            () => send({ type: "heartbeat" }),
            12000,
          );
          send({ type: "started", project: p, runId: run.id });
          try {
            await runHarness(
              run,
              config,
              async (s) => store.saveRun(s),
              send,
              p.actions,
            );
            if (!live)
              run.usage = {
                model: "fixture-replay",
                calls: 0,
                inputTokens: 0,
                outputTokens: 0,
                searchCalls: 0,
                fetchCalls: 0,
              };
            store.saveRun(run);
            store.saveFacts(run);
            send({ type: "result", run });
          } catch (e) {
            send({ type: "error", runId: run.id, message: e.message });
          } finally {
            activeProjects.delete(id);
            clearInterval(heartbeat);
            res.end();
          }
          return;
        }
      }
      const runMatch = url.pathname.match(
        /^\/api\/market\/runs\/([a-zA-Z0-9-]+)$/,
      );
      if (runMatch && req.method === "GET") {
        const run = store.getRun(runMatch[1]);
        if (!run) throw fail("研究不存在", 404);
        return reply(res, 200, { run });
      }
      if (url.pathname.startsWith("/api/")) throw fail("接口不存在", 404);
      if (req.method !== "GET" && req.method !== "HEAD")
        throw fail("请求方法不支持", 405);
      let requested;
      try {
        requested = decodeURIComponent(url.pathname);
      } catch {
        throw fail("路径编码无效");
      }
      const file = resolve(
        staticDir,
        "." +
          (requested === "/" || requested === "/about"
            ? "/index.html"
            : requested),
      );
      if (!file.startsWith(staticDir + sep)) throw fail("路径无效", 403);
      let bytes;
      try {
        const [root, target] = await Promise.all([realpath(staticDir), realpath(file)]);
        if (!target.startsWith(root + sep)) throw fail("路径无效", 403);
        bytes = await readFile(target);
      } catch (error) {
        if (error.status) throw error;
        throw fail("页面未构建，请先运行 npm run build", 404);
      }
      const type =
        {
          ".html": "text/html",
          ".js": "application/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".json": "application/json",
        }[extname(file)] || "application/octet-stream";
      res.writeHead(200, {
        ...securityHeaders,
        "Cache-Control": "no-cache",
        "Content-Type": type + "; charset=utf-8",
      });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch (e) {
      if (res.headersSent) return res.end();
      reply(res, e instanceof z.ZodError ? 400 : e.status || 500, {
        message:
          e instanceof z.ZodError
            ? e.issues[0]?.message
            : e.status
              ? e.message
              : "操作失败，请检查本地服务日志",
      });
    }
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const port = Number(process.env.PORT || 8787);
  createApp().listen(port, "127.0.0.1", () =>
    console.log(
      `Tonglu: http://127.0.0.1:${port} (${process.env.DEEPSEEK_API_KEY ? "live model" : "fixture replay; no model calls"})`,
    ),
  );
}
