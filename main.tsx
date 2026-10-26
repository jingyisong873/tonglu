import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import MarketWorkspace from "./app/market/workspace";
import About from "./app/about/page";
import "./base.css";

function App() {
  const [mode, setMode] = useState("loading");
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => setMode(s.mode))
      .catch(() => setMode("offline"));
  }, []);
  if (location.pathname === "/about") return <About />;
  return (
    <>
      <div className="local-banner" role="status">
        <strong>
          {mode === "live"
            ? "本地工作区 · 实时研究已配置"
            : mode === "fixture-replay"
              ? "示例回放 · 不调用模型"
              : mode === "loading"
                ? "正在连接本地工作区"
                : "本地服务尚未连接"}
        </strong>
        <span>
          {mode === "live"
            ? "研究会使用你配置的模型服务。请检查来源、假设与结果。"
            : "数字会按当前参数重算；证据和文字来自固定虚构样例，用于体验完整流程。"}
        </span>
      </div>
      <MarketWorkspace />
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
