// Mode démo : base de données dans un fichier JSON local (.data/demo-db.json).
// Activé automatiquement tant que Supabase n'est pas configuré.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import type { AgentRun, Guide, NewOrder, Opportunity, Order, Product, Site } from "../types";
import type { Db, OrderFilter } from "./types";
import { DEMO_GUIDES, DEMO_OPPORTUNITIES, DEMO_PRODUCTS, DEMO_SITES, generateDemoOrders } from "./seed";

type State = { sites: Site[]; products: Product[]; guides: Guide[]; orders: Order[]; opportunities: Opportunity[]; runs: AgentRun[] };

const FILE =
  process.env.DEMO_DB_PATH ||
  (process.env.VERCEL ? path.join(os.tmpdir(), "demo-db.json") : path.join(process.cwd(), ".data", "demo-db.json"));

const g = globalThis as unknown as { __demoState?: State };

function load(): State {
  if (g.__demoState) return g.__demoState;
  try {
    g.__demoState = JSON.parse(fs.readFileSync(FILE, "utf8")) as State;
    // fichier créé par une version précédente
    g.__demoState.opportunities ??= structuredClone(DEMO_OPPORTUNITIES);
    g.__demoState.runs ??= [];
  } catch {
    const orders = generateDemoOrders();
    g.__demoState = {
      sites: structuredClone(DEMO_SITES),
      products: structuredClone(DEMO_PRODUCTS),
      guides: structuredClone(DEMO_GUIDES),
      orders,
      opportunities: structuredClone(DEMO_OPPORTUNITIES),
      runs: [],
    };
    persist();
  }
  return g.__demoState!;
}

function persist() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(g.__demoState));
  } catch {
    // système de fichiers en lecture seule : on garde en mémoire
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** Écriture différée : évite de réécrire le fichier à chaque page vue. */
function persistSoon() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    persist();
  }, 2000);
}

const now = () => new Date().toISOString();
const clone = <T,>(v: T): T => structuredClone(v);

