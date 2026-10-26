export type Usage = {
  inputTokens: number;
  outputTokens: number;
  calls: number;
  model: string;
};
export class ProviderError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "ProviderError";
  }
}
export type ProviderConfig = {
  key: string;
  model: string;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
};
export function providerConfig(): ProviderConfig {
  const key = process.env.DEEPSEEK_API_KEY ?? "";
  if (!key) throw new ProviderError("NOT_CONFIGURED", "模型服务尚未配置", 503);
  return { key, model: process.env.DEEPSEEK_MODEL || "deepseek-flash" };
}
export async function providerRequest(
  config: ProviderConfig,
  path: string,
  body?: unknown,
) {
  const signal = config.signal
    ? AbortSignal.any([config.signal, AbortSignal.timeout(150_000)])
    : AbortSignal.timeout(150_000);
  let response: Response;
  try {
    response = await (config.fetcher ?? fetch)(
      `https://api.deepseek.com${path}`,
      {
        method: body === undefined ? "GET" : "POST",
        redirect: "error",
        headers: {
          Authorization: `Bearer ${config.key}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal,
      },
    );
  } catch {
    throw new ProviderError(
      "CONNECTION_FAILED",
      signal.aborted
        ? "本次研究已停止或模型响应超时，请缩小资料范围后重试"
        : "暂时无法连接模型服务，请稍后重试",
    );
  }
  if (!response.ok) {
    await response.body?.cancel();
    const messages: Record<number, string> = {
      401: "模型服务凭据无效",
      402: "DeepSeek 账户余额不足",
      403: "服务未允许这项请求",
      429: "模型服务繁忙，请稍后重试",
    };
    throw new ProviderError(
      `PROVIDER_${response.status}`,
      messages[response.status] || `模型服务请求失败（${response.status}）`,
      response.status === 402 ? 402 : 502,
    );
  }
  return (await response.json()) as Record<string, unknown>;
}
export async function modelJSON(
  config: ProviderConfig,
  system: string,
  input: unknown,
  thinking = false,
) {
  const start = Date.now();
  const raw = await providerRequest(config, "/chat/completions", {
    model: config.model,
    messages: [
      {
        role: "system",
        content: system + "\nReturn one valid JSON object. No Markdown fences.",
      },
      { role: "user", content: JSON.stringify(input) },
    ],
    response_format: { type: "json_object" },
    max_tokens: thinking ? 14000 : 7000,
    thinking: { type: thinking ? "enabled" : "disabled" },
    ...(thinking ? { reasoning_effort: "high" } : { temperature: 0.2 }),
    stream: false,
  });
  const choices = raw.choices as
    | { finish_reason?: string; message?: { content?: string } }[]
    | undefined;
  if (choices?.[0]?.finish_reason === "length")
    throw new ProviderError(
      "OUTPUT_LIMIT",
      "这次结果超出长度限制，请缩小问题或资料范围",
    );
  const content = choices?.[0]?.message?.content;
  if (!content)
    throw new ProviderError("EMPTY_OUTPUT", "模型未返回结果，请重试");
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new ProviderError("INVALID_OUTPUT", "模型返回格式不完整，请重试");
  }
  const usage = raw.usage as
    | { prompt_tokens?: number; completion_tokens?: number }
    | undefined;
  return {
    data,
    usage: {
      inputTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
      calls: 1,
      model: typeof raw.model === "string" ? raw.model : config.model,
    },
    elapsedMs: Date.now() - start,
  };
}
