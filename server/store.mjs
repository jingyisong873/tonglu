import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

// Local, single-user storage. All write values use bound parameters.
export class Store {
  constructor(path = ".tonglu/workspace.sqlite") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, project_id TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS runs_project ON runs(project_id);
      CREATE TABLE IF NOT EXISTS facts(id TEXT PRIMARY KEY, project_id TEXT NOT NULL, run_id TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS facts_project ON facts(project_id);
    `);
  }
  close() {
    this.db.close();
  }
  listProjects() {
    return this.db
      .prepare("SELECT payload FROM projects")
      .all()
      .map((r) => JSON.parse(r.payload))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 60);
  }
  getProject(id) {
    const r = this.db
      .prepare("SELECT payload FROM projects WHERE id=?")
      .get(id);
    return r ? JSON.parse(r.payload) : null;
  }
  createProject(input) {
    const now = new Date().toISOString();
    const p = {
      id: randomUUID(),
      input,
      revision: 1,
      actions: [],
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare("INSERT INTO projects VALUES (?,?)")
      .run(p.id, JSON.stringify(p));
    return p;
  }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  writeProject(p) {
    this.db
      .prepare("UPDATE projects SET payload=? WHERE id=?")
      .run(JSON.stringify(p), p.id);
    return p;
  }
  updateProject(id, revision, input, actions) {
    return this.transaction(() => {
      const p = this.getProject(id);
      if (!p || p.revision !== revision)
        throw Object.assign(new Error("项目已更新，请重新打开后保存"), {
          status: 409,
        });
      return this.writeProject({
        ...p,
        input,
        actions,
        revision: revision + 1,
        updatedAt: new Date().toISOString(),
      });
    });
  }
  startRun(p, run) {
    return this.transaction(() => {
      const current = this.getProject(p.id);
      if (!current || current.revision !== p.revision)
        throw Object.assign(new Error("项目已更新，请重新打开"), {
          status: 409,
        });
      this.saveRun(run);
      return this.writeProject({
        ...current,
        latestRunId: run.id,
        revision: current.revision + 1,
        updatedAt: run.updatedAt,
      });
    });
  }
  saveRun(run) {
    run.updatedAt = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO runs VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      )
      .run(run.id, run.projectId, JSON.stringify(run));
  }
  getRun(id) {
    const r = this.db.prepare("SELECT payload FROM runs WHERE id=?").get(id);
    return r ? JSON.parse(r.payload) : null;
  }
  runHistory(id) {
    return this.db
      .prepare("SELECT payload FROM runs WHERE project_id=?")
      .all(id)
      .map((r) => JSON.parse(r.payload))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 12)
      .map((r) => ({
        id: r.id,
        status: r.status,
        stage: r.stage,
        createdAt: r.createdAt,
        summary: r.synthesis?.summary,
      }));
  }
  saveFacts(run) {
    const insert = this.db.prepare(
      "INSERT OR REPLACE INTO facts VALUES (?,?,?,?)",
    );
    this.transaction(() => {
      for (const f of run.facts ?? [])
        insert.run(
          `${run.id}:${f.id}`,
          run.projectId,
          run.id,
          JSON.stringify(f),
        );
    });
  }
  searchFacts(id, q = "", market = "", dimension = "", run = "") {
    return this.db
      .prepare("SELECT payload,run_id FROM facts WHERE project_id=?")
      .all(id)
      .map((r) => ({ ...JSON.parse(r.payload), runId: r.run_id }))
      .filter(
        (f) =>
          (!run || f.runId === run) &&
          (!market || f.marketCode === market) &&
          (!dimension || f.dimension === dimension) &&
          (!q ||
            JSON.stringify(f)
              .toLowerCase()
              .includes(q.toLowerCase().slice(0, 100))),
      )
      .slice(0, 200);
  }
}
