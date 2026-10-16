import "server-only";
// Données de la ville 3D : boutiques (bâtiments), agents, idées de la veille (terrains à bâtir).
import { db } from "./db";
import { siteSlots } from "./admin";
import { period, splitOrders, totals } from "./stats";

// Mêmes couleurs que les graphiques (palette validée), en hexadécimal pour la 3D.
const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];

export type QGData = {
  generatedAt: string;
  sites: {
    id: string;
    name: string;
    domain: string;
    color: string;
    active: boolean;
    revenue30: number;
    orders30: number;
    revenueToday: number;
    ordersToday: number;
    products: number;
    guides: number;
  }[];
  runs: { id: string; kind: string; status: string; title: string; site_id: string | null; log: string[]; created_at: string; finished_at: string | null }[];
  ideas: { id: string; product: string; niche: string; score: number; links: { label: string; url: string }[] }[];
  toHandle: number;
};

export async function qgSnapshotData(): Promise<QGData> {
  const p30 = period(30);
  const p1 = period(1);
  const [sites, orders, runs, opps, products, guides, paid] = await Promise.all([
    db.listSites(),
    db.listOrders({ since: p30.fetchSince }),
    db.listRuns(25),
    db.listOpportunities({ limit: 40 }),
    db.listProducts(),
    db.listGuides(),
    db.listOrders({ status: "paid" }),
  ]);
  const slots = siteSlots(sites);
  const cur30 = splitOrders(orders, p30).cur;
  const cur1 = splitOrders(orders, p1).cur;
  return {
    generatedAt: new Date().toISOString(),
    sites: sites.map((s) => {
      const t30 = totals(cur30.filter((o) => o.site_id === s.id));
      const t1 = totals(cur1.filter((o) => o.site_id === s.id));
      return {
        id: s.id,
        name: s.name,
        domain: s.domain,
        color: PALETTE[(slots[s.id] - 1) % 8],
        active: s.active,
        revenue30: t30.revenue,
        orders30: t30.orders,
        revenueToday: t1.revenue,
        ordersToday: t1.orders,
        products: products.filter((x) => x.site_id === s.id && x.active).length,
        guides: guides.filter((g) => g.site_id === s.id && g.published).length,
      };
    }),
    runs: runs.map((r) => ({ id: r.id, kind: r.kind, status: r.status, title: r.title, site_id: r.site_id ?? (typeof r.result?.site_id === "string" ? r.result.site_id : null), log: r.log.slice(-6), created_at: r.created_at, finished_at: r.finished_at })),
    ideas: opps
      .filter((o) => o.status === "nouvelle" || o.status === "retenue")
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((o) => ({
        id: o.id,
        product: o.product,
        niche: o.niche,
        score: o.score,
        links: [...o.examples.map((e) => ({ label: e.name, url: e.url })), ...o.sources.map((u) => ({ label: u.replace(/^https?:\/\/(www\.)?/, "").split("/")[0], url: u }))].slice(0, 4),
      })),
    toHandle: paid.length,
  };
}
