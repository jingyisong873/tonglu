import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeftRight,
  Plus,
  Play,
  Download,
  Globe2,
  Layers3,
  BookOpen,
  Activity,
  SlidersHorizontal,
  Check,
  Search,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
  ExternalLink,
  Database,
  FileText,
  Target,
  Save,
  PanelLeftClose,
} from "lucide-react";
import type {
  StudyInput,
  StudyProject,
  RunState,
  Assumptions,
  MarketFact,
  ActionRecord,
} from "@/lib/market/schema";
import { isOfficial } from "@/lib/market/source-policy";
import {
  sampleInput,
  baseAssumptions,
  routeExample,
} from "@/lib/market/templates";
import { INDICATORS } from "@/lib/market/data";
import { evaluateStudy, selectPortfolio } from "@/lib/market/economics";
import { forecastSales } from "@/lib/market/forecast";
import { decisionMarkdown } from "@/lib/market/export";
import { readResearchEvents } from "@/lib/market/stream";
import {
  PRODUCT,
  jurisdiction,
  isExclusive,
  actorNames,
} from "@/lib/market/domain";
import StudySetup from "./study-setup";
import "./workspace.css";
const num = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
const stamp = (s: string) =>
  new Date(s).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
const dimensions: Record<string, string> = {
  demand: "客户与需求",
  competition: "竞争",
  channel: "渠道",
  access: "进入条件",
  cost: "成本",
  delivery: "交付与验收",
  settlement: "结算与责任",
};
const statusLabels = {
  pilot: "先做小规模验证",
  investigate: "先补关键研究",
  defer: "暂缓进入",
};
type APIResult = {
  message?: string;
  projects: StudyProject[];
  project: StudyProject;
  run: RunState | null;
  history: { id: string; status: string; createdAt: string; stage: string }[];
  facts: MarketFact[];
};
async function api(path: string, init?: RequestInit) {
  const r = await fetch(path, init);
  const b = (await r.json()) as APIResult;
  if (!r.ok) throw new Error(b.message || "请求未完成");
  return b;
}
function download(
  name: string,
  text: string,
  type = "text/markdown;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Plot({
  lines,
  labels,
  height = 220,
}: {
  lines: { name: string; color: string; values: number[] }[];
  labels: string[];
  height?: number;
}) {
  const values = lines.flatMap((l) => l.values),
    min = Math.min(0, ...values),
    max = Math.max(1, ...values),
    range = max - min || 1,
    w = 760,
    h = height,
    pad = 58,
    bottom = 30,
    top = 22;
  const x = (i: number) =>
      pad + (i * (w - pad - 24)) / Math.max(1, labels.length - 1),
    y = (v: number) => top + ((max - v) * (h - top - bottom)) / range;
  return (
    <div className="me-chart">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={lines.map((l) => l.name).join("、") + "趋势图"}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1={pad}
              y1={y(min + range * t)}
              x2={w - 24}
              y2={y(min + range * t)}
              stroke="#dfe5df"
              strokeDasharray="3 5"
            />
            <text
              x={pad - 10}
              y={y(min + range * t) + 4}
              textAnchor="end"
              fill="#69776f"
              fontSize="11"
            >
              {num(
                (min + range * t) / (max > 100000 || min < -100000 ? 1000 : 1),
              )}
              {max > 100000 || min < -100000 ? "k" : ""}
            </text>
          </g>
        ))}
        {lines.map((l) => (
          <polyline
            key={l.name}
            points={l.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            fill="none"
            stroke={l.color}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        ))}
        {labels.map((s, i) =>
          i === 0 ||
          i === labels.length - 1 ||
          i % Math.max(1, Math.floor(labels.length / 5)) === 0 ? (
            <text
              key={i}
              x={x(i)}
              y={h - 7}
              textAnchor="middle"
              fill="#69776f"
              fontSize="11"
            >
              {s}
            </text>
          ) : null,
        )}
      </svg>
      <div className="me-legend">
        {lines.map((l) => (
          <span key={l.name}>
            <i style={{ background: l.color }} />
            {l.name}
          </span>
        ))}
      </div>
    </div>
  );
}
export default function MarketWorkspace() {
  const [projects, setProjects] = useState<StudyProject[]>([]),
    [project, setProject] = useState<StudyProject | null>(null),
    [input, setInput] = useState<StudyInput>(() => sampleInput()),
    [run, setRun] = useState<RunState | null>(null),
    [actions, setActions] = useState<ActionRecord[]>([]),
    [history, setHistory] = useState<
      { id: string; status: string; createdAt: string; stage: string }[]
    >([]);
  const [tab, setTab] = useState("decision"),
    [edit, setEdit] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [progress, setProgress] = useState<string[]>([]),
    [phase, setPhase] = useState(0),
    [country, setCountry] = useState("SGP"),
    [side, setSide] = useState(false);
  const [facts, setFacts] = useState<MarketFact[]>([]),
    [query, setQuery] = useState(""),
    [dimension, setDimension] = useState(""),
    [factCountry, setFactCountry] = useState(""),
    [macro, setMacro] = useState("NY.GDP.PCAP.CD"),
    [historyText, setHistoryText] = useState("");
  const single = input.decisionMode === "single-deal",
    currency = input.currency ?? "USD";
  const money = (n: number, compact = false) =>
    new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency,
      maximumFractionDigits: compact ? 1 : 0,
      notation: compact ? "compact" : "standard",
    }).format(n);
  const results = useMemo(() => evaluateStudy(input), [input]),
    portfolio = useMemo(
      () => selectPortfolio(input, results),
      [input, results],
    );
  const dirty =
    !!project &&
    (JSON.stringify(project.input) !== JSON.stringify(input) ||
      JSON.stringify(project.actions) !== JSON.stringify(actions));
  const stale =
    !!run &&
    (JSON.stringify(run.input) !== JSON.stringify(input) ||
      JSON.stringify(run.actionsSnapshot ?? []) !== JSON.stringify(actions));
  const current =
    input.models.find((m) => m.marketCode === country) ?? input.models[0];
  const countryName = (code: string) =>
    [...input.targets, input.origin].find((t) => t.code === code)?.name ?? code;
  const colors = ["#17654f", "#b77e31", "#5e6baf", "#9a5975"];
  const recordProject = (p: StudyProject) => {
    setProject(p);
    setProjects((a) => [p, ...a.filter((x) => x.id !== p.id)]);
  };
  async function openProject(id: string) {
    setLoading(true);
    setError("");
    try {
      const b = await api(`/api/market/projects/${id}`);
      setProject(b.project);
      setInput(b.project.input);
      setActions(b.project.actions);
      setRun(b.run);
      setHistory(b.history);
      setCountry(b.project.input.targets[0].code);
      setEdit(false);
      setProgress([]);
      setSide(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    api("/api/market/projects")
      .then((b) => {
        setProjects(b.projects);
        if (b.projects.length) return openProject(b.projects[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!project || !run) {
      setFacts([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(
      () =>
        api(
          `/api/market/projects/${project.id}/knowledge?q=${encodeURIComponent(query)}&market=${factCountry}&dimension=${dimension}&run=${run.id}`,
        )
          .then((b) => {
            if (!cancelled) setFacts(b.facts);
          })
          .catch((e) => {
            if (!cancelled) setError(e.message);
          }),
      250,
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [project?.id, run?.id, run?.status, query, factCountry, dimension]);
  useEffect(() => {
    if (!input.targets.some((t) => t.code === country))
      setCountry(input.targets[0].code);
  }, [input.targets, country]);
  useEffect(() => {
    setHistoryText(current.salesHistory.join(", "));
  }, [current.marketCode, project?.id]);
  function reset(kind: StudyInput["kind"]) {
    setProject(null);
    setInput(sampleInput(kind));
    setRun(null);
    setActions([]);
    setHistory([]);
    setTab("decision");
    setCountry("SGP");
    setEdit(true);
    setError("");
    setNotice("新建试算：示例商业数字均可修改，尚未验证市场需求");
    setSide(false);
  }
  function model(key: keyof Assumptions, value: string | number | number[]) {
    if (typeof value === "number") {
      const limits: Partial<Record<keyof Assumptions, [number, number]>> = {
        annualGrowthPct: [-90, 300],
        channelFeePct: [0, 100],
        importChargePct: [0, 300],
        launchMonths: [0, 36],
        rampMonths: [1, 24],
        volumeLow: [0, 1],
        volumeHigh: [1, 10],
        fxLow: [0.1, 1],
        fxHigh: [1, 3],
        costHigh: [1, 5],
      };
      const [low, high] = limits[key] ?? [0, 1e12];
      value = Math.max(
        low,
        Math.min(high, Number.isFinite(value) ? value : low),
      );
      if (key === "launchMonths" || key === "rampMonths")
        value = Math.round(value);
    }
    setInput((i) => ({
      ...i,
      models: i.models.map((m) =>
        m.marketCode === current.marketCode ? { ...m, [key]: value } : m,
      ),
    }));
  }
  async function persist() {
    setError("");
    const p = project
      ? await api(`/api/market/projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision: project.revision, input, actions }),
        })
      : await api("/api/market/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
    recordProject(p.project);
    return p.project as StudyProject;
  }
  async function save() {
    try {
      await persist();
      setNotice("项目与假设已保存");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function research(resume = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setProgress([]);
    setPhase(0);
    setEdit(false);
    let activeProject = project;
    try {
      const p = dirty || !project ? await persist() : project;
      activeProject = p;
      const response = await fetch(`/api/market/projects/${p.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resume ? { resume: run?.id } : {}),
      });
      if (!response.ok) {
        const body = (await response.json()) as { message: string };
        throw new Error(body.message);
      }
      if (!response.body) throw new Error("研究响应为空，请重新打开项目");
      for await (const event of readResearchEvents(response.body)) {
        if (event.type === "started") recordProject(event.project);
        if (event.type === "progress") {
          setProgress((a) => [...a, event.message]);
          setPhase(
            (
              {
                plan: 0,
                collect: 1,
                search: 1,
                collected: 1,
                "source-check": 1,
                followup: 1,
                extract: 2,
                review: 2,
                compute: 3,
                synthesize: 4,
                verify: 4,
                complete: 5,
              } as Record<string, number>
            )[event.stage] ?? 0,
          );
        }
        if (event.type === "result") setRun(event.run);
      }
      const b = await api(`/api/market/projects/${p.id}`);
      recordProject(b.project);
      setRun(b.run);
      setHistory(b.history);
      setTab("decision");
      setNotice("研究已保存。可查看原文、调整假设，或把建议加入行动记录。");
    } catch (e) {
      setError((e as Error).message);
      if (activeProject) {
        try {
          const b = await api(`/api/market/projects/${activeProject.id}`);
          recordProject(b.project);
          setRun(b.run);
          setHistory(b.history);
        } catch {}
      }
    } finally {
      setBusy(false);
    }
  }
  function example(type: "regional" | "personal") {
    const next = routeExample(type);
    setProject(null);
    setInput(next);
    setRun(null);
    setActions([]);
    setHistory([]);
    setTab("decision");
    setCountry(next.targets[0].code);
    setEdit(true);
    setError("");
    setNotice("示例用于说明方法；客户、报价、数量与结果均未验证。");
    setSide(false);
  }
  function reverse(code: string) {
    const t = input.targets.find((c) => c.code === code)!;
    const reverseCode = `RETURN_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const target = {
      code: reverseCode,
      name: input.origin.name,
      countryCode: jurisdiction(input.origin),
      scope: input.origin.scope,
      buyer: input.supplier,
    };
    setInput({
      ...input,
      name: `${t.name} → ${input.origin.name} · 反向研究`,
      origin: {
        code: t.code,
        name: t.name,
        countryCode: jurisdiction(t),
        scope: t.scope,
      },
      supplier: {
        kind: t.buyer?.kind === "individual" ? "individual" : "company",
        name: t.buyer?.name ?? "反向供给方待确认",
      },
      targets: [target],
      models: [
        {
          ...baseAssumptions(reverseCode, input.kind),
          price: 0,
          annualUnits: 0,
          dealUnits: 0,
          note: "反向路线需重新确认产品、供给能力、数量、报价和交易条件。",
        },
      ],
      sources: [],
      successCriterion: "",
      context: input.context + "\n反向路线草稿：供给能力与需求必须独立核实。",
    });
    setProject(null);
    setRun(null);
    setHistory([]);
    setActions([]);
    setCountry(reverseCode);
    setEdit(true);
    setNotice("已建立反向草稿，请先确认新的供给方实际能提供什么");
  }
  function track(
    code: string,
    a: { title: string; deliverable: string; successSignal: string },
  ) {
    if (actions.some((x) => x.marketCode === code && x.title === a.title))
      return;
    setActions([
      ...actions,
      {
        id: crypto.randomUUID(),
        marketCode: code,
        title: a.title,
        status: "todo",
        outcome: "",
        updatedAt: new Date().toISOString(),
      },
    ]);
    setNotice("已加入行动记录，保存项目后可跨设备继续");
  }
  function editAction(id: string, key: "status" | "outcome", value: string) {
    setActions((a) =>
      a.map((x) =>
        x.id === id
          ? ({
              ...x,
              [key]: value,
              updatedAt: new Date().toISOString(),
            } as ActionRecord)
          : x,
      ),
    );
  }
  const forecast = useMemo(() => {
    try {
      return forecastSales(current.salesHistory, 12);
    } catch {
      return null;
    }
  }, [current.salesHistory]);
  function applyHistory() {
    const values = historyText
      .trim()
      .split(/[\s,，;；]+/)
      .filter(Boolean)
      .map(Number);
    try {
      forecastSales(values, 12);
      model("salesHistory", values);
      setNotice("已计算滚动回测与未来 12 个月预测；保存后保留这组历史销量");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const series = (run?.observations ?? [])
    .filter(
      (o) =>
        o.countryCode ===
          jurisdiction(
            input.targets.find((t) => t.code === country) ?? input.targets[0],
          ) && o.indicator === macro,
    )
    .sort((a, b) => a.year - b.year);
  return (
    <div className="me-app">
      <aside className={`me-sidebar ${side ? "open" : ""}`}>
        <a href="/" className="me-brand">
          <span className="me-brand-icon">
            <Globe2 size={23} />
          </span>
          <span>
            通路<span className="me-brand-sub">市场与交易推演</span>
          </span>
        </a>
        <div className="me-side-caption">从供给到需求，看清交易路径</div>
        <button
          className="me-new"
          disabled={busy}
          onClick={() => reset("goods")}
        >
          <Plus size={16} /> 新建研究
        </button>
        <div className="me-side-label">
          我的研究 <span>{projects.length}</span>
        </div>
        <div className="me-projects">
          {projects.map((p) => (
            <button
              disabled={busy}
              className={project?.id === p.id ? "active" : ""}
              key={p.id}
              onClick={() => openProject(p.id)}
            >
              <Layers3 size={16} />
              <span>
                <strong>{p.input.name}</strong>
                <small>
                  {p.input.origin.name} <ArrowRight size={10} />{" "}
                  {p.input.targets.length} 条路径
                </small>
              </span>
            </button>
          ))}
          {!projects.length && <p>保存后的项目会出现在这里</p>}
        </div>
        <div className="me-side-bottom">
          <div className="me-side-label">从示例开始</div>
          <button disabled={busy} onClick={() => reset("goods")}>
            <Target size={15} /> 桌面机器人出海 <ChevronRight size={14} />
          </button>
          <button disabled={busy} onClick={() => reset("usage")}>
            <Activity size={15} /> 推理 API 服务 <ChevronRight size={14} />
          </button>
          <button disabled={busy} onClick={() => reset("subscription")}>
            <Layers3 size={15} /> 订阅软件 <ChevronRight size={14} />
          </button>
          <button disabled={busy} onClick={() => example("regional")}>
            <Target size={15} /> 跨省经营与渠道比较 <ChevronRight size={14} />
          </button>
          <button disabled={busy} onClick={() => example("personal")}>
            <Activity size={15} /> 个人服务与一次性交易{" "}
            <ChevronRight size={14} />
          </button>
          <a href="/about">
            <Globe2 size={15} /> 通路是什么 <ArrowUpRight size={14} />
          </a>
          <a href="/about">
            <BookOpen size={15} /> 通用资料研究 <ArrowUpRight size={14} />
          </a>
          <div className="me-private">
            <i /> 私人研究空间 · 服务端保存
          </div>
        </div>
      </aside>
      <main className="me-main">
        <header className="me-top">
          <div>
            <button
              className="me-mobile"
              aria-label="切换项目栏"
              onClick={() => setSide(!side)}
            >
              <PanelLeftClose size={20} />
            </button>
            <span>工作台</span>
            <ChevronRight size={13} />
            <b>市场与交易推演</b>
          </div>
          <span className="me-version">RESEARCH × SIMULATION</span>
        </header>
        <div className="me-content">
          <div className="me-title-row">
            <div>
              <div className="me-eyebrow">EVIDENCE · ECONOMICS · ACTION</div>
              <h1>{input.name}</h1>
              <p className="me-subtitle">{PRODUCT.slogan}</p>
            </div>
            <div className="me-toolbar">
              <button
                className="me-btn"
                disabled={busy || loading}
                onClick={() => setEdit(!edit)}
              >
                <SlidersHorizontal size={15} />
                {edit ? "收起设定" : "研究设定"}
              </button>
              <button
                className="me-btn"
                disabled={busy || loading}
                onClick={save}
              >
                <Save size={15} />
                {dirty ? "保存修改" : "保存项目"}
              </button>
              <button
                className="me-btn primary"
                disabled={busy || loading}
                onClick={() => research(false)}
              >
                {busy ? (
                  <LoaderCircle className="me-spin" size={16} />
                ) : (
                  <Play size={15} />
                )}{" "}
                {busy ? "研究进行中" : run ? "更新研究" : "开始研究"}
              </button>
            </div>
          </div>
          {error && (
            <div role="alert" className="me-message error">
              {error}
              <button onClick={() => setError("")} aria-label="关闭提示">
                ×
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="me-message">
              {notice}
              <button onClick={() => setNotice("")} aria-label="关闭提示">
                ×
              </button>
            </div>
          )}
          {loading && (
            <div className="me-loading">
              <LoaderCircle className="me-spin" size={18} />{" "}
              正在读取已保存的项目
            </div>
          )}
          <section className="me-route">
            <div className="me-route-origin">
              <span className="me-small-label">
                {input.supplier ? actorNames[input.supplier.kind] : "供给方"}
              </span>
              <strong>{input.supplier?.name || input.origin.name}</strong>
              <small>
                {input.origin.name} ·{" "}
                {input.kind === "goods"
                  ? "实体产品"
                  : input.kind === "usage"
                    ? "用量服务"
                    : input.kind === "service"
                      ? "项目服务"
                      : "订阅软件"}
              </small>
            </div>
            <ArrowRight className="me-route-arrow" size={28} />
            <div className="me-destinations">
              {input.targets.map((t, i) => (
                <button
                  className={country === t.code ? "selected" : ""}
                  key={t.code}
                  onClick={() => setCountry(t.code)}
                >
                  <i style={{ background: colors[i] }} />
                  <strong>{t.name}</strong>
                  <span>{t.buyer?.name || jurisdiction(t)}</span>
                </button>
              ))}
            </div>
            <div className="me-route-meta">
              <b>{input.horizonMonths} 个月</b>
              <span>准备投入上限 {money(input.budgetUSD, true)}</span>
            </div>
          </section>
          {edit && (
            <StudySetup
              key={project?.id ?? "draft"}
              input={input}
              onChange={setInput}
              busy={busy}
            />
          )}
          {busy && (
            <div className="me-running">
              <div>
                <LoaderCircle className="me-spin" size={18} />
                <strong>{progress.at(-1) || "正在建立研究版本"}</strong>
                <span>页面保持打开 · 已完成阶段会保存</span>
              </div>
              <div className="me-progress-steps">
                {[
                  "拆解问题",
                  "收集资料",
                  "核实证据",
                  "计算情景",
                  "形成行动",
                ].map((s, i) => (
                  <span key={s} className={phase >= i ? "active" : ""}>
                    {String(i + 1).padStart(2, "0")} {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {run?.status === "failed" && !busy && (
            <div className="me-message error">
              <span>上次研究尚未完成：{run.error}</span>
              <button
                className="me-btn"
                disabled={stale}
                onClick={() => research(true)}
              >
                <RefreshCw size={14} /> 从已保存阶段继续
              </button>
            </div>
          )}
          {stale && (
            <div className="me-message">
              假设或反馈已有变化：数值按当前假设计算，文字判断仍对应{" "}
              {run && stamp(run.createdAt)} 的输入。点击“更新研究”生成新判断。
            </div>
          )}
          <nav className="me-tabs" aria-label="研究视图">
            {[
              { id: "decision", label: "市场决策", icon: Globe2 },
              { id: "economics", label: "情景与预测", icon: SlidersHorizontal },
              { id: "knowledge", label: "资料与知识", icon: BookOpen },
              { id: "actions", label: "执行与反馈", icon: Target },
              { id: "system", label: "系统运行", icon: Activity },
            ].map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? "active" : ""}
                onClick={() => setTab(t.id)}
              >
                <t.icon size={16} />
                {t.label}
                {t.id === "knowledge" && !!run?.facts?.length && (
                  <small>{run.facts.length}</small>
                )}
              </button>
            ))}
          </nav>
          {tab === "decision" && (
            <>
              <div className="me-section-head">
                <div>
                  <h2>先看清选择的代价</h2>
                  <p>
                    以下是你填写的商业假设下的计算，需求与准入由研究单独验证
                  </p>
                </div>
                <button className="me-link" onClick={() => setTab("economics")}>
                  调整商业假设 <ArrowRight size={15} />
                </button>
              </div>
              <div className="me-market-grid">
                {results.map((r, i) => {
                  const a = input.models.find(
                    (m) => m.marketCode === r.marketCode,
                  )!;
                  return (
                    <article className="me-market-card" key={r.marketCode}>
                      <div className="me-card-title">
                        <span>
                          <i style={{ background: colors[i] }} />
                          {countryName(r.marketCode)}
                        </span>
                        <small>{r.marketCode}</small>
                      </div>
                      <span className="me-small-label">
                        {input.horizonMonths} 个月经营贡献 · 基础情景
                      </span>
                      <div
                        className={`me-amount ${r.contribution < 0 ? "negative" : ""}`}
                      >
                        {money(r.contribution)}
                      </div>
                      <div className="me-card-stats">
                        <div>
                          <span>单 {input.unit} 贡献</span>
                          <b>{money(r.unitContribution)}</b>
                        </div>
                        <div>
                          <span>首次累计回本</span>
                          <b>
                            {r.paybackMonth
                              ? `第 ${r.paybackMonth} 月`
                              : "期限内未回本"}
                          </b>
                        </div>
                      </div>
                      <div className="me-card-range">
                        <span>27 组情景范围</span>
                        <strong>
                          {money(r.scenario.low, true)} <ArrowRight size={12} />{" "}
                          {money(r.scenario.high, true)}
                        </strong>
                      </div>
                      <div className="me-card-foot">
                        <span
                          className={`me-access ${a.access === "blocked" ? "blocked" : ""}`}
                        >
                          {a.access === "unknown"
                            ? "准入待核实"
                            : a.access === "blocked"
                              ? "存在进入阻碍"
                              : "用户已复核准入"}
                        </span>
                        <button
                          onClick={() => {
                            setCountry(r.marketCode);
                            setTab("economics");
                          }}
                          aria-label={`调整${countryName(r.marketCode)}假设`}
                        >
                          <ArrowUpRight size={17} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="me-decision-grid">
                <section className="me-panel me-judgment">
                  <div className="me-section-head">
                    <h2>
                      <span className="me-accent-dot" /> 当前进入判断
                    </h2>
                    <span className="me-badge">
                      {run?.synthesis ? "来源 + 假设 + 推断" : "等待真实研究"}
                    </span>
                  </div>
                  {run?.synthesis ? (
                    <>
                      <p className="me-lead">{run.synthesis.summary}</p>
                      {run.synthesis.markets.map((m) => (
                        <div className="me-market-judgment" key={m.marketCode}>
                          <div>
                            <h3>{countryName(m.marketCode)}</h3>
                            <span className={`me-position ${m.position}`}>
                              {statusLabels[m.position]}
                            </span>
                          </div>
                          <p>{m.reason}</p>
                          <dl>
                            <dt>目标客户</dt>
                            <dd>{m.customerFit}</dd>
                            <dt>进入路径</dt>
                            <dd>{m.routeToMarket}</dd>
                            <dt>改变判断的条件</dt>
                            <dd>{m.criticalCondition}</dd>
                          </dl>
                          <div className="me-citations">
                            {m.factIds.map((id) => (
                              <button
                                key={id}
                                onClick={() => {
                                  setTab("knowledge");
                                  setQuery("");
                                  setFactCountry("");
                                  setDimension("");
                                  setTimeout(
                                    () =>
                                      document
                                        .getElementById(`fact-${id}`)
                                        ?.scrollIntoView({
                                          behavior: "smooth",
                                          block: "center",
                                        }),
                                    500,
                                  );
                                }}
                              >
                                {id} <ArrowUpRight size={10} />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="me-empty">
                      <Globe2 size={34} />
                      <h3>从产品与客户出发，比较可行路径</h3>
                      <p>
                        明确谁提供、谁购买、怎样交付与结算，再结合证据与商业计算，比较方案并找出最值得验证的条件。
                      </p>
                      <button
                        className="me-btn primary"
                        disabled={busy || loading}
                        onClick={() => research(false)}
                      >
                        研究这些市场 <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                </section>
                <div>
                  <section className="me-panel me-portfolio">
                    <span className="me-eyebrow">CAPITAL ALLOCATION</span>
                    <h2>投入上限内，先考虑哪里</h2>
                    <div className="me-portfolio-choice">
                      {portfolio.markets.length
                        ? portfolio.markets.map(countryName).join(" + ")
                        : "暂不进入"}
                    </div>
                    <p>
                      {isExclusive(input)
                        ? "按基础情景比较互斥方案，最多选择一条。"
                        : "按基础情景比较相互独立的路径，可在预算内组合。"}{" "}
                      实际需求与交易条件仍需验证。
                    </p>
                    <div className="me-budget-track">
                      <span
                        style={{
                          width: `${Math.min(100, (portfolio.entryCost / Math.max(input.budgetUSD, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="me-budget-label">
                      <span>进入投入 {money(portfolio.entryCost, true)}</span>
                      <span>/ {money(input.budgetUSD, true)}</span>
                    </div>
                    <dl>
                      <dt>组合基础情景贡献</dt>
                      <dd>{money(portfolio.contribution)}</dd>
                      <dt>组合保守情景贡献</dt>
                      <dd>{money(portfolio.worstCase)}</dd>
                    </dl>
                    <small>
                      只约束一次性进入投入，不代表现金需求；未计共享成本、产能或市场间相互影响。
                    </small>
                  </section>
                  <section className="me-panel me-next">
                    <h2>最值得查清的事</h2>
                    {run?.synthesis?.missingInformation.length ? (
                      run.synthesis.missingInformation
                        .slice(0, 5)
                        .map((g, i) => (
                          <div key={i}>
                            <span>
                              {String(i + 1).padStart(2, "0")} ·{" "}
                              {countryName(g.marketCode)}
                            </span>
                            <h3>{g.question}</h3>
                            <p>{g.whyItMatters}</p>
                            <small>{g.howToLearn}</small>
                          </div>
                        ))
                    ) : (
                      <p>
                        确认购买者与采购周期、取得渠道报价、核对产品进入条件。这些新信息会直接改变判断。
                      </p>
                    )}
                  </section>
                </div>
              </div>
              <section className="me-panel">
                <div className="me-section-head">
                  <div>
                    <h2>累计经营贡献</h2>
                    <p>
                      {single
                        ? "包含准备投入、每月固定支出与一次性交付"
                        : "包含一次性进入投入、每月固定支出、进入延迟与销量爬坡"}{" "}
                      · {currency}
                    </p>
                  </div>
                </div>
                <Plot
                  lines={results.map((r, i) => ({
                    name: countryName(r.marketCode),
                    color: colors[i],
                    values: r.months.map((m) => m.cumulative),
                  }))}
                  labels={results[0].months.map((m) => `${m.month} 月`)}
                />
              </section>
            </>
          )}
          {tab === "economics" && (
            <>
              <div className="me-section-head">
                <div>
                  <h2>
                    {single
                      ? "一次性交易，按本次数量与交付月计算"
                      : "持续经营，检验不同的市场条件"}
                  </h2>
                  <p>
                    改动立即重算；保存保留假设，更新研究让 Agent 重新解释结果
                  </p>
                </div>
                <button
                  className="me-link"
                  disabled={busy}
                  onClick={() => reverse(country)}
                >
                  <ArrowLeftRight size={15} /> 为 {countryName(country)}{" "}
                  建反向路线
                </button>
              </div>
              <div className="me-country-tabs">
                {input.targets.map((t) => (
                  <button
                    key={t.code}
                    className={country === t.code ? "active" : ""}
                    onClick={() => setCountry(t.code)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              <div className="me-model-grid">
                <fieldset className="me-panel" disabled={busy}>
                  <h2>
                    商业假设{" "}
                    <span className="me-muted">
                      {countryName(current.marketCode)} · {currency}
                    </span>
                  </h2>
                  <div className="me-form-grid compact">
                    {(
                      [
                        { key: "price", label: `售价 / ${input.unit}` },
                        {
                          key: "variableCost",
                          label: `供给成本 / ${input.unit}`,
                        },
                        { key: "crossBorderCost", label: "交付成本 / 单位" },
                        { key: "sellingCost", label: "销售与支持 / 单位" },
                        { key: "channelFeePct", label: "渠道抽成 %" },
                        ...(single
                          ? [
                              {
                                key: "dealUnits",
                                label: `本次交易数量（${input.unit}）`,
                              },
                            ]
                          : [
                              {
                                key: "annualUnits",
                                label: `年基准销量（${input.unit}）`,
                              },
                              {
                                key: "annualGrowthPct",
                                label: "年销量增长假设 %",
                              },
                            ]),
                        { key: "entryCost", label: "一次性进入投入" },
                        { key: "monthlyFixedCost", label: "每月固定支出" },
                        {
                          key: "launchMonths",
                          label: single ? "交付前等待月数" : "进入前等待月数",
                        },
                        ...(!single
                          ? [{ key: "rampMonths", label: "销量爬坡月数" }]
                          : []),
                        ...(input.kind === "goods"
                          ? [
                              {
                                key: "importChargeBase",
                                label: "进口费用计费基数 / 单位",
                              },
                              {
                                key: "importChargePct",
                                label: "进口相关费用率假设 %",
                              },
                            ]
                          : []),
                      ] as { key: keyof Assumptions; label: string }[]
                    ).map((f) => (
                      <label key={f.key}>
                        {f.label}
                        <input
                          type="number"
                          step="any"
                          value={Number(current[f.key] ?? 0)}
                          onChange={(e) => model(f.key, Number(e.target.value))}
                        />
                      </label>
                    ))}
                  </div>
                  <p className="me-note">
                    {single
                      ? "本次数量在等待期后的第一个月交付一次。固定支出按整个比较期限计提；贡献回正不等于现金到账。"
                      : "年基准销量指爬坡后的年化销量；订阅用付费席位月，用量服务需固定计价口径。"}{" "}
                    进口费用仅在实际适用时填写；0 不代表已确认免税。
                  </p>
                  <label className="me-field">
                    数字来自哪里
                    <textarea
                      rows={3}
                      value={current.note}
                      onChange={(e) => model("note", e.target.value)}
                    />
                  </label>
                  <label className="me-field">
                    进入条件复核
                    <select
                      value={current.access}
                      onChange={(e) => model("access", e.target.value)}
                    >
                      <option value="unknown">尚未确认</option>
                      <option value="reviewed">已由用户复核</option>
                      <option value="blocked">存在阻碍，暂不进入</option>
                    </select>
                  </label>
                  <textarea
                    aria-label="进入条件依据"
                    rows={2}
                    value={current.accessNote}
                    onChange={(e) => model("accessNote", e.target.value)}
                    placeholder="依据、日期与仍需满足的条件"
                  />
                </fieldset>
                <div>
                  {(() => {
                    const r = results.find(
                      (r) => r.marketCode === current.marketCode,
                    )!;
                    return (
                      <>
                        <section className="me-panel me-model-result">
                          <span className="me-small-label">
                            当前假设的 {input.horizonMonths} 个月结果
                          </span>
                          <strong className="me-big-number">
                            {money(r.contribution)}
                          </strong>
                          <dl>
                            <dt>累计销量</dt>
                            <dd>
                              {num(r.units)} {input.unit}
                            </dd>
                            <dt>累计收入</dt>
                            <dd>{money(r.revenue)}</dd>
                            <dt>单位贡献</dt>
                            <dd>{money(r.unitContribution)}</dd>
                            <dt>全期盈亏平衡累计销量</dt>
                            <dd>
                              {r.breakEvenUnits === null
                                ? "单位贡献非正，无法回本"
                                : num(r.breakEvenUnits)}
                            </dd>
                            <dt>
                              {single
                                ? "本次交付数量门槛"
                                : "对应年基准销量门槛"}
                            </dt>
                            <dd>
                              {r.breakEvenAnnualUnits === null
                                ? "当前条件下无法达到"
                                : num(r.breakEvenAnnualUnits)}
                            </dd>
                          </dl>
                        </section>
                        <section className="me-panel">
                          <h2>哪个变量最能改变结果</h2>
                          <p className="me-note">
                            每次只改变一个变量，其余保持基础假设
                          </p>
                          <div className="me-sensitivity">
                            {r.sensitivity.map((s) => (
                              <div key={s.name}>
                                <div>
                                  <strong>{s.name}</strong>
                                  <span>
                                    {money(s.low, true)} — {money(s.high, true)}
                                  </span>
                                </div>
                                <div className="me-sensitivity-track">
                                  <i
                                    style={{
                                      width: `${Math.max(1, (100 * s.spread) / Math.max(1, ...r.sensitivity.map((x) => x.spread)))}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="me-scenario-total">
                            <b>
                              {r.scenario.profitable} / {r.scenario.total}
                            </b>
                            <span>
                              离散情景组合的经营贡献非负
                              <br />
                              这是组合计数，不是成功概率
                            </span>
                          </div>
                        </section>
                      </>
                    );
                  })()}
                  <fieldset className="me-panel" disabled={busy}>
                    <h2>压力情景范围</h2>
                    <div className="me-form-grid compact">
                      {(
                        [
                          ...(!single
                            ? [
                                { key: "volumeLow", label: "销量下界 ×" },
                                { key: "volumeHigh", label: "销量上界 ×" },
                              ]
                            : []),
                          { key: "fxLow", label: "售价折算下界 ×" },
                          { key: "fxHigh", label: "售价折算上界 ×" },
                          { key: "costHigh", label: "供给与交付成本上界 ×" },
                        ] as { key: keyof Assumptions; label: string }[]
                      ).map((f) => (
                        <label key={f.key}>
                          {f.label}
                          <input
                            type="number"
                            step="0.05"
                            value={Number(current[f.key] ?? 0)}
                            onChange={(e) =>
                              model(f.key, Number(e.target.value))
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <p className="me-note">
                      {single
                        ? "交付按约、延迟 1 月、延迟 3 月 × 3 档售价 × 3 档成本，共 27 组；本次数量保持固定。超出比较期的交付不计入期内收入。"
                        : "3 档销量 × 3 档售价折算 × 3 档成本，共 27 组。"}{" "}
                      这些情景未作现实概率校准。
                    </p>
                  </fieldset>
                </div>
              </div>
              {!single && (
                <section className="me-panel">
                  <div className="me-section-head">
                    <div>
                      <h2>有历史销量，再做预测</h2>
                      <p>
                        输入 {countryName(current.marketCode)} 连续 8–120
                        个月的销量，按从早到晚排列，以逗号分隔
                      </p>
                    </div>
                    <span className="me-badge">滚动回测 · 未来 12 个月</span>
                  </div>
                  <div className="me-history-entry">
                    <textarea
                      aria-label="历史月销量"
                      rows={2}
                      value={historyText}
                      onChange={(e) => setHistoryText(e.target.value)}
                      placeholder="例如：10, 12, 11, 15, 17, 16, 19, 21（示意格式，请填真实记录）"
                    />
                    <button
                      className="me-btn"
                      disabled={busy}
                      onClick={applyHistory}
                    >
                      计算预测 <ArrowRight size={15} />
                    </button>
                  </div>
                  {forecast && (
                    <>
                      <div className="me-forecast-stats">
                        <span>
                          选用模型{" "}
                          <b>
                            {forecast.method === "naive"
                              ? "最近一期延续"
                              : "对数阻尼趋势"}
                          </b>
                        </span>
                        <span>
                          回测 {forecast.validationMonths} 个月{" "}
                          <b>MAE {num(forecast.mae)}</b>
                        </span>
                        <span>
                          未来 12 个月合计 <b>{num(forecast.total)}</b>
                        </span>
                      </div>
                      <Plot
                        lines={[
                          {
                            name: "预测销量",
                            color: colors[0],
                            values: forecast.points.map((p) => p.value),
                          },
                          {
                            name: "误差情景下界",
                            color: "#b4c6bb",
                            values: forecast.points.map((p) => p.low),
                          },
                          {
                            name: "误差情景上界",
                            color: "#b77e31",
                            values: forecast.points.map((p) => p.high),
                          },
                        ]}
                        labels={forecast.points.map((_, i) => `+${i + 1} 月`)}
                      />
                      <p className="me-note">
                        以滚动一步预测的 MAE 比较“最近一期延续”和“阻尼趋势”；
                        {forecast.intervalMeaning}
                        。未建模季节性、结构突变和外生因素。它不会自动改写商业假设。
                      </p>
                      <button
                        className="me-btn"
                        disabled={busy}
                        onClick={() => {
                          setInput((i) => ({
                            ...i,
                            models: i.models.map((m) =>
                              m.marketCode === current.marketCode
                                ? {
                                    ...m,
                                    annualUnits: forecast.total,
                                    annualGrowthPct: 0,
                                    launchMonths: 0,
                                    rampMonths: 1,
                                    note:
                                      m.note +
                                      "\n基准销量采用所填历史的未来12月预测总量，按月均分，未保留预测曲线。",
                                  }
                                : m,
                            ),
                          }));
                          setNotice(
                            "已采用预测年总量，等待和爬坡设为 0 / 1 月、年增长设为 0；可继续调整",
                          );
                        }}
                      >
                        用预测年总量建立新的均匀销量假设
                      </button>
                    </>
                  )}
                </section>
              )}
              <details className="me-panel me-method">
                <summary>查看计算方法与适用边界</summary>
                <p>
                  单位贡献 = 售价 × (1 − 渠道抽成) − 供给成本 − 交付成本 −
                  销售支持 − 进口相关费用。经营贡献 = 累计销量 × 单位贡献 −
                  一次性进入投入 −
                  全期固定支出。固定支出从第一个月计提，等待期也计入。
                </p>
                <p>
                  {single
                    ? "本次交付量只在等待期后的下一月计入一次，其余月份不重复产生销售。计算为交付贡献，不包含账期、坏账或真实现金收付。"
                    : "每月销量 = 年基准销量 ÷ 12 × 线性爬坡系数 × 用户设定的增长系数。首个销售月是等待期后的下一月。"}
                  首次累计非负月份显示为回本月，不保证此后始终非负。企业所得税、融资、营运资金与产能约束尚未建模。使用量和订阅模型采用相同贡献公式，不等同于独立的留存或客户终身价值模型。
                </p>
              </details>
            </>
          )}
          {tab === "knowledge" && (
            <>
              <div className="me-section-head">
                <div>
                  <h2>让每个判断有来处</h2>
                  <p>研究知识按方案与主题检索，保留原文、日期和适用条件</p>
                </div>
                <span className="me-badge">
                  <Database size={13} /> {run?.sources?.length ?? 0} 份来源 ·{" "}
                  {run?.observations?.length ?? 0} 条观测
                </span>
              </div>
              <section className="me-panel">
                <div className="me-section-head">
                  <div>
                    <h2>市场背景时间序列</h2>
                    <p>
                      World Bank ·
                      所属国家背景；不代表省市、公司或个人数据，也不等于产品需求
                    </p>
                  </div>
                  <div className="me-inline-select">
                    <select
                      aria-label="宏观国家"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    >
                      {input.targets.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="宏观指标"
                      value={macro}
                      onChange={(e) => setMacro(e.target.value)}
                    >
                      {INDICATORS.map((i) => (
                        <option key={i.code} value={i.code}>
                          {i.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {series.length ? (
                  <>
                    <Plot
                      lines={[
                        {
                          name: `${series[0].label} · ${series[0].unit}`,
                          color: colors[0],
                          values: series.map((o) => o.value),
                        },
                      ]}
                      labels={series.map((o) => String(o.year))}
                    />
                    <p className="me-note">
                      最近观测 {series.at(-1)?.year}：
                      {num(series.at(-1)!.value)} {series[0].unit} · 数据源更新{" "}
                      {series[0].updatedAt || "未标明"} · 读取{" "}
                      {stamp(series[0].retrievedAt)}{" "}
                      <a href={series[0].url} target="_blank" rel="noreferrer">
                        查看数据源 <ExternalLink size={11} />
                      </a>
                    </p>
                  </>
                ) : (
                  <div className="me-empty compact">
                    <p>
                      {run
                        ? "该国家或指标暂无可用观测，不填补缺失值。"
                        : "完成研究后显示官方观测数据。"}
                    </p>
                  </div>
                )}
              </section>
              <div className="me-knowledge-filters">
                <label>
                  <Search size={15} />
                  <input
                    placeholder="检索事实、原文或适用条件"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <select
                  aria-label="事实国家"
                  value={factCountry}
                  onChange={(e) => setFactCountry(e.target.value)}
                >
                  <option value="">全部路径</option>
                  {input.targets.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                  <option value="ALL">跨市场资料</option>
                </select>
                <select
                  aria-label="事实主题"
                  value={dimension}
                  onChange={(e) => setDimension(e.target.value)}
                >
                  <option value="">全部主题</option>
                  {Object.entries(dimensions).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="me-facts">
                {facts.map((f) => {
                  const s = run?.sources?.find((s) => s.id === f.sourceId);
                  return (
                    <article className="me-fact" key={f.id} id={`fact-${f.id}`}>
                      <div className="me-fact-meta">
                        <b>{f.id}</b>
                        <span>
                          {countryName(f.marketCode)} ·{" "}
                          {dimensions[f.dimension]}
                        </span>
                        <small>
                          {s?.kind === "search-summary"
                            ? "搜索摘要"
                            : s?.kind === "document"
                              ? "用户资料"
                              : s && isOfficial(s.url)
                                ? "官方网页"
                                : "机构 / 商业网页"}
                        </small>
                      </div>
                      <h3>{f.statement}</h3>
                      {f.qualification && <p>{f.qualification}</p>}
                      <blockquote>{f.quote}</blockquote>
                      <details>
                        <summary>
                          {s?.title ?? f.sourceId} <ChevronRight size={13} />
                        </summary>
                        <div className="me-source-meta">
                          {s?.url && /^https?:\/\//i.test(s.url) && (
                            <a href={s.url} target="_blank" rel="noreferrer">
                              打开来源 <ExternalLink size={12} />
                            </a>
                          )}
                          <span>发布：{s?.publishedAt || "来源未标明"}</span>
                          <span>
                            采集：
                            {s?.retrievedAt ? stamp(s.retrievedAt) : "未标明"}
                          </span>
                        </div>
                        <pre>{s?.text ?? "当前版本未找到对应正文"}</pre>
                      </details>
                    </article>
                  );
                })}
                {!facts.length && (
                  <div className="me-panel me-empty">
                    <BookOpen size={30} />
                    <p>
                      {run
                        ? "当前筛选没有匹配的事实。"
                        : "完成研究后，按路径查看可定位的原文依据。"}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
          {tab === "actions" && (
            <>
              <div className="me-section-head">
                <div>
                  <h2>让研究进入真实市场</h2>
                  <p>把建议变成具体交付物，记录实际观察，再交给下一轮研究</p>
                </div>
                <button className="me-btn" disabled={busy} onClick={save}>
                  <Save size={14} /> 保存反馈
                </button>
              </div>
              <div className="me-action-columns">
                <section className="me-panel">
                  <h2>研究建议</h2>
                  {run?.synthesis ? (
                    run.synthesis.markets.map((m) => (
                      <div className="me-action-group" key={m.marketCode}>
                        <h3>{countryName(m.marketCode)}</h3>
                        {m.actions.map((a, i) => (
                          <div className="me-action-suggestion" key={i}>
                            <strong>
                              {i + 1}. {a.title}
                            </strong>
                            <p>{a.deliverable}</p>
                            <small>观察信号：{a.successSignal}</small>
                            <button
                              className="me-link"
                              disabled={actions.some(
                                (x) =>
                                  x.marketCode === m.marketCode &&
                                  x.title === a.title,
                              )}
                              onClick={() => track(m.marketCode, a)}
                            >
                              {actions.some(
                                (x) =>
                                  x.marketCode === m.marketCode &&
                                  x.title === a.title,
                              ) ? (
                                <>
                                  <Check size={14} /> 已加入
                                </>
                              ) : (
                                <>
                                  <Plus size={14} /> 加入行动记录
                                </>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    ))
                  ) : (
                    <p className="me-note">
                      研究完成后，在这里选择实际要执行的验证行动。
                    </p>
                  )}
                </section>
                <section className="me-panel">
                  <h2>
                    行动与观察{" "}
                    <span className="me-muted">
                      {actions.filter((a) => a.status === "done").length} /{" "}
                      {actions.length}
                    </span>
                  </h2>
                  {actions.map((a) => (
                    <div className="me-action-record" key={a.id}>
                      <span className="me-small-label">
                        {countryName(a.marketCode)}
                      </span>
                      <h3>{a.title}</h3>
                      <select
                        disabled={busy}
                        aria-label={`${a.title}状态`}
                        value={a.status}
                        onChange={(e) =>
                          editAction(a.id, "status", e.target.value)
                        }
                      >
                        <option value="todo">待开始</option>
                        <option value="doing">进行中</option>
                        <option value="done">已完成</option>
                      </select>
                      <textarea
                        disabled={busy}
                        aria-label={`${a.title}观察结果`}
                        rows={4}
                        placeholder="记录实际接触了谁、得到什么信息、样本数、日期和材料位置。未完成的工作不要写成结果。"
                        value={a.outcome}
                        onChange={(e) =>
                          editAction(a.id, "outcome", e.target.value)
                        }
                      />
                      <small>更新 {stamp(a.updatedAt)}</small>
                    </div>
                  ))}
                  {!actions.length && (
                    <div className="me-empty compact">
                      <Target size={28} />
                      <p>
                        从左侧选择一项行动开始。实际反馈会进入下次研究的上下文。
                      </p>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
          {tab === "system" && (
            <>
              <div className="me-section-head">
                <div>
                  <h2>这次研究是怎样完成的</h2>
                  <p>执行记录对应真实阶段；数据库保留输入、过程与结果版本</p>
                </div>
                <span className="me-badge">
                  {run?.engineVersion ?? "pathway-2.1"}
                </span>
              </div>
              <div className="me-system-stats">
                <div>
                  <b>{run?.usage.calls ?? 0}</b>
                  <span>LLM 调用</span>
                </div>
                <div>
                  <b>{run?.usage.searchCalls ?? 0}</b>
                  <span>检索请求</span>
                </div>
                <div>
                  <b>
                    {num(
                      (run?.usage.inputTokens ?? 0) +
                        (run?.usage.outputTokens ?? 0),
                    )}
                  </b>
                  <span>模型 tokens</span>
                </div>
                <div>
                  <b>
                    {(run?.calculations?.markets.length ??
                      input.targets.length) * 27}
                  </b>
                  <span>确定性情景组合</span>
                </div>
              </div>
              <div className="me-system-grid">
                <section className="me-panel">
                  <h2>系统分工</h2>
                  {[
                    {
                      n: "01",
                      name: "Harness · 任务执行器",
                      body: "限定检索预算，检查来源分布，必要时补查官方材料，编排研究阶段，记录工具结果与错误，保存检查点；失败后复用已完成阶段。",
                    },
                    {
                      n: "02",
                      name: "LLM · 研究与解释",
                      body: "把产品和客户拆成查询，提取原文、审阅含义，再解释计算结果，提出进入路径与可验证行动。它不负责凭空生成销量或概率。",
                    },
                    {
                      n: "03",
                      name: "知识库 · 可追溯的事实",
                      body: "按交易路径与需求、竞争、渠道、交易条件、成本、交付、结算组织摘录，连接原文、来源时间和适用边界。当前采用结构化与关键词检索。",
                    },
                    {
                      n: "04",
                      name: "计算引擎 · 可复算的推演",
                      body: "按持续经营或一次性交易选择公式，计算贡献、盈亏平衡与情景；区分互斥路径和可组合方案。有历史销量才做滚动回测。",
                    },
                    {
                      n: "05",
                      name: "数据库 · 连续工作的记忆",
                      body: "服务端保存项目、商业假设、知识、研究版本与行动反馈；下一次研究读取最新输入和已记录的实际观察。",
                    },
                  ].map((c) => (
                    <div className="me-system-role" key={c.n}>
                      <span>{c.n}</span>
                      <div>
                        <h3>{c.name}</h3>
                        <p>{c.body}</p>
                      </div>
                    </div>
                  ))}
                </section>
                <section className="me-panel">
                  <h2>最近一次执行</h2>
                  <div className="me-trace">
                    {run?.events.map((e, i) => (
                      <div key={i}>
                        <i />
                        <div>
                          <small>
                            {stamp(e.at)} · {e.stage}
                          </small>
                          <strong>{e.message}</strong>
                          {e.detail && <p>{e.detail}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {!run && (
                    <p className="me-note">开始研究后显示真实执行轨迹。</p>
                  )}
                  {run && (
                    <p className="me-note">
                      模型：{run.usage.model}
                      <br />
                      网页读取 {run.usage.fetchCalls ?? 0} 次 · 官方来源{" "}
                      {run.sourceChecks?.officialSources ?? 0} 份 · 来源网站{" "}
                      {run.sourceChecks?.domains ?? 0} 个<br />
                      输入 {num(run.usage.inputTokens)} / 输出{" "}
                      {num(run.usage.outputTokens)} tokens
                      <br />
                      状态：{run.status}
                    </p>
                  )}
                </section>
              </div>
              {!!run?.warnings.length && (
                <details className="me-panel me-method">
                  <summary>
                    本轮数据与执行记录中的限制 · {run.warnings.length}
                  </summary>
                  {run.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </details>
              )}
              {run?.finalReview && (
                <details className="me-panel me-method">
                  <summary>
                    结论一致性复核 · {run.finalReview.issues.length} 条记录
                  </summary>
                  {run.finalReview.issues.length ? (
                    run.finalReview.issues.map((issue, i) => (
                      <p key={i}>{issue}</p>
                    ))
                  ) : (
                    <p>
                      本轮未发现需要修正的数字排序与引用范围问题；这项模型复核不等于独立验证所有现实事实。
                    </p>
                  )}
                </details>
              )}
              <section className="me-panel">
                <div className="me-section-head">
                  <h2>研究版本</h2>
                  <span className="me-muted">
                    保留最近 12 次的列表；版本内容独立保存
                  </span>
                </div>
                {history.map((h, i) => (
                  <div className="me-version-row" key={h.id}>
                    <span>V{history.length - i}</span>
                    <strong>{stamp(h.createdAt)}</strong>
                    <small>
                      {h.status} · {h.stage}
                    </small>
                    <button
                      className="me-link"
                      onClick={async () => {
                        try {
                          const b = await api(`/api/market/runs/${h.id}`);
                          download(
                            `market-run-${h.id.slice(0, 8)}.json`,
                            JSON.stringify(b.run, null, 2),
                            "application/json",
                          );
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      导出快照 <Download size={13} />
                    </button>
                  </div>
                ))}
                {!history.length && (
                  <p className="me-note">尚无已保存的研究版本。</p>
                )}
              </section>
            </>
          )}
          <footer className="me-footer">
            <span>
              通路 <i /> 从供给到需求，看清交易路径
            </span>
            <div>
              <button
                onClick={() =>
                  download(
                    "tonglu-decision-brief.md",
                    decisionMarkdown(input, run, actions),
                  )
                }
              >
                <Download size={14} /> 决策简报
              </button>
              <button
                onClick={() =>
                  download(
                    "tonglu-project.json",
                    JSON.stringify(
                      {
                        input,
                        run,
                        actions,
                        calculations: { markets: results, portfolio },
                        exportedAt: new Date().toISOString(),
                      },
                      null,
                      2,
                    ),
                    "application/json",
                  )
                }
              >
                <Download size={14} /> 项目数据
              </button>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
