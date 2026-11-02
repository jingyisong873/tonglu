import { newRun, runHarness } from "../lib/market/harness.ts";

const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });

// One owner for execution. HTTP responses only observe a task; closing one
// must neither cancel the task nor release its per-project lock.
export class Research {
  constructor({ store, live, configForRun, timeoutMs = 540000 }) {
    this.store = store;
    this.live = live;
    this.configForRun = configForRun;
    this.timeoutMs = timeoutMs;
    this.tasks = new Map();
    this.projects = new Map();
    this.closing = false;
    store.pauseInterruptedRuns();
  }

  start(projectId, resume) {
    if (this.closing) throw fail("服务正在关闭，请稍后继续", 503);
    const p = this.store.getProject(projectId);
    if (!p) throw fail("项目不存在", 404);
    if (this.projects.has(projectId)) throw fail("项目已有研究正在运行", 409);
    let run;
    if (resume) {
      run = this.store.getRun(resume);
      if (!run || run.projectId !== projectId || run.id !== p.latestRunId || run.status === "completed")
        throw fail("无法恢复这次研究");
      if (JSON.stringify(run.input) !== JSON.stringify(p.input) ||
          JSON.stringify(run.actionsSnapshot ?? []) !== JSON.stringify(p.actions))
        throw fail("输入或反馈已变化，请开始新的研究", 409);
    } else {
      run = newRun(projectId, p.input,
        this.live ? process.env.DEEPSEEK_MODEL || "deepseek-flash" : "fixture-replay",
        p.actions);
    }
    // Configure before saving a running record so setup errors leave no orphan.
    const config = this.configForRun(run);
    const abort = new AbortController();
    const signal = AbortSignal.any([
      abort.signal, AbortSignal.timeout(this.timeoutMs),
      ...(config.signal ? [config.signal] : []),
    ]);
    signal.throwIfAborted();
    run.status = "running";
    delete run.error;
    if (resume) this.store.saveRun(run);
    else this.store.startRun(p, run);
    const task = { run, abort, signal, listeners: new Set(), stopReason: null };
    this.tasks.set(run.id, task);
    this.projects.set(projectId, run.id);
    // Let the starting HTTP response attach before the first progress event.
    task.done = Promise.resolve().then(() => this.execute(task, { ...config, signal }));
    return task;
  }

  emit(task, event) {
    for (const listener of task.listeners) {
      try { listener(event); } catch { task.listeners.delete(listener); }
    }
  }

  async execute(task, config) {
    const { run } = task;
    try {
      await runHarness(run, config, async state => {
        if (state.status !== "completed") this.store.saveRun(state);
      },
        event => this.emit(task, event), run.actionsSnapshot ?? []);
      task.signal.throwIfAborted();
      if (!this.live) run.usage = {
        model: "fixture-replay", calls: 0, inputTokens: 0, outputTokens: 0,
        searchCalls: 0, fetchCalls: 0,
      };
      this.store.completeRun(run);
      this.emit(task, { type: "result", run });
    } catch (error) {
      run.status = task.stopReason ? "paused" : "failed";
      run.error = task.stopReason ||
        (task.signal.aborted ? "研究达到时间限制，已完成阶段已保存，可继续研究" :
          error instanceof Error ? error.message : "研究暂未完成");
      try {
        this.store.saveRun(run);
      } catch (saveError) {
        console.error("Could not save research state:", saveError);
        run.error = "研究状态保存失败，请检查本地服务日志";
      }
      this.emit(task, { type: "error", runId: run.id, message: run.error });
    } finally {
      this.projects.delete(run.projectId);
      this.tasks.delete(run.id);
      task.listeners.clear();
    }
  }

  subscribe(runId, listener) {
    const task = this.tasks.get(runId);
    const run = task?.run ?? this.store.getRun(runId);
    if (!run) throw fail("研究不存在", 404);
    const project = this.store.getProject(run.projectId);
    listener({ type: "started", project, runId });
    for (const event of run.events) listener({ type: "progress", ...event });
    if (task) {
      task.listeners.add(listener);
      return () => task.listeners.delete(listener);
    }
    listener(run.status === "completed" ? { type: "result", run } :
      { type: "error", runId, message: run.error || "研究已中断，可从已保存阶段继续" });
    return () => {};
  }

  cancel(runId, reason = "研究已停止，已完成阶段已保存，可继续研究") {
    const task = this.tasks.get(runId);
    const run = task?.run ?? this.store.getRun(runId);
    if (!run) throw fail("研究不存在", 404);
    if (task) {
      task.stopReason ??= reason;
      task.abort.abort();
    }
    return { run, stopping: Boolean(task) };
  }

  async shutdown() {
    this.closing = true;
    const tasks = [...this.tasks.values()];
    for (const task of tasks)
      this.cancel(task.run.id, "本地服务已停止，已完成阶段已保存，可继续研究");
    await Promise.all(tasks.map(task => task.done));
  }
}
