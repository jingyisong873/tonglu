import type { Assumptions, StudyInput } from "./schema.ts";
import { COUNTRIES } from "./data.ts";
export function baseAssumptions(
  marketCode: string,
  kind: StudyInput["kind"] = "goods",
): Assumptions {
  return {
    marketCode,
    dealUnits: 1,
    price: kind === "goods" ? 599 : kind === "subscription" ? 30 : 3,
    variableCost: kind === "goods" ? 230 : kind === "subscription" ? 6 : 0.7,
    crossBorderCost: kind === "goods" ? 45 : 0.1,
    sellingCost: kind === "goods" ? 20 : kind === "subscription" ? 4 : 0.2,
    channelFeePct: 15,
    importChargePct: 0,
    importChargeBase: kind === "goods" ? 275 : 0,
    annualUnits:
      kind === "goods" ? 180 : kind === "subscription" ? 2400 : 60000,
    annualGrowthPct: 0,
    entryCost: kind === "goods" ? 8000 : 10000,
    monthlyFixedCost: kind === "goods" ? 1200 : 2000,
    launchMonths: 2,
    rampMonths: 4,
    volumeLow: 0.5,
    volumeHigh: 1.5,
    fxLow: 0.9,
    fxHigh: 1.1,
    costHigh: 1.2,
    note: "示例商业假设，用于演示计算；尚无真实销量、报价或需求验证。进口相关费用未填，0 不代表免税。",
    access: "unknown",
    accessNote: "尚未针对产品、原产地和目的国确认进入条件",
    salesHistory: [],
  };
}
export function sampleInput(kind: StudyInput["kind"] = "goods"): StudyInput {
  const origin = COUNTRIES.find((c) => c.code === "CHN")!;
  const targets = ["SGP", "DEU", "USA"].map(
    (code) => COUNTRIES.find((c) => c.code === code)!,
  );
  const goods = kind === "goods";
  return {
    name: goods
      ? "桌面机器人 · 三市场试算"
      : kind === "usage"
        ? "推理 API · 跨国市场试算"
        : "协作软件 · 跨国市场试算",
    offering: goods
      ? "面向高校教学与机器人开发者的桌面机械臂开发套件，计划提供英文开发文档、教学案例与远程技术支持。这是用于验证市场进入方法的示例产品，规格、需求与商业结果尚未验证。"
      : kind === "usage"
        ? "面向海外中小软件团队的文本推理 API 服务，计划按使用量计费并提供英文文档、用量管理与开发者支持。需要研究客户对质量、延迟、价格、数据处理与供应商来源的实际要求。这是示例商业方案。"
        : "面向海外中小团队的知识协作软件，计划按活跃付费席位月计费，提供英文界面和远程支持。这是尚待客户验证的示例商业方案。",
    kind,
    unit: goods
      ? "台"
      : kind === "usage"
        ? "百万混合 tokens（输入输出比例待定）"
        : "付费席位月",
    origin,
    targets,
    customer: goods
      ? "高校工程学院教学实验室、机器人课程负责人、小型教育设备经销商"
      : kind === "usage"
        ? "有多语言文本处理需求、缺少自建模型资源的中小软件开发团队"
        : "10–100 人、需要跨语言知识协作的中小企业",
    horizonMonths: 24,
    budgetUSD: 25000,
    hsCode: "",
    useWeb: true,
    sources: [],
    models: targets.map((t, i) => ({
      ...baseAssumptions(t.code, kind),
      entryCost: goods ? [6000, 12000, 10000][i] : [8000, 16000, 12000][i],
      launchMonths: [1, 3, 2][i],
      annualUnits: goods
        ? [160, 260, 300][i]
        : kind === "usage"
          ? [40000, 90000, 100000][i]
          : [1800, 3000, 3200][i],
    })),
    context:
      "演示项目。请明确区分公开事实、模型推断与示例假设；不要把试算销量解释为已验证需求。优先给出能在两周内开始执行的客户研究与渠道验证。",
  };
}

