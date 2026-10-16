// Base de données réelle : Supabase (Postgres). Utilisée dès que
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont définies.
// La clé "service role" reste côté serveur : elle n'est jamais envoyée au navigateur.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AgentRun, AnalyticsDay, Guide, NewOrder, Opportunity, Order, Product, Report, Site, TrackInput } from "../types";
import type { Db } from "./types";

let client: SupabaseClient | null = null;
function sb() {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase : ${res.error.message}`);
  return res.data;
}

const now = () => new Date().toISOString();

export const supabaseDb: Db = {
  kind: "supabase",

  async listSites() {
    return check(await sb().from("sites").select("*").order("created_at")) as Site[];
  },
  async getSite(id) {
    return check(await sb().from("sites").select("*").eq("id", id).maybeSingle()) as Site | null;
  },
  async saveSite(site) {
    return check(await sb().from("sites").upsert(site).select().single()) as Site;
  },

  async listProducts(opts = {}) {
    let q = sb().from("products").select("*").order("position").order("created_at");
    if (opts.siteId) q = q.eq("site_id", opts.siteId);
    if (opts.activeOnly) q = q.eq("active", true);
    return check(await q) as Product[];
  },
  async getProduct(id) {
    return check(await sb().from("products").select("*").eq("id", id).maybeSingle()) as Product | null;
  },
  async getProductBySlug(siteId, slug) {
    return check(await sb().from("products").select("*").eq("site_id", siteId).eq("slug", slug).maybeSingle()) as Product | null;
  },
  async saveProduct(p) {
    const row = { ...p, updated_at: now() };
    if (!row.id) delete row.id;
    return check(await sb().from("products").upsert(row).select().single()) as Product;
  },
  async deleteProduct(id) {
    check(await sb().from("products").delete().eq("id", id));
  },
  async adjustStock(productId, delta) {
    // fonction SQL atomique définie dans supabase/schema.sql
    check(await sb().rpc("adjust_stock", { p_id: productId, p_delta: delta }));
  },

  async listGuides(opts = {}) {
    let q = sb().from("guides").select("*").order("published_at", { ascending: false });
    if (opts.siteId) q = q.eq("site_id", opts.siteId);
    if (opts.publishedOnly) q = q.eq("published", true);
    return check(await q) as Guide[];
  },
  async getGuide(id) {
    return check(await sb().from("guides").select("*").eq("id", id).maybeSingle()) as Guide | null;
  },
  async getGuideBySlug(siteId, slug) {
    return check(await sb().from("guides").select("*").eq("site_id", siteId).eq("slug", slug).maybeSingle()) as Guide | null;
  },
  async saveGuide(gd) {
    const row = { ...gd, updated_at: now() };
    if (!row.id) delete row.id;
    return check(await sb().from("guides").upsert(row).select().single()) as Guide;
  },
  async deleteGuide(id) {
    check(await sb().from("guides").delete().eq("id", id));
  },

  async listOrders(f = {}) {
    // Supabase renvoie 1 000 lignes max par requête : on pagine.
    const page = 1000;
    const out: Order[] = [];
    for (let from = 0; ; from += page) {
      let q = sb().from("orders").select("*").order("created_at", { ascending: false }).range(from, from + page - 1);
      if (f.siteId) q = q.eq("site_id", f.siteId);
      if (f.since) q = q.gte("created_at", f.since);
      if (f.until) q = q.lt("created_at", f.until);
      if (f.status) q = q.eq("status", f.status);
      if (f.search) {
        const s = f.search.replace(/^#/, "").replace(/[,()%]/g, " ").trim();
        q = /^\d+$/.test(s) ? q.eq("number", Number(s)) : q.or(`email.ilike.%${s}%,name.ilike.%${s}%`);
      }
      const rows = check(await q) as Order[];
      out.push(...rows);
      if (rows.length < page || (f.limit && out.length >= f.limit)) break;
    }
    return f.limit ? out.slice(0, f.limit) : out;
  },
  async getOrder(id) {
    return check(await sb().from("orders").select("*").eq("id", id).maybeSingle()) as Order | null;
  },
  async getOrderBySession(sessionId) {
    return check(await sb().from("orders").select("*").eq("stripe_session_id", sessionId).maybeSingle()) as Order | null;
  },
  async createOrder(o: NewOrder) {
    return check(await sb().from("orders").insert(o).select().single()) as Order;
  },
  async listOpportunities(opts = {}) {
    let q = sb().from("opportunities").select("*").order("created_at", { ascending: false }).order("score", { ascending: false });
    if (opts.status) q = q.eq("status", opts.status);
    q = q.limit(opts.limit ?? 300);
    return check(await q) as Opportunity[];
  },
  async getOpportunity(id) {
    return check(await sb().from("opportunities").select("*").eq("id", id).maybeSingle()) as Opportunity | null;
  },
  async addOpportunities(rows) {
    if (rows.length) check(await sb().from("opportunities").insert(rows));
  },
  async updateOpportunity(id, patch) {
    check(await sb().from("opportunities").update(patch).eq("id", id));
  },
  async createRun(r) {
    return check(await sb().from("agent_runs").insert({ ...r, status: "en_cours", log: [] }).select().single()) as AgentRun;
  },
  async updateRun(id, patch) {
    check(await sb().from("agent_runs").update(patch).eq("id", id));
  },
  async getRun(id) {
    return check(await sb().from("agent_runs").select("*").eq("id", id).maybeSingle()) as AgentRun | null;
  },
  async listRuns(limit = 30) {
    return check(await sb().from("agent_runs").select("*").order("created_at", { ascending: false }).limit(limit)) as AgentRun[];
  },
  async trackEvent(e: TrackInput) {
    // fonction SQL atomique (supabase/schema.sql)
    check(
      await sb().rpc("track_event", {
        p_site: e.site_id,
        p_day: e.day,
        p_type: e.type,
        p_path: e.path,
        p_source: e.source,
        p_device: e.device,
        p_country: e.country,
        p_hash: e.visitor,
        p_entry: e.entry,
      }),
    );
  },
  async analyticsDays({ siteId, since, until }) {
    let q = sb().from("analytics_daily").select("*").gte("day", since).lte("day", until).order("day").limit(10000);
    if (siteId) q = q.eq("site_id", siteId);
    return check(await q) as AnalyticsDay[];
  },
  async saveReport(r) {
    return check(await sb().from("reports").upsert(r, { onConflict: "day" }).select().single()) as Report;
  },
  async listReports(limit = 30) {
    return check(await sb().from("reports").select("*").order("day", { ascending: false }).limit(limit)) as Report[];
  },
  async getSetting<T>(key: string) {
    const row = check(await sb().from("settings").select("value").eq("key", key).maybeSingle()) as { value: T } | null;
    return row?.value ?? null;
  },
  async setSetting(key, value) {
    check(await sb().from("settings").upsert({ key, value, updated_at: new Date().toISOString() }));
  },
  async updateOrder(id, patch) {
    const { id: _ignore, number: _n, ...rest } = patch;
    return check(await sb().from("orders").update({ ...rest, updated_at: now() }).eq("id", id).select().single()) as Order;
  },
};
