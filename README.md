# 通路 Tonglu

[![Verify](https://github.com/jingyisong873/tonglu/actions/workflows/ci.yml/badge.svg)](https://github.com/jingyisong873/tonglu/actions/workflows/ci.yml)

比较市场、渠道和交易方案的本地研究工作台。将来源证据、业务假设和计算结果放在同一个项目里，查看哪些条件会改变选择。

[English](README.en.md) · [运行示例](docs/demo.md) · [计算方法](docs/market-methodology.md) · [架构](docs/architecture.md) · [安全](SECURITY.md)

## 开始使用

安装 Node.js 24。在项目目录运行：

```sh
git clone https://github.com/jingyisong873/tonglu.git
cd tonglu
npm ci
npm run dev
```

打开 **http://127.0.0.1:5173**。默认使用示例回放，不需要密钥；安装完成后可以离线运行。修改价格、数量、成本和时间，计算结果随之变化。回放中的客户、摘录与解释文字是固定虚构样例，界面和导出结果均有标记。

正式构建同样用于本机单用户运行：

```sh
npm run build
npm start
# http://127.0.0.1:8787
```

项目与研究记录保存在 `.tonglu/workspace.sqlite`。备份前先停止服务，再复制整个 `.tonglu` 目录。

## 一个具体例子

桌面教学机器人进入新加坡、德国或美国：输入统一币种下的报价、成本、进入投入与等待期，比较 24 个月内的累计经营贡献和预算约束。每个市场枚举 27 组情景，共 81 组。

| 示例 | 决策 | 计算方式 |
|---|---|---|
| [机器人海外市场](examples/robot-markets.md) | 比较三个国家的销售路径 | 持续经营、等待期、爬坡、价格与成本敏感性 |
| [省际渠道](examples/regional-channels.md) | 比较国内区域渠道 | 地区与国家法域分开，按各渠道成本计算 |
| [个人服务](examples/personal-service.md) | 两份拟议服务订单择一 | 数量只计一次，互斥方案最多选择一个 |

这些例子使用演示假设。情景数量不是成功概率，计算所得经营贡献不是已实现利润。

## 研究流程

1. 定义产品、供给方、购买者、渠道、交付与结算条件。
2. 整理资料，保存原文摘录、来源、日期和适用范围。
3. 用确定性代码计算单位贡献、回本时间、情景和可选方案。
4. 由语言模型解释证据与已算出的结果，列出待验证条件。
5. 记录行动与反馈，保留输入快照和研究版本。中断后可恢复已保存阶段。

每个项目最多比较四条路径。知识检索使用结构化过滤和文本匹配；数值计算不依赖语言模型。

## 联网研究

将 `.env.example` 复制为 `.env`，填写自己的 `DEEPSEEK_API_KEY` 和账户支持的 `DEEPSEEK_MODEL`，重启服务。启用联网选项后，还会使用 DeepSeek Search / Fetch 与 World Bank 数据。接口配置与数据流见[配置说明](docs/configuration.md)。

密钥由本地服务读取。实时研究会把项目输入、所用资料和反馈发送给模型服务；只提交你有权处理的内容。浏览器断开会停止当前请求，阶段检查点仍会保存。

## 开发与验证

```sh
npm test
npm run typecheck
npm run build
npm run example
```

`npm run example` 从当前计算引擎重建 `examples/` 中的 JSON 与 Markdown。测试覆盖经济计算、来源定位、范围检查、恢复、版本冲突和 HTTP 流程。最近一次本地结果见[验证记录](docs/verification.md)。

本发行版没有多用户登录与数据隔离，不适合直接暴露到公网。当前计算未包含营运资金、真实收付款时点、融资、订阅留存或共享产能；完整假设见[计算方法](docs/market-methodology.md)。

## 许可

源代码采用 [MIT 许可](LICENSE)。第三方依赖保留各自许可，见[第三方说明](THIRD_PARTY_NOTICES.md)。模型服务和外部网页内容不包含在本项目的授权范围内。
