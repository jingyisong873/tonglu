import type { Market, StudyInput } from "./schema.ts";
export const PRODUCT = {
  name: "通路",
  descriptor: "市场与交易推演",
  slogan: "看清需求，算清代价，找到可行的交易路径。",
  summary:
    "帮助供给方比较产品或服务面向不同地区、客户与渠道的交易方案：查找证据，核算条件，推演变化，并用实际反馈更新下一步选择。",
};
export const actorNames = {
  company: "企业",
  individual: "个人",
  institution: "机构",
  segment: "客户群",
};
export function jurisdiction(m: Market) {
  return m.countryCode ?? m.code;
}
export function isCrossBorder(input: StudyInput, target: Market) {
  return jurisdiction(input.origin) !== jurisdiction(target);
}
export function isExclusive(input: StudyInput) {
  return input.portfolioMode
    ? input.portfolioMode === "exclusive"
    : input.decisionMode === "single-deal";
}
export function routeContext(input: StudyInput) {
  return {
    supplier: input.supplier ?? { kind: "company", name: "供给方待明确" },
    origin: input.origin,
    mode: input.decisionMode ?? "market-entry",
    currency: input.currency ?? "USD",
    alternatives: isExclusive(input)
      ? "互斥方案，只能选择其中一个"
      : "独立方案，可组合；尚未计共享成本和相互蚕食",
    successCriterion: input.successCriterion || "尚未填写",
    routes: input.targets.map((t) => ({
      id: t.code,
      market: t.name,
      countryCode: jurisdiction(t),
      scope: t.scope ?? "country",
      buyer: t.buyer?.name
        ? t.buyer
        : { kind: t.buyer?.kind ?? "segment", name: input.customer },
      channel: t.channel || "待研究",
      delivery: t.delivery || "待核实",
      settlement: t.settlement || "待核实",
      crossBorder: isCrossBorder(input, t),
    })),
  };
}
