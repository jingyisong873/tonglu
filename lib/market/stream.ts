import type { RunState, StudyProject } from "./schema.ts";

export type ResearchEvent =
  | { type: "started"; project: StudyProject; runId: string }
  | { type: "progress"; stage: string; message: string }
  | { type: "result"; run: RunState }
  | { type: "heartbeat" };

// HTTP chunk boundaries need not align with JSON lines or UTF-8 characters.
export async function* readResearchEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;
  const parse = (line: string): ResearchEvent => {
    const event = JSON.parse(line);
    if (event?.type === "error")
      throw new Error(typeof event.message === "string" ? event.message : "研究未完成");
    if (
      !event ||
      !["started", "progress", "result", "heartbeat"].includes(event.type) ||
      (event.type === "started" && typeof event.project?.id !== "string") ||
      (event.type === "progress" &&
        (typeof event.stage !== "string" || typeof event.message !== "string")) ||
      (event.type === "result" && event.run?.status !== "completed")
    ) throw new Error("研究响应格式无效，请重新打开项目");
    if (event.type === "result") completed = true;
    return event as ResearchEvent;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (buffer.length > 4_000_000) throw new Error("研究响应过长");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) yield parse(line);
      if (done) break;
    }
    if (buffer.trim()) yield parse(buffer);
    if (!completed)
      throw new Error("研究连接已中断，已保存的阶段可在重新打开项目后恢复");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
