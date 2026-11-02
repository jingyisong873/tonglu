import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { Store } from "../../server/store.mjs";
import { createApp } from "../../server/server.mjs";
import { replayConfig } from "../../server/replay.mjs";
import { sampleInput } from "../../lib/market/templates.ts";
import { newRun } from "../../lib/market/harness.ts";

const post = (url, value = {}) =>
  fetch(url, { method: "POST", body: JSON.stringify(value) });
const readEvents = async (response) =>
  (await response.text()).trim().split("\n").filter(Boolean).map(JSON.parse);

async function workspace(t, options = {}) {
  const store = options.store ?? new Store(":memory:");
  const server = createApp({ store, live: false, ...options });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await server.research?.shutdown();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });
  return { store, server, base: `http://127.0.0.1:${server.address().port}` };
}

// Hold exactly one model request; tests control completion or cancel it through HTTP.
function heldProvider({ honorAbort = true } = {}) {
  const entered = Promise.withResolvers();
  const gate = Promise.withResolvers();
  let held = false;
  let calls = 0;
  const configForRun = (run) => {
    const config = replayConfig(run);
    const fetcher = config.fetcher;
    config.fetcher = async (url, init) => {
      calls++;
      if (!held) {
        held = true;
        const signal = init.signal;
        signal.throwIfAborted();
        const aborted = Promise.withResolvers();
        const onAbort = () => aborted.reject(signal.reason);
        if (honorAbort) signal.addEventListener("abort", onAbort, { once: true });
        entered.resolve({ runId: run.id, signal });
        try {
          await (honorAbort ? Promise.race([gate.promise, aborted.promise]) : gate.promise);
        } finally {
          signal.removeEventListener("abort", onAbort);
        }
      }
      return fetcher(url, init);
    };
    return config;
  };
  return {
    configForRun,
    entered: entered.promise,
    release: gate.resolve,
    get calls() { return calls; },
  };
}

test("disconnecting an observer preserves research and reconnecting resumes its events", { timeout: 10000 }, async (t) => {
  const provider = heldProvider();
  const { store, server, base } = await workspace(t, { configForRun: provider.configForRun });
  const project = store.createProject(sampleInput());
  const endpoint = `${base}/api/market/projects/${project.id}/run`;
  const disconnected = new Promise((resolve) => {
    server.once("request", (_req, res) => res.once("close", resolve));
  });
  const response = await post(endpoint);
  assert.equal(response.status, 200);
  const held = await provider.entered;
  const reader = response.body.getReader();
  await reader.read();
  await reader.cancel();
  reader.releaseLock();
  await disconnected;

  assert.equal(held.signal.aborted, false, "disconnect must not cancel the provider request");
  assert.equal(store.getRun(held.runId).status, "running");
  assert.equal((await post(endpoint)).status, 409, "the same task remains active after disconnect");

  const observer = await fetch(`${base}/api/market/runs/${held.runId}/events`);
  assert.equal(observer.status, 200);
  assert.equal(provider.calls, 1, "observing must not start another model request");
  provider.release();
  const events = await readEvents(observer);
  assert.ok(events.some((event) => event.type === "started" && event.runId === held.runId));
  assert.ok(events.some((event) => event.type === "progress" && event.stage === "plan"));
  assert.equal(events.find((event) => event.type === "result")?.run.status, "completed");
  assert.equal(store.runHistory(project.id).length, 1);
  assert.equal(store.getRun(held.runId).status, "completed");
  const completed = await readEvents(await fetch(`${base}/api/market/runs/${held.runId}/events`));
  assert.equal(completed.find((event) => event.type === "result")?.run.id, held.runId);
});

