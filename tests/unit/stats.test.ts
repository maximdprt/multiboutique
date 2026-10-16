import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bySite, change, compress, customers, dailySeries, period, splitOrders, topProducts, totals } from "@/lib/stats";
import { item, order, site } from "./fixtures";

describe("totals", () => {
  it("additionne seulement les commandes payées ou en cours de livraison", () => {
    const t = totals([
      order({ total_cents: 2000, status: "paid" }),
      order({ total_cents: 3000, status: "shipped" }),
      order({ total_cents: 9900, status: "refunded" }),
      order({ total_cents: 5000, status: "cancelled" }),
    ]);
    expect(t.revenue).toBe(5000);
    expect(t.orders).toBe(2);
    expect(t.aov).toBe(2500);
    expect(t.refunds).toBe(1);
  });

  it("calcule la marge et les unités à partir des articles", () => {
    const t = totals([order({ items: [item({ quantity: 3, unit_price_cents: 1500, unit_cost_cents: 500 }), item({ quantity: 1, unit_price_cents: 1000, unit_cost_cents: null })] })]);
    expect(t.units).toBe(4);
    // (1500 - 500) × 3 + (1000 - 0) × 1
    expect(t.margin).toBe(4000);
  });

  it("renvoie des zéros sans commande", () => {
    expect(totals([])).toEqual({ revenue: 0, orders: 0, aov: 0, margin: 0, refunds: 0, units: 0 });
  });
});

describe("change", () => {
  it("donne la variation relative, ou null sans point de comparaison", () => {
    expect(change(150, 100)).toBeCloseTo(0.5);
    expect(change(50, 100)).toBeCloseTo(-0.5);
    expect(change(10, 0)).toBeNull();
  });
});

describe("période glissante", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("découpe 7 jours et les 7 jours précédents, dans le fuseau de Paris", () => {
    const p = period(7);
    expect(p.keys).toHaveLength(7);
    expect(p.start).toBe("2026-10-10");
    expect(p.end).toBe("2026-10-16");
    expect(p.prevStart).toBe("2026-10-03");
    expect(p.prevEnd).toBe("2026-10-09");
  });

  it("range une commande de 23 h 30 à Paris dans le bon jour", () => {
    const p = period(7);
    // 21:30 UTC = 23:30 à Paris (heure d'été) : toujours le 15
    const late = order({ created_at: "2026-10-15T21:30:00Z" });
    // 22:30 UTC = 00:30 le 16 à Paris
    const night = order({ created_at: "2026-10-15T22:30:00Z" });
    const old = order({ created_at: "2026-10-05T12:00:00Z" });
    const tooOld = order({ created_at: "2026-09-01T12:00:00Z" });
    const { cur, prev } = splitOrders([late, night, old, tooOld], p);
    expect(cur.map((o) => o.id)).toEqual([late.id, night.id]);
    expect(prev.map((o) => o.id)).toEqual([old.id]);
    const series = dailySeries([late, night], p, ["bocal"]);
    expect(series.find((d) => d.key === "2026-10-15")?.orders).toBe(1);
    expect(series.find((d) => d.key === "2026-10-16")?.orders).toBe(1);
  });

  it("répartit le chiffre d'affaires quotidien par boutique et ignore les remboursements", () => {
    const p = period(7);
    const series = dailySeries(
      [
        order({ site_id: "bocal", total_cents: 1000, created_at: "2026-10-14T10:00:00Z" }),
        order({ site_id: "chat", total_cents: 2500, created_at: "2026-10-14T11:00:00Z" }),
        order({ site_id: "chat", total_cents: 9999, status: "refunded", created_at: "2026-10-14T12:00:00Z" }),
      ],
      p,
      ["bocal", "chat"],
    );
    const day = series.find((d) => d.key === "2026-10-14")!;
    expect(day.bySite).toEqual({ bocal: 1000, chat: 2500 });
    expect(day.total).toBe(3500);
    expect(day.orders).toBe(2);
  });
});

describe("compress", () => {
  it("garde la série telle quelle si elle est courte", () => {
    expect(compress([1, 2, 3], 12)).toEqual([1, 2, 3]);
  });
  it("regroupe une longue série sans perdre le total", () => {
    const values = Array.from({ length: 30 }, (_, i) => i + 1);
    const out = compress(values, 10);
    expect(out).toHaveLength(10);
    expect(out.reduce((s, v) => s + v, 0)).toBe(values.reduce((s, v) => s + v, 0));
  });
});

describe("classements", () => {
  it("classe les produits par chiffre d'affaires", () => {
    const top = topProducts([
      order({ items: [item({ product_id: "a", title: "A", quantity: 1, unit_price_cents: 1000 })] }),
      order({ items: [item({ product_id: "b", title: "B", quantity: 3, unit_price_cents: 1000 })] }),
      order({ items: [item({ product_id: "a", title: "A", quantity: 1, unit_price_cents: 1000 })] }),
      order({ status: "refunded", items: [item({ product_id: "c", title: "C", quantity: 10, unit_price_cents: 1000 })] }),
    ]);
    expect(top.map((t) => [t.id, t.units, t.revenue])).toEqual([
      ["b", 3, 3000],
      ["a", 2, 2000],
    ]);
  });

  it("regroupe les clients par e-mail, sans tenir compte des majuscules", () => {
    const list = customers([
      order({ email: "Marie@exemple.fr", name: "Marie", total_cents: 2000, created_at: "2026-10-01T10:00:00Z" }),
      order({ email: "marie@exemple.fr", name: "Marie D.", total_cents: 3000, created_at: "2026-10-10T10:00:00Z", site_id: "chat" }),
      order({ email: "paul@exemple.fr", total_cents: 1000 }),
    ]);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ orders: 2, spent: 5000, name: "Marie D.", first: "2026-10-01T10:00:00Z", sites: ["bocal", "chat"] });
  });

  it("compare chaque boutique à la période précédente", () => {
    const rows = bySite([order({ site_id: "bocal", total_cents: 3000 })], [order({ site_id: "bocal", total_cents: 2000 })], [site()]);
    expect(rows[0].revenue).toBe(3000);
    expect(rows[0].revenueChange).toBeCloseTo(0.5);
  });
});
