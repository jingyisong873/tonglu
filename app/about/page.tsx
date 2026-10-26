import { ArrowRight, ArrowUpRight } from "lucide-react";
import { PRODUCT } from "@/lib/market/domain";
import "./about.css";

const objects = [
  ["供给方", "谁拥有产品、技术、产能或服务能力"],
  ["购买者", "谁使用、谁决策、谁承担费用"],
  ["交易对象", "卖什么，以什么单位和质量标准交付"],
  ["市场环境", "在哪个地区与细分市场，受什么制度约束"],
  ["交易路径", "如何触达、成交、交付、验收与结算"],
  ["经营条件", "价格、成本、数量、时间、预算与能力"],
  ["决策标准", "什么值得做，什么需要先验证，何时停止"],
];
const scenes = [
  [
    "国家 → 国家",
    "一个具体产品的跨境路径",
    "产品需求、渠道、原产地、交付与市场准入",
  ],
  [
    "省份 → 省份",
    "国内区域市场与渠道比较",
    "当地客户、运输、服务半径、采购与交付条件",
  ],
  ["企业 → 国家", "供给企业进入目标市场", "目标买家、竞品、分销、当地经营条件"],
  ["企业 → 企业", "项目或采购交易", "需求匹配、报价、采购流程、验收与账期"],
  [
    "个人 → 个人",
    "独立服务或一次性交易",
    "具体工作范围、数量、交付、修改与付款",
  ],
  [
    "市场 → 市场",
    "地区或细分客群之间的拓展",
    "客户差异、渠道适配、成本变化与替代方案",
  ],
];
export default function About() {
  return (
    <main className="tl-about">
      <nav>
        <a className="tl-logo" href="/">
          通路 <span>市场与交易推演</span>
        </a>
        <a className="tl-nav-action" href="/">
          进入工作台 <ArrowUpRight size={16} />
        </a>
      </nav>
      <header className="tl-hero">
        <div className="tl-kicker">T O N G L U · 产品说明</div>
        <h1>
          从供给到需求，
          <br />
          把交易路径推演清楚。
        </h1>
        <p className="tl-lead">{PRODUCT.summary}</p>
        <a className="tl-button" href="/">
          研究一条交易路径 <ArrowRight size={18} />
        </a>
        <div className="tl-hero-note">{PRODUCT.slogan}</div>
      </header>
      <section className="tl-statement">
        <span>一个明确的问题</span>
        <h2>
          这项产品或服务，
          <br />
          应该卖给谁、进入哪里、怎样成交？
        </h2>
        <p>
          每次研究都围绕一项具体决策展开：比较哪些路径，在什么条件下值得投入，最需要补什么证据，以及下一步如何验证。海外市场是重要应用；同国内的区域经营、企业采购和个人服务，也使用这套问题结构。
        </p>
      </section>
      <section>
        <div className="tl-section-head">
          <span>01 / 共同结构</span>
          <h2>地域、参与者与交易，分别建模</h2>
          <p>
            国家和省份描述环境，企业和个人描述参与者。一条路径把这些对象连接起来。
          </p>
        </div>
        <div className="tl-object-grid">
          {objects.map(([name, body], i) => (
            <article key={name}>
              <small>{String(i + 1).padStart(2, "0")}</small>
              <h3>{name}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
      <section>
        <div className="tl-section-head">
          <span>02 / 应用范围</span>
          <h2>问题结构复用，具体机制分别处理</h2>
          <p>
            同一个国家内也可以比较不同客户与渠道；同一笔订单的互斥方案不能加总为经营收益。
          </p>
        </div>
        <div className="tl-table-wrap">
          <table>
            <thead>
              <tr>
                <th>你关心的场景</th>
                <th>在通路中的表达</th>
                <th>需要研究的条件</th>
              </tr>
            </thead>
            <tbody>
              {scenes.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) => (
                    <td key={i}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tl-note">
          这里的“国家 →
          国家”指具体产品或服务的跨境经营。国家贸易总量、产业转移与政策冲击的预测，需要贸易流量及相应宏观模型，当前尚未实现。国家背景数据不会被改称省级、公司或个人数据。
        </p>
      </section>
      <section className="tl-output">
        <div className="tl-section-head">
          <span>03 / 一次研究的交付</span>
          <h2>让建议能够检查、重算和修正</h2>
        </div>
        <div className="tl-output-grid">
          <article>
            <b>可比较的路径</b>
            <p>客户、渠道、交付与结算条件，各自的关键未知是什么。</p>
          </article>
          <article>
            <b>有出处的证据</b>
            <p>原文、来源、日期与适用范围，区分公开事实和用户假设。</p>
          </article>
          <article>
            <b>可以重算的条件</b>
            <p>
              投入、单位贡献、时间、盈亏平衡和敏感性，展示什么变化会改变选择。
            </p>
          </article>
          <article>
            <b>下一步验证</b>
            <p>明确要取得的材料与观察信号，记录实际反馈，再更新判断。</p>
          </article>
        </div>
      </section>
      <section>
        <div className="tl-section-head">
          <span>04 / 智能如何参与</span>
          <h2>研究、计算与记忆各有职责</h2>
        </div>
        <div className="tl-method">
          <div>
            <h3>研究执行器</h3>
            <p>
              组织问题、检索预算、来源检查、阶段保存和失败恢复，把一次研究持续推进到可审阅的结果。
            </p>
          </div>
          <div>
            <h3>语言模型</h3>
            <p>
              理解供需与资料，生成查询、提取与审阅证据，解释计算结果，并提出可以验证的行动。
            </p>
          </div>
          <div>
            <h3>计算引擎</h3>
            <p>
              持续经营使用销量、等待与爬坡；一次性交易按本次数量和交付月计算。互斥路径最多选一条。
            </p>
          </div>
          <div>
            <h3>知识与数据库</h3>
            <p>
              保存路径、来源、摘录、假设、研究版本与行动反馈，让新资料能够进入下一次判断。
            </p>
          </div>
        </div>
        <p className="tl-note">
          当前预测以用户提供的月销量做滚动回测。情景推演回答“这些条件成立会怎样”；未经概率校准的情景组合，不显示为成功概率。
        </p>
      </section>
      <section className="tl-vision">
        <span>宗旨与愿景</span>
        <h2>
          让专业的市场与交易判断，
          <br />
          成为小团队和个人也能使用的能力。
        </h2>
        <p>
          在投入前看清条件，在行动中验证判断，让每一次结果成为下一次选择的依据。
        </p>
        <div>
          <strong>我们坚持的研究原则</strong>
          <p>
            明确决策对象 · 尊重证据的适用范围 · 按业务机制选择模型 ·
            写清改变结论的条件 · 用实际结果更新判断
          </p>
        </div>
      </section>
      <section className="tl-stage">
        <div className="tl-section-head">
          <span>05 / 当前阶段</span>
          <h2>可运行的研究与推演原型</h2>
          <p>
            已经实现跨国、区域和指定客户路径的结构化研究，持续经营与一次性交易计算、证据追溯及反馈保存。各行业的预测能力需要分别建立数据与真实案例验证。
          </p>
        </div>
        <div className="tl-method">
          <div>
            <h3>进一步建设</h3>
            <p>
              产品级贸易数据、地区与行业数据、真实客户验证、现金收付与产能约束、订阅留存模型、事件触发的更新和预测校准。
            </p>
          </div>
          <div>
            <h3>研究的完成标准</h3>
            <p>
              能解释选择，能找到依据，能重算条件，能执行验证。真实询价、签约、付款与履约仍由交易双方完成。
            </p>
          </div>
        </div>
      </section>
      <footer>
        <span>通路 · 市场与交易推演</span>
        <a href="/">
          回到工作台 <ArrowRight size={16} />
        </a>
      </footer>
    </main>
  );
}