test("explicit cancellation pauses a task and the same task can be resumed", { timeout: 10000 }, async (t) => {
  const provider = heldProvider();
  const { store, base } = await workspace(t, { configForRun: provider.configForRun });
  const project = store.createProject(sampleInput());
  const endpoint = `${base}/api/market/projects/${project.id}/run`;
  const response = await post(endpoint);
  const held = await provider.entered;
  const cancel = `${base}/api/market/runs/${held.runId}/cancel`;
  const acknowledgement = await post(cancel);
  assert.ok(acknowledgement.ok);
  await acknowledgement.json();
  const stopped = await readEvents(response);
  assert.equal(held.signal.aborted, true);
  assert.ok(stopped.some((event) => event.type === "error"));
  assert.equal(store.getRun(held.runId).status, "paused");
  assert.equal(store.runHistory(project.id)[0].status, "paused");
  assert.ok((await post(cancel)).ok, "cancelling an already paused task is harmless");

  const resumed = await readEvents(await post(endpoint, { resume: held.runId }));
  const result = resumed.find((event) => event.type === "result");
  assert.equal(result?.run.id, held.runId);
  assert.equal(result.run.status, "completed");
  assert.equal(store.runHistory(project.id).length, 1);
  assert.ok((await post(cancel)).ok, "cancelling a completed task must not overwrite it");
  assert.equal(store.getRun(held.runId).status, "completed");
});

test("startup pauses an orphaned run without making model calls and permits manual resume", { timeout: 10000 }, async (t) => {
  const store = new Store(":memory:");
  const project = store.createProject(sampleInput());
  const run = newRun(project.id, project.input, "fixture-replay");
  store.startRun(project, run);
  let configurations = 0;
  const { base } = await workspace(t, {
    store,
    configForRun: (state) => { configurations++; return replayConfig(state); },
  });
  const reopened = await fetch(`${base}/api/market/projects/${project.id}`).then((r) => r.json());
  assert.equal(reopened.run.id, run.id);
  assert.equal(reopened.run.status, "paused");
  assert.equal(reopened.history[0].status, "paused");
  assert.equal(configurations, 0);
  const resumed = await readEvents(await post(`${base}/api/market/projects/${project.id}/run`, { resume: run.id }));
  assert.equal(resumed.find((event) => event.type === "result")?.run.id, run.id);
  assert.equal(configurations, 1);
});

test("a provider response arriving after cancellation cannot complete the research", { timeout: 10000 }, async (t) => {
  const provider = heldProvider({ honorAbort: false });
  t.after(provider.release);
  const { store, base } = await workspace(t, { configForRun: provider.configForRun });
  const project = store.createProject(sampleInput());
  const response = await post(`${base}/api/market/projects/${project.id}/run`);
  const held = await provider.entered;
  try {
    assert.ok((await post(`${base}/api/market/runs/${held.runId}/cancel`)).ok);
    assert.equal(held.signal.aborted, true);
  } finally {
    provider.release();
  }
  const events = await readEvents(response);
  assert.ok(events.some((event) => event.type === "error"));
  assert.ok(events.every((event) => event.type !== "result"));
  assert.equal(store.getRun(held.runId).status, "paused");
  assert.equal(provider.calls, 1, "no further model calls should follow the cancelled request");
});

test("provider setup failure does not leave a running task or prevent another attempt", { timeout: 10000 }, async (t) => {
  let failOnce = true;
  const { store, base } = await workspace(t, {
    configForRun: (run) => {
      if (failOnce) { failOnce = false; throw new Error("fixture configuration unavailable"); }
      return replayConfig(run);
    },
  });
  const project = store.createProject(sampleInput());
  const endpoint = `${base}/api/market/projects/${project.id}/run`;
  const failure = await post(endpoint);
  if (failure.ok) {
    assert.ok((await readEvents(failure)).some((event) => event.type === "error"));
  } else {
    assert.equal(failure.status, 500);
    await failure.json();
  }
  assert.ok(store.runHistory(project.id).every((run) => run.status !== "running"));
  const next = await readEvents(await post(endpoint));
  assert.equal(next.find((event) => event.type === "result")?.run.status, "completed");
});

test("shutdown pauses active research and saves it before storage is closed", { timeout: 10000 }, async (t) => {
  const provider = heldProvider();
  const { store, server, base } = await workspace(t, { configForRun: provider.configForRun });
  const project = store.createProject(sampleInput());
  const response = await post(`${base}/api/market/projects/${project.id}/run`);
  const held = await provider.entered;
  assert.equal(typeof server.research.shutdown, "function");
  await server.research.shutdown();
  assert.equal(held.signal.aborted, true);
  assert.equal(store.getRun(held.runId).status, "paused");
  assert.ok((await readEvents(response)).some((event) => event.type === "error"));
});
