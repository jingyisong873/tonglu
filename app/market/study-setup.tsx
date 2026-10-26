"use client";
import { useState } from "react";
import type { StudyInput, Market } from "@/lib/market/schema";
import { COUNTRIES } from "@/lib/market/data";
import { baseAssumptions } from "@/lib/market/templates";
import { actorNames, jurisdiction, isExclusive } from "@/lib/market/domain";

type Props = {
  input: StudyInput;
  onChange: (input: StudyInput) => void;
  busy: boolean;
};
function CountryPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (code: string) => void;
  label: string;
}) {
  const [custom, setCustom] = useState(
    !COUNTRIES.some((c) => c.code === value),
  );
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={custom ? "OTHER" : value}
        onChange={(e) => {
          setCustom(e.target.value === "OTHER");
          if (e.target.value !== "OTHER") onChange(e.target.value);
        }}
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
        <option value="OTHER">其他国家或地区</option>
      </select>
      {custom && (
        <input
          aria-label={`${label}三字母代码`}
          placeholder="ISO3 三字母代码，例如 KEN"
          maxLength={3}
          value={value}
          onChange={(e) =>
            onChange(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
          }
        />
      )}
    </label>
  );
}
export default function StudySetup({ input, onChange, busy }: Props) {
  const [newName, setNewName] = useState(""),
    [newCountry, setNewCountry] = useState(jurisdiction(input.origin)),
    [newScope, setNewScope] = useState<"country" | "region" | "segment">(
      "region",
    ),
    [sourceTitle, setSourceTitle] = useState(""),
    [sourceText, setSourceText] = useState(""),
    [message, setMessage] = useState("");
  const set = <K extends keyof StudyInput>(key: K, value: StudyInput[K]) =>
    onChange({ ...input, [key]: value });
  const target = (code: string, patch: Partial<Market>) =>
    set(
      "targets",
      input.targets.map((t) => (t.code === code ? { ...t, ...patch } : t)),
    );
  const supplier = input.supplier ?? { kind: "company", name: "" };
  const single = input.decisionMode === "single-deal";
  function add() {
    if (
      input.targets.length >= 4 ||
      !newName.trim() ||
      !/^[A-Z]{3}$/.test(newCountry)
    ) {
      setMessage("请填写方案名称和所属国家；每次最多比较四条路径。");
      return;
    }
    const code = `R_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    onChange({
      ...input,
      targets: [
        ...input.targets,
        {
          code,
          name: newName.trim(),
          countryCode: newCountry,
          scope: newScope,
          buyer: { kind: "segment", name: "" },
        },
      ],
      models: [
        ...input.models,
        {
          ...baseAssumptions(code, input.kind),
          dealUnits: 1,
          price: 0,
          annualUnits: 0,
          entryCost: 0,
          monthlyFixedCost: 0,
          note: "请填写本方案的实际报价或明确的假设；当前未确认需求。",
        },
      ],
    });
    setNewName("");
    setMessage("新路径已添加，请填写成本与数量。");
  }
  return (
    <fieldset className="me-setup" disabled={busy}>
      <div className="me-section-head">
        <div>
          <h2>定义这次决策</h2>
          <p>供给方、购买者和地域分别填写；每条路径有独立的商业假设</p>
        </div>
        <a href="/about" className="me-link">
          了解通路 ↗
        </a>
      </div>
      <div className="me-form-grid">
        <label>
          项目名称
          <input
            value={input.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>
        <label>
          决策类型
          <select
            value={input.decisionMode ?? "market-entry"}
            onChange={(e) => {
              const mode = e.target.value as StudyInput["decisionMode"];
              onChange({
                ...input,
                decisionMode: mode,
                portfolioMode:
                  mode === "single-deal" ? "exclusive" : input.portfolioMode,
                models: input.models.map((m) => ({
                  ...m,
                  dealUnits: m.dealUnits ?? 1,
                })),
              });
            }}
          >
            <option value="market-entry">持续经营 · 市场进入</option>
            <option value="single-deal">一次性交易 · 项目或订单</option>
          </select>
        </label>
        <label>
          业务类型
          <select
            value={input.kind}
            onChange={(e) => set("kind", e.target.value as StudyInput["kind"])}
          >
            <option value="goods">实体产品</option>
            <option value="service">项目服务</option>
            <option value="subscription">订阅服务</option>
            <option value="usage">按使用量计费</option>
          </select>
        </label>
        <label>
          计价单位
          <input
            value={input.unit}
            onChange={(e) => set("unit", e.target.value)}
          />
        </label>
        <label>
          供给方类型
          <select
            value={supplier.kind}
            onChange={(e) =>
              set("supplier", {
                ...supplier,
                kind: e.target.value as typeof supplier.kind,
              })
            }
          >
            {Object.entries(actorNames)
              .filter(([k]) => k !== "segment")
              .map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
          </select>
        </label>
        <label>
          供给方名称
          <input
            placeholder="企业、团队或个人，可用代称"
            value={supplier.name}
            onChange={(e) =>
              set("supplier", { ...supplier, name: e.target.value })
            }
          />
        </label>
        <CountryPicker
          label="供给方所在国家"
          value={jurisdiction(input.origin)}
          onChange={(code) =>
            set("origin", {
              ...input.origin,
              countryCode: code,
              name:
                !input.origin.scope || input.origin.scope === "country"
                  ? (COUNTRIES.find((c) => c.code === code)?.name ??
                    input.origin.name)
                  : input.origin.name,
            })
          }
        />
        <label>
          供给方所在地区
          <input
            placeholder="例如：江西、杭州、中国"
            value={input.origin.name}
            onChange={(e) =>
              set("origin", {
                ...input.origin,
                name: e.target.value,
                scope: "region",
              })
            }
          />
        </label>
        <label>
          统一计算币种
          <select
            value={input.currency ?? "USD"}
            onChange={(e) =>
              set("currency", e.target.value as StudyInput["currency"])
            }
          >
            <option value="USD">美元 USD</option>
            <option value="CNY">人民币 CNY</option>
            <option value="EUR">欧元 EUR</option>
            <option value="GBP">英镑 GBP</option>
            <option value="SGD">新加坡元 SGD</option>
          </select>
        </label>
        <label>
          比较期限（月）
          <input
            type="number"
            min="1"
            max="36"
            value={input.horizonMonths}
            onChange={(e) =>
              set(
                "horizonMonths",
                Math.max(1, Math.min(36, Math.round(Number(e.target.value)))),
              )
            }
          />
        </label>
        <label>
          一次性准备／进入投入上限
          <input
            type="number"
            min="0"
            value={input.budgetUSD}
            onChange={(e) =>
              set("budgetUSD", Math.max(0, Number(e.target.value)))
            }
          />
        </label>
        <label>
          方案之间的关系
          <select
            value={isExclusive(input) ? "exclusive" : "independent"}
            onChange={(e) =>
              set(
                "portfolioMode",
                e.target.value as StudyInput["portfolioMode"],
              )
            }
          >
            <option value="exclusive">互斥备选 · 最多选一条</option>
            <option value="independent">相互独立 · 允许组合</option>
          </select>
        </label>
        <label className="wide">
          产品或服务的具体内容
          <textarea
            rows={3}
            value={input.offering}
            onChange={(e) => set("offering", e.target.value)}
          />
        </label>
        <label className="wide">
          共同的客户需求
          <textarea
            rows={2}
            value={input.customer}
            onChange={(e) => set("customer", e.target.value)}
          />
        </label>
        <label className="wide">
          怎样才值得推进
          <textarea
            rows={2}
            placeholder="例如：预算范围、最低贡献、交付期限、需要先确认的客户信号"
            value={input.successCriterion ?? ""}
            onChange={(e) => set("successCriterion", e.target.value)}
          />
        </label>
      </div>
      <p className="me-note me-setup-note">
        {single
          ? "本次数量在交付月计入一次，不使用年销量、增长与爬坡。"
          : "持续经营按年基准销量、等待期、爬坡与增长假设推演。"}{" "}
        更改币种不会自动兑换已有数字，请统一填写同币种金额。方案仅在确认相互独立时才应组合。
      </p>
      <div className="me-section-head">
        <div>
          <h2>交易路径</h2>
          <p>同一地区的不同客户、直销和渠道，也可以分别比较</p>
        </div>
        <span className="me-badge">{input.targets.length} / 4 条</span>
      </div>
      <div className="me-route-editors">
        {input.targets.map((t, i) => {
          const buyer = t.buyer ?? { kind: "segment", name: "" };
          return (
            <section className="me-route-editor" key={t.code}>
              <div className="me-section-head">
                <h3>
                  {String(i + 1).padStart(2, "0")} · {t.name}
                </h3>
                <button
                  type="button"
                  className="me-link"
                  disabled={input.targets.length === 1}
                  onClick={() =>
                    onChange({
                      ...input,
                      targets: input.targets.filter((x) => x.code !== t.code),
                      models: input.models.filter(
                        (x) => x.marketCode !== t.code,
                      ),
                    })
                  }
                >
                  移除路径
                </button>
              </div>
              <div className="me-form-grid">
                <label>
                  方案名称
                  <input
                    value={t.name}
                    onChange={(e) => target(t.code, { name: e.target.value })}
                  />
                </label>
                <CountryPicker
                  label="目标所在国家"
                  value={jurisdiction(t)}
                  onChange={(countryCode) =>
                    target(t.code, {
                      countryCode,
                      name:
                        !t.scope || t.scope === "country"
                          ? (COUNTRIES.find((c) => c.code === countryCode)
                              ?.name ?? t.name)
                          : t.name,
                    })
                  }
                />
                <label>
                  市场范围
                  <select
                    value={t.scope ?? "country"}
                    onChange={(e) =>
                      target(t.code, {
                        scope: e.target.value as Market["scope"],
                      })
                    }
                  >
                    <option value="country">全国市场</option>
                    <option value="region">省份／城市／地区</option>
                    <option value="segment">指定客户或细分市场</option>
                  </select>
                </label>
                <label>
                  购买者类型
                  <select
                    value={buyer.kind}
                    onChange={(e) =>
                      target(t.code, {
                        buyer: {
                          ...buyer,
                          kind: e.target.value as typeof buyer.kind,
                        },
                      })
                    }
                  >
                    {Object.entries(actorNames).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wide">
                  购买者名称或群体
                  <input
                    value={buyer.name}
                    placeholder="未指定时采用上面的共同客户需求，可用代称"
                    onChange={(e) =>
                      target(t.code, {
                        buyer: { ...buyer, name: e.target.value },
                      })
                    }
                  />
                </label>
                <label className="wide">
                  接触与销售路径
                  <textarea
                    rows={2}
                    placeholder="如何触达购买者，直接销售还是借助渠道"
                    value={t.channel ?? ""}
                    onChange={(e) =>
                      target(t.code, { channel: e.target.value })
                    }
                  />
                </label>
                <label>
                  交付与验收
                  <textarea
                    rows={2}
                    placeholder="交付什么、谁负责、何时完成、怎样验收"
                    value={t.delivery ?? ""}
                    onChange={(e) =>
                      target(t.code, { delivery: e.target.value })
                    }
                  />
                </label>
                <label>
                  结算与责任
                  <textarea
                    rows={2}
                    placeholder="报价、账期、付款方式、退款或修改范围"
                    value={t.settlement ?? ""}
                    onChange={(e) =>
                      target(t.code, { settlement: e.target.value })
                    }
                  />
                </label>
              </div>
            </section>
          );
        })}
      </div>
      {input.targets.length < 4 && (
        <div className="me-add-route">
          <h3>添加一条比较路径</h3>
          <div className="me-form-grid">
            <label>
              方案名称
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例如：浙江 · 经销商渠道"
              />
            </label>
            <CountryPicker
              label="所属国家"
              value={newCountry}
              onChange={setNewCountry}
            />
            <label>
              范围
              <select
                value={newScope}
                onChange={(e) => setNewScope(e.target.value as typeof newScope)}
              >
                <option value="country">全国市场</option>
                <option value="region">省份／城市／地区</option>
                <option value="segment">指定客户或细分市场</option>
              </select>
            </label>
            <button type="button" className="me-btn" onClick={add}>
              添加路径
            </button>
          </div>
        </div>
      )}
      <div className="me-form-grid">
        <label className="wide">
          现有经验、资源与约束
          <textarea
            rows={2}
            value={input.context}
            onChange={(e) => set("context", e.target.value)}
          />
        </label>
        <label>
          HS 六位编码（货物可选）
          <input
            value={input.hsCode}
            placeholder="仅作跨境货物检索线索"
            maxLength={6}
            onChange={(e) => set("hsCode", e.target.value.replace(/\D/g, ""))}
          />
        </label>
        <label className="me-checkbox">
          <input
            type="checkbox"
            checked={input.useWeb}
            onChange={(e) => set("useWeb", e.target.checked)}
          />{" "}
          联网研究市场与交易条件
        </label>
      </div>
      <details className="me-attach">
        <summary>
          补充产品资料、需求记录或报价 · {input.sources.length} 份
        </summary>
        <p>标明日期、对象、出处与原始口径。资料中的主张仍需核实。</p>
        <input
          aria-label="资料名称"
          value={sourceTitle}
          onChange={(e) => setSourceTitle(e.target.value)}
          placeholder="资料名称与日期"
        />
        <textarea
          aria-label="资料正文"
          rows={4}
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder="产品资料、客户需求、渠道报价……"
        />
        <button
          type="button"
          className="me-btn"
          onClick={() => {
            if (sourceText.trim().length < 10 || input.sources.length >= 10) {
              setMessage("正文至少 10 字；每个项目最多 10 份资料。");
              return;
            }
            set("sources", [
              ...input.sources,
              {
                id: crypto.randomUUID(),
                title: sourceTitle || "补充资料",
                text: sourceText.slice(0, 30000),
                url: "",
                marketCode: "ALL",
                kind: "document",
                retrievedAt: new Date().toISOString(),
              },
            ]);
            setSourceText("");
            setSourceTitle("");
          }}
        >
          添加资料
        </button>
        {input.sources.map((s) => (
          <div className="me-attached" key={s.id}>
            <span>{s.title}</span>
            <button
              type="button"
              onClick={() =>
                set(
                  "sources",
                  input.sources.filter((x) => x.id !== s.id),
                )
              }
            >
              移除
            </button>
          </div>
        ))}
      </details>
      {message && (
        <p className="me-note" role="status">
          {message}
        </p>
      )}
    </fieldset>
  );
}
