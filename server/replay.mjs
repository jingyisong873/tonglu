// Deterministic test fixtures, NOT model output or observed customer demand.
export function replayConfig(state) {
  const codes = state.input.targets.map((t) => t.code);
  state.sources = codes.map((code, i) => ({
    id: `S${i + 1}`,
    marketCode: code,
    kind: "document",
    url: "",
    title: `Synthetic demonstration brief ${i + 1}`,
    retrievedAt: new Date().toISOString(),
    text: "Synthetic example only. The example buyer requests a demonstration and a clear acceptance checklist. No real customer was interviewed.",
  }));
  state.observations = [];
  state.warnings.push(
    "示例回放：文本来自固定测试样例，未调用语言模型或网络检索；商业数值均为用户输入或演示假设。",
  );
  const fetcher = async (_url, init) => {
    const request = JSON.parse(init.body);
    const input = JSON.parse(request.messages[1].content);
    let data;
    if (input.report) data = { issues: [], replacements: [] };
    else if (input.calculations)
      data = {
        summary:
          "示例回放。下方测算由程序根据当前假设计算；文字用于展示研究报告结构，未证明任何市场的真实需求。请先取得真实客户、报价和进入条件的证据，再决定是否投入。",
        markets: codes.map((code, i) => ({
          marketCode: code,
          position: "investigate",
          reason:
            "这是固定演示文字。比较当前假设下的经营贡献与保守情景，再核实需求和成本。",
          customerFit: "目标客户来自项目输入，尚未访谈验证。",
          routeToMarket: "用产品演示和需求访谈验证客户是否愿意试用。",
          criticalCondition: "需求、实际报价、交付范围与进入条件仍需核实。",
          factIds: [`F${i + 1}`],
          actions: [
            {
              title: "安排一次需求访谈",
              deliverable: "记录需求、预算、采购与验收条件",
              successSignal: "取得可复核的客户反馈；当前尚未执行",
            },
          ],
        })),
        crossMarketTradeoffs: [
          "参数改变会重新计算数字；演示文字不会被伪装成实时模型判断。",
        ],
        missingInformation: codes.map((code) => ({
          marketCode: code,
          question: "客户是否有真实预算和采购计划？",
          whyItMatters: "假设销量尚无需求证据",
          howToLearn: "访谈目标买家并保存原始记录",
        })),
      };
    else if (input.facts)
      data = {
        reviews: input.facts.map((f) => ({
          id: f.id,
          verdict: "supported",
          statement: f.statement,
          qualification: "固定虚构样例，非真实市场事实",
        })),
      };
    else if (input.sources && !input.name)
      data = {
        facts: state.sources.map((s) => ({
          marketCode: s.marketCode,
          dimension: "channel",
          statement: "虚构样例买家要求演示与明确的验收清单",
          sourceId: s.id,
          quote:
            "The example buyer requests a demonstration and a clear acceptance checklist.",
          qualification: "固定虚构样例，非真实市场事实",
        })),
      };
    else
      data = {
        question: "用固定测试样例演示研究流程，并重算当前假设",
        queries: [],
        hypotheses: [],
      };
    return new Response(
      JSON.stringify({
        model: "fixture-replay",
        usage: { prompt_tokens: 0, completion_tokens: 0 },
        choices: [
          { finish_reason: "stop", message: { content: JSON.stringify(data) } },
        ],
      }),
    );
  };
  return { key: "fixture-only-no-network", model: "fixture-replay", fetcher };
}
