import test from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { Store } from "../../server/store.mjs";
import { createApp } from "../../server/server.mjs";
import { replayConfig } from "../../server/replay.mjs";
import { sampleInput } from "../../lib/market/templates.ts";
import { newRun } from "../../lib/market/harness.ts";

async function workspace(t, options = {}) {
  const store = options.store ?? new Store(":memory:");
  const server = createApp({ store, live: false, ...options });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });
  return { store, server, base: `http://127.0.0.1:${server.address().port}` };
}
const events = async (response) => (await response.text()).trim().split("\n").map(JSON.parse);
const post = (url, body) => fetch(url, { method: "POST", body: JSON.stringify(body) });

// Exercise boundaries through HTTP rather than inspecting implementation details.
test("untrusted hosts, origins and cross-site requests cannot read local projects", async (t) => {
  const { base } = await workspace(t);
  for (const headers of [
    { host: "attacker.example:8787" },
    { origin: "null" },
    { origin: "https://attacker.example" },
    { "sec-fetch-site": "cross-site" },
  ]) {
    const status = await new Promise((resolve, reject) => {
      const req = request(base + "/api/market/projects", { headers }, res => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on("error", reject);
      req.end();
    });
    assert.equal(status, 403, JSON.stringify(headers));
  }
  const allowed = await fetch(base + "/api/market/projects", { headers: { origin: base } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("x-frame-options"), "DENY");
  assert.equal(allowed.headers.get("cache-control"), "no-store");
});

test("run bodies reject invalid types without creating a research record", async (t) => {
  const { store, base } = await workspace(t);
  const p = store.createProject(sampleInput());
  for (const payload of [null, [], "run", { resume: 7 }, { resume: "invalid" }, { unknown: true }]) {
    assert.equal((await post(`${base}/api/market/projects/${p.id}/run`, payload)).status, 400);
  }
  assert.equal(store.runHistory(p.id).length, 0);
});

test("valid long Chinese input is accepted and oversized bodies are rejected", async (t) => {
  const { base } = await workspace(t);
  const input = sampleInput();
  input.sources = Array.from({ length: 3 }, (_, i) => ({
    id: `D${i}`, title: "测试资料", text: "中".repeat(30000), kind: "document", url: "", marketCode: "ALL",
  }));
  assert.equal((await post(base + "/api/market/projects", input)).status, 201);
  const huge = await fetch(base + "/api/market/projects", { method: "POST", body: " ".repeat(600001) });
  assert.equal(huge.status, 413);
});

test("research uses the latest input when a project changes while the body arrives", async (t) => {
  const { base, store, server } = await workspace(t);
  const p = store.createProject(sampleInput());
  const received = new Promise((resolve) => server.once("request", resolve));
  const req = request(`${base}/api/market/projects/${p.id}/run`, { method: "POST", headers: { "Content-Length": 2 } });
  const response = new Promise((resolve, reject) => {
    req.on("error", reject);
    req.on("response", async (res) => {
      let text = "";
      for await (const chunk of res) text += chunk;
      resolve({ status: res.statusCode, text });
    });
  });
  req.write("{");
  await received;
  const changed = { ...p.input, name: "Updated while uploading" };
  const patch = await fetch(`${base}/api/market/projects/${p.id}`, {
    method: "PATCH", body: JSON.stringify({ revision: p.revision, input: changed, actions: [] }),
  });
  assert.equal(patch.status, 200);
  req.end("}");
  const result = await response;
  assert.equal(result.status, 200);
  const completed = result.text.trim().split("\n").map(JSON.parse).find(e => e.type === "result");
  assert.equal(completed.run.input.name, changed.name);
});

test("one active research run per project; the lock clears on completion", async (t) => {
  let unlock;
  const gate = new Promise(resolve => { unlock = resolve; });
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  let held = false;
  const { store, base } = await workspace(t, { configForRun: run => {
    const config = replayConfig(run);
    const original = config.fetcher;
    config.fetcher = async (...args) => {
      if (!held) { held = true; entered(); await gate; }
      return original(...args);
    };
    return config;
  }});
  t.after(() => unlock());
  const p = store.createProject(sampleInput());
  const endpoint = `${base}/api/market/projects/${p.id}/run`;
  const first = post(endpoint, {});
  await started;
  try {
    assert.equal((await post(endpoint, {})).status, 409);
  } finally { unlock(); }
  assert.ok((await events(await first)).some(e => e.type === "result"));
  assert.ok((await events(await post(endpoint, {}))).some(e => e.type === "result"));
});

test("an interrupted run can resume immediately after the server restarts", async (t) => {
  const { store, base } = await workspace(t);
  const p = store.createProject(sampleInput());
  const run = newRun(p.id, p.input, "fixture-replay");
  store.startRun(p, run);
  const response = await post(`${base}/api/market/projects/${p.id}/run`, { resume: run.id });
  assert.equal(response.status, 200);
  const result = (await events(response)).find(e => e.type === "result");
  assert.equal(result.run.id, run.id);
  assert.equal(result.run.status, "completed");
});

test("production assets cannot escape their directory through traversal or symlinks", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "tonglu-static-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const publicDir = join(dir, "dist");
  await mkdir(publicDir);
  await writeFile(join(publicDir, "index.html"), "<!doctype html><title>Tonglu</title>");
  await writeFile(join(dir, "private.txt"), "private sentinel");
  await symlink(join(dir, "private.txt"), join(publicDir, "escape.txt"));
  const { base } = await workspace(t, { staticDir: publicDir });
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal((await fetch(base + "/escape.txt")).status, 403);
  assert.equal((await fetch(base + "/%2e%2e%2fprivate.txt")).status, 403);
  assert.equal((await fetch(base + "/%FF")).status, 400);
  assert.equal(await (await fetch(base, { method: "HEAD" })).text(), "");
});

test("SQLite retains accepted project updates across close and reopen", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "tonglu-db-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "workspace.sqlite");
  const before = new Store(path);
  const p = before.createProject(sampleInput());
  before.updateProject(p.id, 1, { ...p.input, name: "Saved on disk" }, []);
  before.close();
  const after = new Store(path);
  try {
    assert.equal(after.getProject(p.id).input.name, "Saved on disk");
    assert.equal(after.getProject(p.id).revision, 2);
  } finally { after.close(); }
});
