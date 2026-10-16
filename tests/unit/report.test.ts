import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalyticsDay, Opportunity, Order, Product, Site } from "@/lib/types";
import { item, order, product, site } from "./fixtures";

// Base de données en mémoire, remplie par chaque test
const state = vi.hoisted(() => ({
  sites: [] as Site[],
  orders: [] as Order[],
  products: [] as Product[],
  analytics: [] as AnalyticsDay[],
  opportunities: [] as Opportunity[],
}));

vi.mock("@/lib/db", () => ({
  db: {
    listSites: async () => state.sites,
    listOrders: async (f: { since?: string; status?: string } = {}) =>
      state.orders.filter((o) => (!f.since || o.created_at >= f.since) && (!f.status || o.status === f.status)),
    analyticsDays: async ({ since, until }: { since: string; until: string }) => state.analytics.filter((d) => d.day >= since && d.day <= until),
    listProducts: async () => state.products,
    listGuides: async () => [],
    listRuns: async () => [],
    listOpportunities: async () => state.opportunities,
  },
}));

const { buildDailyReport, reportText } = await import("@/lib/report");

// 16 octobre 2026, 10 h à Paris : le rapport couvre le 15
const NOW = Date.parse("2026-10-16T08:00:00Z");
const at = (day: string, h = 10) => `${day}T${String(h).padStart(2, "0")}:00:00Z`;

function analytics(day: string, sessions: number, p: Partial<AnalyticsDay> = {}): AnalyticsDay {
  return { site_id: "bocal", day, pageviews: sessions * 2, sessions, visitors: sessions, add_to_cart: 0, checkouts: 0, sources: {}, devices: {}, countries: {}, pages: {}, ...p };
}

beforeEach(() => {
  vi.stubEnv("CJ_API_KEY", "");
  state.sites = [site()];
  state.orders = [];
  state.products = [product()];
  state.analytics = [];
  state.opportunities = [];
});

describe("rapport du matin", () => {
  it("résume la veille : chiffre d'affaires, commandes et bénéfice estimé", async () => {
    state.orders = [
      order({ total_cents: 4000, items: [item({ quantity: 2, unit_price_cents: 2000, unit_cost_cents: 600 })], created_at: at("2026-10-15") }),
      order({ total_cents: 9900, status: "refunded", created_at: at("2026-10-15") }),
      order({ total_cents: 7000, created_at: at("2026-10-14") }),
    ];
    const r = await buildDailyReport(NOW);
    expect(r.day).toBe("2026-10-15");
    expect(r.revenue_cents).toBe(4000);
    expect(r.orders).toBe(1);
    // 4000 - coût 1200 - frais Stripe (1,5 % + 0,25 €) = 85
    expect(r.profit_cents).toBe(2715);
    // 40 € contre 70 € / 7 jours = 10 € de moyenne (le format français met une espace insécable avant €)
    expect(r.headline).toMatch(/^Jeudi 15 octobre : 40\s€ de CA, 1 commande \(\+300 % par rapport à la moyenne de la semaine\)$/);
    expect(r.sites[0]).toMatchObject({ site_id: "bocal", revenue_cents: 4000, orders: 1 });
  });

  it("liste les choses à faire, les plus urgentes en premier", async () => {
    state.orders = [order({ supplier_status: "approbation", created_at: at("2026-10-15") })];
    state.products = [product({ images: [] }), product({ id: "p2", images: ["/demo/bocal.svg"], stock: 3 }), product({ id: "p3", cost_cents: null })];
    state.opportunities = [{ id: "x", score: 80, product: "Gourde isotherme" } as Opportunity];
    state.sites = [site({ legal: { ...site().legal, siret: "000 000 000 00000" } })];
    const r = await buildDailyReport(NOW);
    expect(r.todos[0]).toMatchObject({ level: "urgent", href: "/admin/commandes?onglet=a-transmettre" });
    const labels = r.todos.map((t) => t.label).join("\n");
    expect(labels).toContain("Ajouter de vraies photos à 2 produit(s)");
    expect(labels).toContain("Renseigner le prix d'achat de 1 produit(s)");
    expect(labels).toContain("1 produit(s) en stock faible");
    expect(labels).toContain("1 idée(s) de la veille à trier");
    expect(labels).toContain("Compléter les informations légales de Bocal & Cie");
    // sans clé CJ, on ne réclame pas d'identifiant de variante
    expect(labels).not.toContain("identifiant CJ");
    expect(r.ideas).toContain("Meilleure idée de la veille : « Gourde isotherme » (80/100).");
  });

  it("alerte quand une boutique qui vend d'habitude n'a rien vendu hier", async () => {
    const week = ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"];
    state.orders = week.map((d) => order({ created_at: at(d) }));
    const r = await buildDailyReport(NOW);
    expect(r.alerts).toContain("Bocal & Cie : aucune vente hier alors qu'elle en fait d'habitude. Vérifiez que le paiement fonctionne.");
  });

  it("alerte quand les visites chutent", async () => {
    const week = ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"];
    state.analytics = [...week.map((d) => analytics(d, 100)), analytics("2026-10-15", 30)];
    const r = await buildDailyReport(NOW);
    expect(r.alerts).toContain("Bocal & Cie : visites en baisse de 70 % hier par rapport à la semaine.");
  });

  it("produit une version texte pour l'e-mail et Telegram", async () => {
    state.orders = [order({ supplier_status: "approbation", created_at: at("2026-10-15") })];
    const text = reportText(await buildDailyReport(NOW));
    expect(text).toContain("Bénéfice estimé");
    expect(text).toMatch(/À faire \(\d+\)\n {2}1\. 1 commande\(s\) au-dessus du seuil/);
  });
});