function matchOrder(o: Order, f: OrderFilter) {
  if (f.siteId && o.site_id !== f.siteId) return false;
  if (f.since && o.created_at < f.since) return false;
  if (f.until && o.created_at >= f.until) return false;
  if (f.status && o.status !== f.status) return false;
  if (f.search) {
    const s = f.search.toLowerCase().replace(/^#/, "");
    if (!(o.email.toLowerCase().includes(s) || o.name.toLowerCase().includes(s) || String(o.number) === s)) return false;
  }
  return true;
}

export const demoDb: Db = {
  kind: "demo",

  async listSites() {
    return clone(load().sites);
  },
  async getSite(id) {
    return clone(load().sites.find((s) => s.id === id) ?? null);
  },
  async saveSite(site) {
    const st = load();
    const i = st.sites.findIndex((s) => s.id === site.id);
    if (i >= 0) st.sites[i] = site;
    else st.sites.push({ ...site, created_at: site.created_at || now() });
    persist();
    return clone(site);
  },

  async listProducts(opts = {}) {
    return clone(
      load()
        .products.filter((p) => (!opts.siteId || p.site_id === opts.siteId) && (!opts.activeOnly || p.active))
        .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)),
    );
  },
  async getProduct(id) {
    return clone(load().products.find((p) => p.id === id) ?? null);
  },
  async getProductBySlug(siteId, slug) {
    return clone(load().products.find((p) => p.site_id === siteId && p.slug === slug) ?? null);
  },
  async saveProduct(p) {
    const st = load();
    const i = p.id ? st.products.findIndex((x) => x.id === p.id) : -1;
    let saved: Product;
    if (i >= 0) {
      saved = { ...st.products[i], ...p, updated_at: now() } as Product;
      st.products[i] = saved;
    } else {
      saved = { ...(p as Product), id: p.id || crypto.randomUUID(), created_at: now(), updated_at: now() };
      st.products.push(saved);
    }
    persist();
    return clone(saved);
  },
  async deleteProduct(id) {
    const st = load();
    st.products = st.products.filter((p) => p.id !== id);
    persist();
  },
  async adjustStock(productId, delta) {
    const p = load().products.find((x) => x.id === productId);
    if (p && p.stock !== null) {
      p.stock = Math.max(0, p.stock + delta);
      persist();
    }
  },

  async listGuides(opts = {}) {
    return clone(
      load()
        .guides.filter((x) => (!opts.siteId || x.site_id === opts.siteId) && (!opts.publishedOnly || x.published))
        .sort((a, b) => b.published_at.localeCompare(a.published_at)),
    );
  },
  async getGuide(id) {
    return clone(load().guides.find((x) => x.id === id) ?? null);
  },
  async getGuideBySlug(siteId, slug) {
    return clone(load().guides.find((x) => x.site_id === siteId && x.slug === slug) ?? null);
  },
  async saveGuide(gd) {
    const st = load();
    const i = gd.id ? st.guides.findIndex((x) => x.id === gd.id) : -1;
    let saved: Guide;
    if (i >= 0) {
      saved = { ...st.guides[i], ...gd, updated_at: now() } as Guide;
      st.guides[i] = saved;
    } else {
      saved = { ...(gd as Guide), id: gd.id || crypto.randomUUID(), published_at: gd.published_at || now(), updated_at: now() };
      st.guides.push(saved);
    }
    persist();
    return clone(saved);
  },
  async deleteGuide(id) {
    const st = load();
    st.guides = st.guides.filter((x) => x.id !== id);
    persist();
  },

  async listOrders(f = {}) {
    const list = load()
      .orders.filter((o) => matchOrder(o, f))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return clone(f.limit ? list.slice(0, f.limit) : list);
  },
  async getOrder(id) {
    return clone(load().orders.find((o) => o.id === id) ?? null);
  },
  async getOrderBySession(sessionId) {
    return clone(load().orders.find((o) => o.stripe_session_id === sessionId) ?? null);
  },
  async createOrder(o: NewOrder) {
    const st = load();
    const number = st.orders.reduce((m, x) => Math.max(m, x.number), 1000) + 1;
    const order: Order = { ...o, id: crypto.randomUUID(), number, created_at: o.created_at || now(), updated_at: now() };
    st.orders.push(order);
    persist();
    return clone(order);
  },
  async listOpportunities(opts = {}) {
    const list = load()
      .opportunities.filter((o) => !opts.status || o.status === opts.status)
      .sort((x, y) => y.created_at.localeCompare(x.created_at) || y.score - x.score);
    return clone(opts.limit ? list.slice(0, opts.limit) : list);
  },
  async getOpportunity(id) {
    return clone(load().opportunities.find((o) => o.id === id) ?? null);
  },
  async addOpportunities(rows) {
    const st = load();
    for (const r of rows) st.opportunities.push({ ...r, id: crypto.randomUUID(), created_at: now() });
    persist();
  },
  async updateOpportunity(id, patch) {
    const o = load().opportunities.find((x) => x.id === id);
    if (o) Object.assign(o, patch);
    persist();
  },
  async createRun(r) {
    const run: AgentRun = { ...r, id: crypto.randomUUID(), status: "en_cours", log: [], result: null, created_at: now(), finished_at: null };
    load().runs.push(run);
    persist();
    return clone(run);
  },
  async updateRun(id, patch) {
    const r = load().runs.find((x) => x.id === id);
    if (r) Object.assign(r, patch);
    persistSoon();
  },
  async getRun(id) {
    return clone(load().runs.find((r) => r.id === id) ?? null);
  },
  async listRuns(limit = 30) {
    return clone([...load().runs].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit));
  },
  async updateOrder(id, patch) {
    const st = load();
    const o = st.orders.find((x) => x.id === id);
    if (!o) throw new Error("Commande introuvable");
    Object.assign(o, patch, { updated_at: now() });
    persist();
    return clone(o);
  },
};
