// Forecasts observed monthly sales only. This does not infer demand from GDP.
export function forecastSales(values: number[], horizon = 12) {
  if (
    values.length < 8 ||
    values.length > 120 ||
    values.some((v) => !Number.isFinite(v) || v < 0) ||
    !Number.isInteger(horizon) ||
    horizon < 1 ||
    horizon > 24
  )
    throw new Error("请提供8–120个月的连续非负销量；预测范围1–24个月");
  const naive = (v: number[], h: number) => Array(h).fill(v.at(-1)!);
  const trend = (v: number[], h: number) => {
    const tail = v.slice(-6),
      n = tail.length;
    const y = tail.map((x) => Math.log1p(x));
    const mean = y.reduce((a, b) => a + b) / n;
    const center = (n - 1) / 2;
    const slope =
      y.reduce((s, b, i) => s + (i - center) * (b - mean), 0) /
      y.reduce((s, _, i) => s + (i - center) ** 2, 0);
    let damping = 0;
    return Array.from({ length: h }, (_, i) => {
      damping += Math.pow(0.8, i + 1);
      return Math.max(
        0,
        Math.expm1(
          Math.log1p(v.at(-1)!) +
            Math.max(-0.35, Math.min(0.35, slope)) * damping,
        ),
      );
    });
  };
  const start = Math.max(5, values.length - 6);
  const methods = [
    { name: "naive" as const, fn: naive },
    { name: "damped-trend" as const, fn: trend },
  ];
  const scores = methods.map((m) => {
    const errors = values
      .slice(start)
      .map((value, i) =>
        Math.abs(value - m.fn(values.slice(0, start + i), 1)[0]),
      );
    return {
      ...m,
      mae: errors.reduce((a, b) => a + b, 0) / errors.length,
      errors,
    };
  });
  scores.sort((a, b) => a.mae - b.mae);
  const chosen = scores[0];
  const predicted = chosen.fn(values, horizon);
  const error = chosen.errors.slice().sort((a, b) => a - b)[
    Math.min(
      chosen.errors.length - 1,
      Math.ceil(0.9 * chosen.errors.length) - 1,
    )
  ];
  return {
    method: chosen.name,
    validationMonths: values.length - start,
    mae: chosen.mae,
    baselines: scores.map((s) => ({ method: s.name, mae: s.mae })),
    points: predicted.map((value, i) => ({
      month: values.length + i + 1,
      value,
      low: Math.max(0, value - error * Math.sqrt(i + 1)),
      high: value + error * Math.sqrt(i + 1),
    })),
    total: predicted.reduce((a, b) => a + b, 0),
    intervalMeaning: "按滚动回测误差扩展的情景带，不是校准后的概率区间",
  };
}
