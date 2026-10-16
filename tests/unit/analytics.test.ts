import { describe, expect, it } from "vitest";
import { aiSessions, classifySource, deviceOf, groupSources, isBot, sourceGroup, sumDays, topEntries } from "@/lib/analytics";
import type { AnalyticsDay } from "@/lib/types";

describe("classement des sources", () => {
  it.each([
    ["chatgpt.com", "ChatGPT"],
    ["www.perplexity.ai", "Perplexity"],
    ["claude.ai", "Claude"],
    ["gemini.google.com", "Gemini"],
    ["copilot.microsoft.com", "Copilot"],
    ["www.google.fr", "Google"],
    ["google.co.uk", "Google"],
    ["bing.com", "Bing"],
    ["l.instagram.com", "Instagram"],
    ["ig", "Instagram"],
    ["t.co", "X"],
    ["fr.pinterest.com", "Pinterest"],
    ["", "Direct"],
    ["  ", "Direct"],
    ["Blog-Cuisine.fr", "blog-cuisine.fr"],
  ])("%s -> %s", (raw, expected) => {
    expect(classifySource(raw)).toBe(expected);
  });

  it("ne confond pas Gemini avec Google", () => {
    expect(sourceGroup(classifySource("gemini.google.com"))).toBe("Assistants IA");
    expect(sourceGroup(classifySource("www.google.com"))).toBe("Moteurs de recherche");
  });

  it("range chaque source dans un groupe", () => {
    expect(sourceGroup("ChatGPT")).toBe("Assistants IA");
    expect(sourceGroup("TikTok")).toBe("Réseaux sociaux");
    expect(sourceGroup("Direct")).toBe("Accès direct");
    expect(sourceGroup("blog-cuisine.fr")).toBe("Autres sites");
  });

  it("totalise par groupe et compte les visites venues des IA", () => {
    const c = { ChatGPT: 3, Perplexity: 2, Google: 10, Direct: 5 };
    expect(groupSources(c)).toEqual({ "Assistants IA": 5, "Moteurs de recherche": 10, "Accès direct": 5 });
    expect(aiSessions(c)).toBe(5);
  });
});

describe("appareils et robots", () => {
  it("reconnaît mobile, tablette et ordinateur", () => {
    expect(deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148")).toBe("Mobile");
    expect(deviceOf("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36")).toBe("Mobile");
    expect(deviceOf("Mozilla/5.0 (Linux; Android 13; SM-X200) Safari/537.36")).toBe("Tablette");
    expect(deviceOf("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("Tablette");
    expect(deviceOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0")).toBe("Ordinateur");
  });

  it("écarte les robots et les visites sans navigateur", () => {
    expect(isBot("")).toBe(true);
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("Mozilla/5.0 HeadlessChrome/130.0")).toBe(true);
    expect(isBot("curl/8.4.0")).toBe(true);
    expect(isBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0")).toBe(false);
  });
});

describe("agrégation des jours", () => {
  const day = (p: Partial<AnalyticsDay>): AnalyticsDay => ({
    site_id: "bocal",
    day: "2026-10-15",
    pageviews: 0,
    sessions: 0,
    visitors: 0,
    add_to_cart: 0,
    checkouts: 0,
    sources: {},
    devices: {},
    countries: {},
    pages: {},
    ...p,
  });

  it("additionne compteurs et répartitions", () => {
    const t = sumDays([
      day({ sessions: 10, pageviews: 30, add_to_cart: 2, sources: { Google: 6, Direct: 4 }, pages: { "/": 20 } }),
      day({ sessions: 5, pageviews: 8, checkouts: 1, sources: { Google: 5 }, pages: { "/": 3, "/panier": 5 } }),
    ]);
    expect(t).toMatchObject({ sessions: 15, pageviews: 38, add_to_cart: 2, checkouts: 1 });
    expect(t.sources).toEqual({ Google: 11, Direct: 4 });
    expect(topEntries(t.pages, 1)).toEqual([["/", 23]]);
  });
});
