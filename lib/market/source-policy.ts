import type { MarketSource, StudyInput } from "./schema.ts";
import { jurisdiction, isCrossBorder } from "./domain.ts";
const eu = new Set([
  "DEU",
  "FRA",
  "ITA",
  "ESP",
  "NLD",
  "POL",
  "BEL",
  "AUT",
  "SWE",
  "DNK",
  "FIN",
  "IRL",
  "PRT",
  "CZE",
  "GRC",
  "ROU",
  "HUN",
  "BGR",
  "HRV",
  "SVK",
  "SVN",
  "LTU",
  "LVA",
  "EST",
  "CYP",
  "MLT",
  "LUX",
]);
const domains: Record<string, string[]> = {
  USA: ["cbp.gov", "ustr.gov", "usitc.gov", "bis.gov", "ftc.gov"],
  SGP: [
    "customs.gov.sg",
    "iras.gov.sg",
    "enterprisesg.gov.sg",
    "pdpc.gov.sg",
    "imda.gov.sg",
  ],
  CHN: ["customs.gov.cn", "mofcom.gov.cn", "cac.gov.cn", "miit.gov.cn"],
  GBR: ["gov.uk", "ico.org.uk"],
  CAN: ["canada.ca", "cbsa-asfc.gc.ca"],
  AUS: ["abf.gov.au", "business.gov.au", "oaic.gov.au"],
  JPN: ["customs.go.jp", "meti.go.jp"],
  KOR: ["customs.go.kr"],
  IND: ["gov.in"],
  BRA: ["gov.br"],
  MEX: ["gob.mx"],
  ARE: ["gov.ae"],
  SAU: ["gov.sa"],
  ZAF: ["gov.za"],
};
export function officialDomains(
  code: string,
  kind: StudyInput["kind"] = "goods",
  domestic = false,
) {
  if (domestic) {
    const local: Record<string, string[]> = {
      CHN: ["samr.gov.cn", "mofcom.gov.cn"],
      USA: ["ftc.gov", "sba.gov"],
      SGP: ["enterprisesg.gov.sg", "cccs.gov.sg"],
    };
    if (local[code]) return local[code];
  }
  if (kind !== "goods") {
    const digital: Record<string, string[]> = {
      USA: ["ftc.gov", "bis.gov"],
      SGP: ["pdpc.gov.sg", "iras.gov.sg"],
      CHN: ["cac.gov.cn", "miit.gov.cn"],
    };
    if (digital[code]) return digital[code];
  }
  return eu.has(code)
    ? ["europa.eu", ...(code === "DEU" ? ["zoll.de"] : [])]
    : (domains[code] ?? []);
}
export function isOfficial(url: string) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return (
      Object.values(domains)
        .flat()
        .concat(["europa.eu", "zoll.de", "gov.sg"])
        .some((d) => h === d || h.endsWith("." + d)) ||
      /(^|\.)gov(\.[a-z]{2})?$/.test(h) ||
      /(^|\.)gouv\.[a-z]{2}$/.test(h) ||
      /(^|\.)go\.(jp|kr)$/.test(h)
    );
  } catch {
    return false;
  }
}
export function officialQuery(
  code: string,
  query: string,
  kind: StudyInput["kind"] = "goods",
  domestic = false,
) {
  const d = officialDomains(code, kind, domestic).slice(0, 2);
  if (!d.length)
    return (query + " official government requirements").slice(0, 128);
  const prefix =
    d.length > 1 ? `(site:${d[0]} OR site:${d[1]}) ` : `site:${d[0]} `;
  return (
    prefix +
    query
      .replace(/site:[^\s)]+/g, "")
      .replace(/[()]/g, "")
      .slice(0, 128 - prefix.length)
  );
}
export function regulatoryFactAllowed(source: MarketSource) {
  return (
    source.kind === "document" ||
    (source.kind === "web" && isOfficial(source.url))
  );
}
export function officialSeeds(input: StudyInput) {
  if (input.kind !== "goods") return [];
  const seeds: { marketCode: string; url: string }[] = [];
  for (const t of input.targets) {
    if (!isCrossBorder(input, t)) continue;
    const country = jurisdiction(t);
    if (country === "SGP")
      seeds.push({
        marketCode: t.code,
        url: "https://www.customs.gov.sg/doing-business/import-operations/import-procedures/import-procedures-overview/",
      });
    if (
      eu.has(country) &&
      /机器人|机械臂|robot|machinery/i.test(input.offering)
    )
      seeds.push({
        marketCode: t.code,
        url: "https://single-market-economy.ec.europa.eu/sectors/mechanical-engineering/machinery_en?prefLang=it",
      });
    if (country === "USA" && jurisdiction(input.origin) === "CHN")
      seeds.push({
        marketCode: t.code,
        url: "https://www.cbp.gov/trade/programs-administration/entry-summary/section-301-trade-remedies/faqs?language_content_entity=en",
      });
  }
  return seeds;
}
export function addDiverseSource(
  sources: MarketSource[],
  source: Omit<MarketSource, "id">,
) {
  let url = source.url;
  try {
    const u = new URL(url);
    if (!["https:", "http:"].includes(u.protocol) || u.username || u.password)
      return false;
    u.hash = "";
    for (const k of [...u.searchParams.keys()])
      if (k.startsWith("utm_")) u.searchParams.delete(k);
    url = u.href;
  } catch {
    return false;
  }
  const existing = sources.find((s) => s.url === url);
  if (existing) {
    const market =
      existing.marketCode === source.marketCode ? source.marketCode : "ALL";
    if (
      source.kind === "web" &&
      (existing.kind === "search-summary" ||
        source.text.length > existing.text.length)
    )
      Object.assign(existing, source, { id: existing.id, url });
    existing.marketCode = market;
    return false;
  }
  const host = new URL(url).hostname,
    limit = isOfficial(url) ? 4 : 2;
  if (sources.length >= 28) {
    if (!isOfficial(url)) return false;
    const at = sources.findLastIndex(
      (s) => s.kind !== "document" && !isOfficial(s.url),
    );
    if (at < 0) return false;
    const id = sources[at].id;
    sources[at] = { ...source, url, id };
    return true;
  }
  if (
    sources.filter((s) => {
      try {
        return new URL(s.url).hostname === host;
      } catch {
        return false;
      }
    }).length >= limit
  )
    return false;
  if (
    sources.some(
      (s) =>
        s.marketCode === source.marketCode &&
        s.title.toLowerCase().trim() === source.title.toLowerCase().trim(),
    )
  )
    return false;
  sources.push({ ...source, url, id: `S${sources.length + 1}` });
  return true;
}
// Provider fetch may return escaped Markdown rather than reader-visible text.
export function readableSourceText(text: string) {
  return text.replace(/\\([\\`*_{}\[\]()#+.!?,;:\/<>|~="'\-])/g, "$1");
}

export function queryForRoute(
  input: StudyInput,
  code: string,
  query: string,
  official = false,
) {
  const t = input.targets.find((t) => t.code === code);
  if (!t) throw new Error("未知交易方案");
  const scoped = `${t.name} ${query}`;
  return official
    ? officialQuery(
        jurisdiction(t),
        scoped,
        input.kind,
        !isCrossBorder(input, t),
      )
    : scoped.slice(0, 128);
}
