import type { StudyInput, RunState, ActionRecord } from "./schema.ts";
import { routeContext, isExclusive } from "./domain.ts";
import { evaluateStudy, selectPortfolio } from "./economics.ts";
export function decisionMarkdown(
  input: StudyInput,
  run: RunState | null,
  actions: ActionRecord[],
) {
  const currency = input.currency ?? "USD",
    single = input.decisionMode === "single-deal",
    context = routeContext(input);
  const r = evaluateStudy(input),
    p = selectPortfolio(input, r);
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  const stale =
    run &&
    (JSON.stringify(run.input) !== JSON.stringify(input) ||
      JSON.stringify(run.actionsSnapshot ?? []) !== JSON.stringify(actions));
  return `# ${input.name}\n\n${input.origin.name} → ${input.targets.map((t) => t.name).join(" / ")}\n\n生成时间：${new Date().toISOString()}\n\n## 产品与客户\n\n供给方：${context.supplier.name}；模式：${single ? "一次性交易" : "持续经营"}；方案关系：${isExclusive(input) ? "互斥，最多选一条" : "独立，可组合"}\n\n成功条件：${input.successCriterion || "待明确"}\n\n${input.offering}\n\n目标客户：${input.customer}\n\n计价单位：${input.unit}；币种：${currency}；期限：${input.horizonMonths} 个月\n\n## 交易路径\n\n${context.routes.map((t) => `- ${t.market}：购买者 ${t.buyer.name}；所属国家 ${t.countryCode}；${t.crossBorder ? "跨境" : "国内"}；渠道 ${t.channel}；交付 ${t.delivery}；结算 ${t.settlement}`).join("\n")}\n\n## 当前假设下的计算\n\n| 市场 | 单位贡献 ${currency} | 期限内经营贡献 ${currency} | 保守组合 ${currency} | 较有利组合 ${currency} | 回本月 |\n|---|---:|---:|---:|---:|---:|\n${r.map((m) => `| ${input.targets.find((t) => t.code === m.marketCode)?.name} | ${money(m.unitContribution)} | ${money(m.contribution)} | ${money(m.scenario.low)} | ${money(m.scenario.high)} | ${m.paybackMonth ?? "期限内未回本"} |`).join("\n")}\n\n预算内基础情景${isExclusive(input) ? "单一选择" : "组合"}：${p.markets.map((code) => input.targets.find((t) => t.code === code)?.name ?? code).join(" / ") || "暂不投入"}。仅约束一次性进入投入，未建模共享成本与市场间相互影响。准入、实际需求与资金流动性需另行确认。\n\n## 研究判断${stale ? "（对应旧输入，需重跑）" : ""}\n\n${run?.synthesis?.summary ?? "尚未完成研究"}\n\n${run?.synthesis?.markets.map((m) => `### ${input.targets.find((t) => t.code === m.marketCode)?.name ?? m.marketCode}\n\n${m.reason}\n\n客户：${m.customerFit}\n\n渠道：${m.routeToMarket}\n\n关键条件：${m.criticalCondition}\n\n${m.actions.map((a) => `- ${a.title}：${a.deliverable}；观察信号：${a.successSignal}`).join("\n")}`).join("\n\n") ?? ""}\n\n## 原始依据\n\n${
    run?.facts
      ?.map((f) => {
        const s = run.sources?.find((s) => s.id === f.sourceId);
        return `- [${f.id}] ${f.statement} ${f.qualification}\n  来源：${s?.title ?? f.sourceId} ${s?.url ?? ""}；检索时间：${s?.retrievedAt ?? ""}`;
      })
      .join("\n") ?? "无"
  }\n\n## 行动反馈\n\n${actions.map((a) => `- ${a.marketCode} / ${a.title} / ${a.status}：${a.outcome || "暂无反馈"}`).join("\n")}\n\n## 计算口径\n\n经营贡献 = 累计销量 × 单位贡献 − 一次性进入投入 − 全期固定支出；${single ? "本次数量仅在等待期后的第一个月交付一次；不计算年增长与爬坡。贡献回正不等于现金到账，尚未建模实际付款时点。" : "销量包含进入延迟、线性爬坡及用户填写的年增长率。"}进口费用以用户提供的计费基数和费率计算，不自动认定法定税率。27 组情景是${single ? "交付延迟、售价折算与成本" : "销量、售价折算与成本"}的组合，不是概率。未包含企业所得税、融资、营运资金和供应能力约束。宏观时间序列来自 World Bank，只代表所属国家背景，不代表省市、公司、个人观测，也不直接转换成行业需求。\n\n## 商业假设\n\n${input.models.map((m) => `- ${m.marketCode}：${m.note}；准入状态 ${m.access}：${m.accessNote}`).join("\n")}\n`;
}