export function routeExample(type: "regional" | "personal"): StudyInput {
  const regional = type === "regional";
  const input = sampleInput(regional ? "goods" : "usage");
  const targets = regional
    ? [
        {
          code: "ZHEJIANG_DIRECT",
          name: "浙江 · 直接销售",
          countryCode: "CHN",
          scope: "region" as const,
          buyer: { kind: "segment" as const, name: "浙江高校实验室" },
          channel: "联系课程负责人，验证教学方案",
          delivery: "设备交付、安装指导与验收",
          settlement: "拟议分阶段付款，条款待确认",
        },
        {
          code: "ZHEJIANG_CHANNEL",
          name: "浙江 · 经销渠道",
          countryCode: "CHN",
          scope: "region" as const,
          buyer: { kind: "company" as const, name: "教育设备经销商（待确定）" },
          channel: "经销商试用与报价",
          delivery: "批次交付，明确培训和售后责任",
          settlement: "账期和信用额度待确认",
        },
      ]
    : [
        {
          code: "CLIENT_A",
          name: "杭州 · 客户 A",
          countryCode: "CHN",
          scope: "segment" as const,
          buyer: { kind: "individual" as const, name: "独立创作者 A（示例）" },
          channel: "需求访谈与项目报价",
          delivery: "一份双语内容包及两轮修改，验收范围待确认",
          settlement: "拟议预付款与验收尾款，尚未商定",
        },
        {
          code: "CLIENT_B",
          name: "上海 · 客户 B",
          countryCode: "CHN",
          scope: "segment" as const,
          buyer: { kind: "individual" as const, name: "独立创作者 B（示例）" },
          channel: "需求访谈与项目报价",
          delivery: "一份双语内容包及两轮修改，验收范围待确认",
          settlement: "拟议预付款与验收尾款，尚未商定",
        },
      ];
  return {
    ...input,
    name: regional
      ? "教学机器人 · 江西到浙江"
      : "双语内容服务 · 两位客户的项目比较",
    kind: regional ? "goods" : "service",
    unit: regional ? "台" : "项目",
    currency: "CNY",
    decisionMode: regional ? "market-entry" : "single-deal",
    portfolioMode: "exclusive",
    supplier: {
      kind: regional ? "company" : "individual",
      name: regional ? "江西设备团队（示例）" : "杭州自由职业者（示例）",
    },
    origin: {
      code: regional ? "JIANGXI" : "HANGZHOU",
      name: regional ? "江西" : "杭州",
      countryCode: "CHN",
      scope: "region",
    },
    targets,
    offering: regional
      ? "用于高校机器人课程的桌面教学机械臂，含课程资料、部署指导与售后支持。比较直接销售与经销渠道。这是虚构演示方案，尚无真实客户和成交。"
      : "为独立创作者提供一份双语内容包，包含需求梳理、内容编写与两轮修改。一次只能接一个项目，比较两位客户的拟议报价、工作量与验收条件。所有客户及数字均为演示假设。",
    customer: regional
      ? "浙江高校课程负责人及教育设备经销商"
      : "有双语内容需求的独立创作者，真实需求与预算尚未核实",
    horizonMonths: regional ? 12 : 3,
    budgetUSD: regional ? 20000 : 1000,
    successCriterion: regional
      ? "先用两次教学试用验证课程适配，并取得实际采购与服务成本信息；这是拟定验证目标。"
      : "在约定范围内完成交付；贡献覆盖准备成本且工作量可承受。先确认需求、修改次数及付款条件。",
    models: targets.map((t, i) => ({
      ...baseAssumptions(t.code, regional ? "goods" : "service"),
      price: regional ? [4999, 3999][i] : [5000, 6500][i],
      variableCost: regional ? 2300 : [2400, 3600][i],
      crossBorderCost: regional ? 150 : 0,
      sellingCost: regional ? 200 : 200,
      channelFeePct: regional ? [0, 15][i] : 0,
      importChargeBase: 0,
      importChargePct: 0,
      annualUnits: regional ? [60, 100][i] : 0,
      dealUnits: 1,
      entryCost: regional ? [8000, 12000][i] : 300,
      monthlyFixedCost: regional ? 600 : 100,
      launchMonths: regional ? 1 : 0,
      rampMonths: regional ? 3 : 1,
      note: "全部为演示假设，金额为人民币，未访谈真实客户或核实报价。",
      accessNote:
        "同国内交易；产品或服务规则、合同范围、验收与付款条件仍需核实",
    })),
    context:
      "演示案例，地域、参与者和交易条件分别建模。不能把全国宏观数据解释为省份或个人需求，也不能把互斥路径相加。",
    sources: [],
  };
}
