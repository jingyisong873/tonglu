import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../../server/store.mjs";
import { createApp } from "../../server/server.mjs";
import { sampleInput } from "../../lib/market/templates.ts";

test("local store rejects stale updates and preserves the accepted version", () => {
  const db = new Store(":memory:");
  try {
    const p = db.createProject(sampleInput());
    const updated = db.updateProject(
      p.id,
      1,
      { ...p.input, name: "Changed" },
      [],
    );
    assert.equal(updated.revision, 2);
    assert.throws(() => db.updateProject(p.id, 1, p.input, []));
    assert.equal(db.getProject(p.id).input.name, "Changed");
  } finally {
    db.close();
  }
});

test("HTTP fixture flow persists a complete run and rejects cross-origin mutation", async () => {
  const db = new Store(":memory:");
  const server = createApp({ store: db, live: false });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const bad = await fetch(base + "/api/market/projects", {
      method: "POST",
      headers: { origin: "https://untrusted.example" },
      body: "{}",
    });
    assert.equal(bad.status, 403);
    const invalid = await fetch(base + "/api/market/projects", {
      method: "POST",
      body: "{}",
    });
    assert.equal(invalid.status, 400);
    const created = await fetch(base + "/api/market/projects", {
      method: "POST",
      body: JSON.stringify(sampleInput()),
    });
    assert.equal(created.status, 201);
    const { project } = await created.json();
    const response = await fetch(
      `${base}/api/market/projects/${project.id}/run`,
      { method: "POST", body: "{}" },
    );
    const events = (await response.text()).trim().split("\n").map(JSON.parse);
    const result = events.find((e) => e.type === "result");
    assert.ok(result, JSON.stringify(events));
    assert.equal(result.run.status, "completed");
    assert.equal(result.run.usage.calls, 0);
    assert.equal(result.run.facts.length, 3);
    assert.equal(result.run.calculations.markets.length, 3);
    assert.equal(
      result.run.calculations.markets.reduce((s, m) => s + m.scenario.total, 0),
      81,
    );
    assert.ok(result.run.warnings.some((w) => w.includes("示例回放")));
    const reopened = await fetch(
      `${base}/api/market/projects/${project.id}`,
    ).then((r) => r.json());
    assert.equal(reopened.run.id, result.run.id);
    const facts = await fetch(
      `${base}/api/market/projects/${project.id}/knowledge?run=${result.run.id}`,
    ).then((r) => r.json());
    assert.equal(facts.facts.length, 3);
    const again = await fetch(`${base}/api/market/projects/${project.id}/run`, {
      method: "POST",
      body: JSON.stringify({ resume: result.run.id }),
    });
    assert.equal(again.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
});
