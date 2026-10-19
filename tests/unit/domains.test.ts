import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Site } from "@/lib/types";
import { site } from "./fixtures";

// Base en mémoire : seuls les réglages servent à l'agent Domaines
const state = vi.hoisted(() => ({ kind: "demo" as "demo" | "supabase", settings: new Map<string, unknown>(), sites: [] as Site[] }));

vi.mock("@/lib/db", () => ({
  db: {
    get kind() {
      return state.kind;
    },
    getSetting: async (k: string) => structuredClone(state.settings.get(k) ?? null),
    setSetting: async (k: string, v: unknown) => void state.settings.set(k, structuredClone(v)),
    listSites: async () => state.sites,
    listProducts: async () => [],
    listGuides: async () => [],
  },
}));

const { addDomain, checkDomain, checkAllDomains, domainReport, getDomainState, hostnames, isApex, loadDomainStates, markDeclared, recordName, statusOf } =
  await import("@/lib/domains");

// ---------- Faux serveur Vercel ----------
type Call = { method: string; url: URL; body: unknown };
let calls: Call[] = [];
let vercel: { added: Set<string>; verified: boolean; misconfigured: boolean; serves: boolean };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function fakeFetch(input: string | URL | Request, init: RequestInit = {}) {
  const url = new URL(String(input));
  const method = init.method ?? "GET";
  const body = init.body ? JSON.parse(String(init.body)) : undefined;
  calls.push({ method, url, body });
  if (url.hostname === "api.indexnow.org") return Promise.resolve(new Response(null, { status: 200 }));
  if (url.pathname === "/robots.txt")
    return vercel.serves ? Promise.resolve(new Response(`User-agent: *\nSitemap: https://${url.hostname}/sitemap.xml\n`)) : Promise.reject(new Error("certificat"));
  const p = url.pathname;
  let m: RegExpExecArray | null;
  if (method === "POST" && p === "/v10/projects/prj_test/domains") {
    vercel.added.add((body as { name: string }).name);
    return Promise.resolve(json({ name: (body as { name: string }).name, verified: false }));
  }
  if ((m = /^\/v9\/projects\/prj_test\/domains\/([^/]+)(\/verify)?$/.exec(p))) {
    const name = decodeURIComponent(m[1]);
    if (!vercel.added.has(name)) return Promise.resolve(json({ error: { code: "not_found", message: "Domain not found" } }, 404));
    if (m[2] && !vercel.verified) return Promise.resolve(json({ error: { code: "missing_txt_record" } }, 400));
    return Promise.resolve(
      json({
        name,
        apexName: "bocal-et-cie.fr",
        verified: vercel.verified,
        verification: vercel.verified ? [] : [{ type: "TXT", domain: "_vercel.bocal-et-cie.fr", value: `vc-domain-verify=${name},abc123`, reason: "pending" }],
      }),
    );
  }
  if ((m = /^\/v6\/domains\/([^/]+)\/config$/.exec(p)))
    return Promise.resolve(
      json({
        misconfigured: vercel.misconfigured,
        recommendedIPv4: [
          { rank: 2, value: ["76.76.21.21"] },
          { rank: 1, value: ["216.198.79.1"] },
        ],
        recommendedCNAME: [{ rank: 1, value: "d1d4fc829fe7bc7c.vercel-dns-017.com." }],
      }),
    );
  return Promise.resolve(json({ error: { message: `route inattendue ${method} ${p}` } }, 500));
}

