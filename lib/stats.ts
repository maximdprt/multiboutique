import type { Order, Site } from "./types";
import { dayKeyOf } from "./dates";

export const COUNTED: Order["status"][] = ["paid", "sent_to_supplier", "shipped", "delivered"];
export const isCounted = (o: Order) => COUNTED.includes(o.status);

const DAY = 86_400_000;

/** Période glissante en jours "calendaires" (fuseau de l'admin). */
export type Period = { days: number; keys: string[]; prevKeys: string[]; fetchSince: string; start: string; end: string; prevStart: string; prevEnd: string };

export function period(days: number): Period {
  const now = Date.now();
  const keys: string[] = [];
  const prevKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(dayKeyOf(now - i * DAY));
  for (let i = 2 * days - 1; i >= days; i--) prevKeys.push(dayKeyOf(now - i * DAY));
  return {
    days,
    keys,
    prevKeys,
    fetchSince: new Date(now - (2 * days + 1) * DAY).toISOString(),
    start: keys[0],
    end: keys[keys.length - 1],
    prevStart: prevKeys[0],
    prevEnd: prevKeys[prevKeys.length - 1],
  };
}

/** Répartit des commandes entre la période et la période précédente. */
export function splitOrders(orders: Order[], p: Period) {
  const cur = new Set(p.keys);
  const prev = new Set(p.prevKeys);
  const a: Order[] = [];
  const b: Order[] = [];
  for (const o of orders) {
    const k = dayKeyOf(o.created_at);
    if (cur.has(k)) a.push(o);
    else if (prev.has(k)) b.push(o);
  }
  return { cur: a, prev: b };
}

export const dayLabel = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

export type Totals = { revenue: number; orders: number; aov: number; margin: number; refunds: number; units: number };

export function totals(orders: Order[]): Totals {
  const ok = orders.filter(isCounted);
  const revenue = ok.reduce((s, o) => s + o.total_cents, 0);
  let margin = 0;
  let units = 0;
  for (const o of ok)
    for (const i of o.items) {
      units += i.quantity;
      margin += (i.unit_price_cents - (i.unit_cost_cents ?? 0)) * i.quantity;
    }
  return {
    revenue,
    orders: ok.length,
    aov: ok.length ? Math.round(revenue / ok.length) : 0,
    margin,
    refunds: orders.filter((o) => o.status === "refunded").length,
    units,
  };
}

export const change = (cur: number, prev: number) => (prev === 0 ? null : (cur - prev) / prev);

export type DayPoint = { key: string; label: string; bySite: Record<string, number>; total: number; orders: number };

export function dailySeries(orders: Order[], p: Period, siteIds: string[]): DayPoint[] {
  const points: DayPoint[] = p.keys.map((key) => ({
    key,
    label: dayLabel(key),
    bySite: Object.fromEntries(siteIds.map((id) => [id, 0])),
    total: 0,
    orders: 0,
  }));
  const idx = new Map(points.map((pt) => [pt.key, pt]));
  for (const o of orders) {
    if (!isCounted(o)) continue;
    const pt = idx.get(dayKeyOf(o.created_at));
    if (!pt) continue;
    pt.bySite[o.site_id] = (pt.bySite[o.site_id] ?? 0) + o.total_cents;
    pt.total += o.total_cents;
    pt.orders += 1;
  }
  return points;
}

/** Ramène une série quotidienne à ~12 points pour une mini-courbe. */
export function compress(values: number[], n = 12) {
  if (values.length <= n) return values;
  const size = values.length / n;
  return Array.from({ length: n }, (_, i) => {
    const part = values.slice(Math.floor(i * size), Math.floor((i + 1) * size));
    return part.reduce((s, v) => s + v, 0);
  });
}

export function bySite(orders: Order[], prev: Order[], sites: Site[]) {
  return sites.map((s) => {
    const cur = totals(orders.filter((o) => o.site_id === s.id));
    const before = totals(prev.filter((o) => o.site_id === s.id));
    return { site: s, ...cur, revenueChange: change(cur.revenue, before.revenue) };
  });
}

export function topProducts(orders: Order[], limit = 6) {
  const m = new Map<string, { id: string; title: string; site_id: string; units: number; revenue: number }>();
  for (const o of orders) {
    if (!isCounted(o)) continue;
    for (const i of o.items) {
      const e = m.get(i.product_id) ?? { id: i.product_id, title: i.title, site_id: o.site_id, units: 0, revenue: 0 };
      e.units += i.quantity;
      e.revenue += i.unit_price_cents * i.quantity;
      m.set(i.product_id, e);
    }
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export type Customer = {
  email: string;
  name: string;
  orders: number;
  spent: number;
  first: string;
  last: string;
  sites: string[];
  city: string;
};

export function customers(orders: Order[]): Customer[] {
  const m = new Map<string, Customer>();
  for (const o of orders) {
    const key = o.email.toLowerCase();
    const c =
      m.get(key) ??
      ({ email: o.email, name: o.name, orders: 0, spent: 0, first: o.created_at, last: o.created_at, sites: [], city: "" } as Customer);
    if (isCounted(o)) {
      c.orders += 1;
      c.spent += o.total_cents;
    }
    if (o.created_at < c.first) c.first = o.created_at;
    if (o.created_at >= c.last) {
      c.last = o.created_at;
      c.name = o.name || c.name;
      c.city = o.shipping_address?.city ?? c.city;
    }
    if (!c.sites.includes(o.site_id)) c.sites.push(o.site_id);
    m.set(key, c);
  }
  return [...m.values()].sort((a, b) => b.spent - a.spent);
}
