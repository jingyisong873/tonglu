import type { Observation } from "./schema.ts";
export const INDICATORS = [
  { code: "SP.POP.TOTL", label: "人口", unit: "人" },
  { code: "NY.GDP.PCAP.CD", label: "人均 GDP", unit: "USD / 人" },
  { code: "IT.NET.USER.ZS", label: "互联网使用率", unit: "%" },
  { code: "NE.IMP.GNFS.CD", label: "商品与服务进口总额", unit: "USD" },
  { code: "NY.GDP.MKTP.KD.ZG", label: "实际 GDP 增长率", unit: "%" },
  { code: "FP.CPI.TOTL.ZG", label: "消费价格涨幅", unit: "%" },
];
export async function worldBank(
  codes: string[],
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<Observation[]> {
  const end = new Date().getUTCFullYear() - 1;
  const url = `https://api.worldbank.org/v2/country/${[...new Set(codes)].join(";")}/indicator/${INDICATORS.map((i) => i.code).join(";")}?source=2&date=${end - 10}:${end}&format=json&per_page=3000`;
  const timeout = AbortSignal.timeout(45000);
  const response = await fetcher(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok)
    throw new Error(`World Bank 数据请求失败（${response.status}）`);
  const raw = (await response.json()) as [
    { lastupdated?: string },
    Array<{
      countryiso3code: string;
      indicator: { id: string };
      date: string;
      value: number | null;
    }>,
  ];
  if (!Array.isArray(raw[1])) throw new Error("World Bank 暂未返回可用数据");
  const retrievedAt = new Date().toISOString();
  return raw[1].flatMap((r) => {
    const indicator = INDICATORS.find((i) => i.code === r.indicator.id);
    return indicator &&
      codes.includes(r.countryiso3code) &&
      r.value !== null &&
      Number.isFinite(r.value)
      ? [
          {
            countryCode: r.countryiso3code,
            indicator: indicator.code,
            label: indicator.label,
            year: Number(r.date),
            value: r.value,
            unit: indicator.unit,
            url: `https://data.worldbank.org/indicator/${indicator.code}?locations=${r.countryiso3code}`,
            retrievedAt,
            updatedAt: raw[0]?.lastupdated ?? "",
          },
        ]
      : [];
  });
}
export const COUNTRIES = [
  ["CHN", "中国"],
  ["USA", "美国"],
  ["DEU", "德国"],
  ["SGP", "新加坡"],
  ["GBR", "英国"],
  ["JPN", "日本"],
  ["KOR", "韩国"],
  ["FRA", "法国"],
  ["CAN", "加拿大"],
  ["AUS", "澳大利亚"],
  ["IND", "印度"],
  ["IDN", "印度尼西亚"],
  ["VNM", "越南"],
  ["THA", "泰国"],
  ["MYS", "马来西亚"],
  ["PHL", "菲律宾"],
  ["ARE", "阿联酋"],
  ["SAU", "沙特阿拉伯"],
  ["BRA", "巴西"],
  ["MEX", "墨西哥"],
  ["NLD", "荷兰"],
  ["ESP", "西班牙"],
  ["ITA", "意大利"],
  ["POL", "波兰"],
  ["ZAF", "南非"],
  ["TUR", "土耳其"],
  ["NGA", "尼日利亚"],
  ["EGY", "埃及"],
  ["CHL", "智利"],
  ["NZL", "新西兰"],
].map(([code, name]) => ({ code, name }));
