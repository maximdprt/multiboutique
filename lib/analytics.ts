// Mesure d'audience : classement des sources (dont les assistants IA), appareils, agrégation.
import type { AnalyticsDay, Counter } from "./types";

export const AI_SOURCES = ["ChatGPT", "Perplexity", "Claude", "Gemini", "Copilot", "Mistral", "DeepSeek"];
export const SEARCH_SOURCES = ["Google", "Bing", "DuckDuckGo", "Qwant", "Ecosia", "Yahoo"];
export const SOCIAL_SOURCES = ["Instagram", "TikTok", "Facebook", "Pinterest", "YouTube", "X", "LinkedIn", "Snapchat", "Reddit"];

export type SourceGroup = "Assistants IA" | "Moteurs de recherche" | "Réseaux sociaux" | "Accès direct" | "Autres sites";
export function sourceGroup(source: string): SourceGroup {
  if (AI_SOURCES.includes(source)) return "Assistants IA";
  if (SEARCH_SOURCES.includes(source)) return "Moteurs de recherche";
  if (SOCIAL_SOURCES.includes(source)) return "Réseaux sociaux";
  if (source === "Direct") return "Accès direct";
  return "Autres sites";
}

const RULES: [RegExp, string][] = [
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$|^chatgpt$/, "ChatGPT"],
  [/(^|\.)perplexity\.ai$|^perplexity$/, "Perplexity"],
  [/(^|\.)claude\.ai$|^claude$/, "Claude"],
  [/^gemini\.google\.com$|^gemini$/, "Gemini"],
  [/(^|\.)copilot\.microsoft\.com$|^copilot$/, "Copilot"],
  [/(^|\.)chat\.mistral\.ai$|^mistral$/, "Mistral"],
  [/(^|\.)deepseek\.com$|^deepseek$/, "DeepSeek"],
  [/(^|\.)google\.[a-z.]+$|^google$/, "Google"],
  [/(^|\.)bing\.com$|^bing$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)qwant\.com$/, "Qwant"],
  [/(^|\.)ecosia\.org$/, "Ecosia"],
  [/(^|\.)yahoo\.[a-z.]+$/, "Yahoo"],
  [/(^|\.)instagram\.com$|^instagram$|^ig$/, "Instagram"],
  [/(^|\.)tiktok\.com$|^tiktok$/, "TikTok"],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$|^facebook$|^fb$/, "Facebook"],
  [/(^|\.)pinterest\.[a-z.]+$|^pin\.it$|^pinterest$/, "Pinterest"],
  [/(^|\.)youtube\.com$|^youtu\.be$|^youtube$/, "YouTube"],
  [/^t\.co$|(^|\.)x\.com$|(^|\.)twitter\.com$/, "X"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "LinkedIn"],
  [/(^|\.)snapchat\.com$/, "Snapchat"],
  [/(^|\.)reddit\.com$/, "Reddit"],
];

/** Nom de source lisible à partir d'un domaine référent ou d'un utm_source. */
export function classifySource(raw: string): string {
  const v = raw.toLowerCase().trim().replace(/^www\./, "");
  if (!v) return "Direct";
  for (const [re, name] of RULES) if (re.test(v)) return name;
  return v.slice(0, 60);
}

export function deviceOf(ua: string) {
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) return "Tablette";
  if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua)) return "Mobile";
  return "Ordinateur";
}

export const isBot = (ua: string) =>
  !ua || /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python|axios|node-fetch|facebookexternalhit/i.test(ua);

export type AnalyticsTotals = Omit<AnalyticsDay, "site_id" | "day">;

const merge = (into: Counter, from: Counter) => {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v;
};

export function sumDays(days: AnalyticsDay[]): AnalyticsTotals {
  const t: AnalyticsTotals = { sessions: 0, visitors: 0, pageviews: 0, add_to_cart: 0, checkouts: 0, sources: {}, devices: {}, countries: {}, pages: {} };
  for (const d of days) {
    t.sessions += d.sessions;
    t.visitors += d.visitors;
    t.pageviews += d.pageviews;
    t.add_to_cart += d.add_to_cart;
    t.checkouts += d.checkouts;
    merge(t.sources, d.sources);
    merge(t.devices, d.devices);
    merge(t.countries, d.countries);
    merge(t.pages, d.pages);
  }
  return t;
}

export const topEntries = (c: Counter, n = 10) =>
  Object.entries(c)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);

export function groupSources(c: Counter) {
  const g: Counter = {};
  for (const [k, v] of Object.entries(c)) g[sourceGroup(k)] = (g[sourceGroup(k)] ?? 0) + v;
  return g;
}

export const aiSessions = (c: Counter) => Object.entries(c).filter(([k]) => AI_SOURCES.includes(k)).reduce((s, [, v]) => s + v, 0);

export const COUNTRY_NAMES: Record<string, string> = {
  FR: "France",
  BE: "Belgique",
  CH: "Suisse",
  LU: "Luxembourg",
  CA: "Canada",
  DE: "Allemagne",
  ES: "Espagne",
  IT: "Italie",
  GB: "Royaume-Uni",
  US: "États-Unis",
  "?": "Inconnu",
};