beforeEach(() => {
  state.kind = "demo";
  state.settings.clear();
  state.sites = [site()];
  calls = [];
  vercel = { added: new Set(), verified: false, misconfigured: true, serves: false };
  vi.stubEnv("VERCEL_TOKEN", "");
  vi.stubEnv("VERCEL_PROJECT_ID", "");
  vi.stubEnv("VERCEL_TEAM_ID", "");
  vi.stubEnv("INDEXNOW_KEY", "");
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("noms de domaine", () => {
  it("ajoute www seulement pour un domaine nu", () => {
    expect(isApex("bocal-et-cie.fr")).toBe(true);
    expect(hostnames("bocal-et-cie.fr")).toEqual(["bocal-et-cie.fr", "www.bocal-et-cie.fr"]);
    expect(hostnames("shop.ma-marque.fr")).toEqual(["shop.ma-marque.fr"]);
  });

  it("donne le nom relatif à saisir chez le registraire", () => {
    expect(recordName("bocal-et-cie.fr", "bocal-et-cie.fr")).toBe("@");
    expect(recordName("www.bocal-et-cie.fr", "bocal-et-cie.fr")).toBe("www");
    expect(recordName("_vercel.bocal-et-cie.fr", "bocal-et-cie.fr")).toBe("_vercel");
  });

  it("donne l'étape où agir, dans l'ordre", () => {
    expect(statusOf({ added: false, dns: true, verified: true, https: true })).toBe("a_ajouter");
    expect(statusOf({ added: true, dns: false, verified: true, https: true })).toBe("dns");
    expect(statusOf({ added: true, dns: true, verified: false, https: false })).toBe("verification");
    expect(statusOf({ added: true, dns: true, verified: true, https: false })).toBe("certificat");
    expect(statusOf({ added: true, dns: true, verified: true, https: true })).toBe("en_ligne");
  });
});

describe("mode démo", () => {
  it("simule l'ajout puis une étape par vérification, jusqu'à « En ligne »", async () => {
    const s = site();
    expect((await getDomainState(s)).status).toBe("a_ajouter");
    const added = await addDomain(s);
    expect(added.status).toBe("dns");
    expect(added.records.map((r) => `${r.type} ${r.name}`)).toEqual(["A @", "CNAME www", "TXT _vercel"]);
    expect((await checkDomain(s)).status).toBe("verification");
    expect((await checkDomain(s)).status).toBe("certificat");
    const online = await checkDomain(s);
    expect(online.status).toBe("en_ligne");
    expect(online.online_since).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled(); // aucune requête réelle en démo
  });

  it("repart de zéro si le domaine de la boutique change", async () => {
    await addDomain(site());
    expect((await getDomainState(site({ domain: "nouveau-domaine.fr" }))).status).toBe("a_ajouter");
  });
});

describe("avec l'API Vercel", () => {
  beforeEach(() => {
    state.kind = "supabase";
    vi.stubEnv("VERCEL_TOKEN", "tok_abcdefghijklmnopqrstuvwx");
    vi.stubEnv("VERCEL_PROJECT_ID", "prj_test");
    vi.stubEnv("VERCEL_TEAM_ID", "team_abc");
  });

  it("ajoute le domaine et www (redirigé en 308) et affiche les DNS recommandés pour le projet", async () => {
    const st = await addDomain(site());
    const posts = calls.filter((c) => c.method === "POST" && c.url.pathname === "/v10/projects/prj_test/domains").map((c) => c.body);
    expect(posts).toEqual([{ name: "bocal-et-cie.fr" }, { name: "www.bocal-et-cie.fr", redirect: "bocal-et-cie.fr", redirectStatusCode: 308 }]);
    expect(calls.filter((c) => c.url.hostname === "api.vercel.com").every((c) => c.url.searchParams.get("teamId") === "team_abc")).toBe(true);
    expect(calls.find((c) => c.url.pathname.endsWith("/config"))?.url.searchParams.get("projectIdOrName")).toBe("prj_test");
    expect(st.status).toBe("dns");
    expect(st.added_at).toBeTruthy();
    const rec = Object.fromEntries(st.records.map((r) => [`${r.type} ${r.name}`, r.value]));
    expect(rec["A @"]).toBe("216.198.79.1"); // rang 1, pas une valeur codée en dur
    expect(rec["CNAME www"]).toBe("d1d4fc829fe7bc7c.vercel-dns-017.com");
    expect(rec["TXT _vercel"]).toContain("vc-domain-verify=");
  });

  it("ne rajoute pas un domaine déjà présent (relançable sans doublon)", async () => {
    await addDomain(site());
    calls = [];
    await addDomain(site());
    expect(calls.filter((c) => c.method === "POST" && c.url.pathname.endsWith("/domains"))).toEqual([]);
  });

  it("passe en ligne, prévient IndexNow et ajoute la déclaration Google au rapport", async () => {
    vi.stubEnv("INDEXNOW_KEY", "0123456789abcdef0123456789abcdef");
    await addDomain(site());
    Object.assign(vercel, { verified: true, misconfigured: false });
    expect((await checkDomain(site())).status).toBe("certificat");
    vercel.serves = true;
    const st = await checkDomain(site());
    expect(st.status).toBe("en_ligne");
    const ping = calls.find((c) => c.url.hostname === "api.indexnow.org");
    expect(ping?.body).toMatchObject({ host: "bocal-et-cie.fr", urlList: expect.arrayContaining(["https://bocal-et-cie.fr/", "https://bocal-et-cie.fr/produits"]) });

    const report = domainReport(state.sites, await loadDomainStates(state.sites));
    expect(report.todos.map((t) => t.label)).toEqual(["Déclarer le domaine bocal-et-cie.fr dans Google Search Console et Merchant Center"]);
    await markDeclared(site());
    expect(domainReport(state.sites, await loadDomainStates(state.sites)).todos).toEqual([]);

    // Un seul signal IndexNow, même si on revérifie
    await checkDomain(site());
    expect(calls.filter((c) => c.url.hostname === "api.indexnow.org")).toHaveLength(1);
  });

  it("signale un domaine qui ne répond plus", async () => {
    await addDomain(site());
    Object.assign(vercel, { verified: true, misconfigured: false, serves: true });
    await checkDomain(site());
    vercel.serves = false;
    const r = await checkAllDomains();
    expect(r).toEqual({ domaines_verifies: 1, en_ligne: 0 });
    expect(domainReport(state.sites, await loadDomainStates(state.sites)).alerts[0]).toContain("ne répond plus");
  });

  it("explique un jeton refusé", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: "forbidden", message: "Not authorized" } }, 403)));
    const st = await checkDomain(site());
    expect(st.status).toBe("erreur");
    expect(st.message).toContain("VERCEL_TOKEN");
  });
});

describe("mode manuel (base réelle, sans jeton Vercel)", () => {
  beforeEach(() => {
    state.kind = "supabase";
  });

  it("refuse l'ajout automatique et vérifie seulement la réponse HTTPS", async () => {
    await expect(addDomain(site())).rejects.toThrow("VERCEL_TOKEN");
    const st = await checkDomain(site());
    expect(st.status).toBe("dns");
    expect(st.message).toContain("Settings > Domains");
    vercel.serves = true;
    expect((await checkDomain(site())).status).toBe("en_ligne");
  });
});
