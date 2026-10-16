import type { AgentRun, AnalyticsDay, Guide, NewOrder, Opportunity, Order, OrderStatus, Product, Report, Site, TrackInput } from "../types";

export type OrderFilter = {
  siteId?: string;
  since?: string; // ISO
  until?: string; // ISO
  status?: OrderStatus;
  search?: string; // e-mail, nom ou numéro
  limit?: number;
};

/** Toutes les lectures/écritures passent par cette interface (Supabase ou mode démo). */
export interface Db {
  readonly kind: "supabase" | "demo";

  listSites(): Promise<Site[]>;
  getSite(id: string): Promise<Site | null>;
  saveSite(site: Site): Promise<Site>;

  listProducts(opts?: { siteId?: string; activeOnly?: boolean }): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  getProductBySlug(siteId: string, slug: string): Promise<Product | null>;
  saveProduct(p: Partial<Product> & { site_id: string }): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  adjustStock(productId: string, delta: number): Promise<void>;

  listGuides(opts?: { siteId?: string; publishedOnly?: boolean }): Promise<Guide[]>;
  getGuide(id: string): Promise<Guide | null>;
  getGuideBySlug(siteId: string, slug: string): Promise<Guide | null>;
  saveGuide(g: Partial<Guide> & { site_id: string }): Promise<Guide>;
  deleteGuide(id: string): Promise<void>;

  listOrders(filter?: OrderFilter): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  getOrderBySession(sessionId: string): Promise<Order | null>;
  createOrder(o: NewOrder): Promise<Order>;
  updateOrder(id: string, patch: Partial<Order>): Promise<Order>;

  listOpportunities(opts?: { status?: Opportunity["status"]; limit?: number }): Promise<Opportunity[]>;
  getOpportunity(id: string): Promise<Opportunity | null>;
  addOpportunities(rows: Omit<Opportunity, "id" | "created_at">[]): Promise<void>;
  updateOpportunity(id: string, patch: Partial<Opportunity>): Promise<void>;

  createRun(r: Pick<AgentRun, "kind" | "title" | "site_id">): Promise<AgentRun>;
  updateRun(id: string, patch: Partial<AgentRun>): Promise<void>;
  getRun(id: string): Promise<AgentRun | null>;
  listRuns(limit?: number): Promise<AgentRun[]>;

  trackEvent(e: TrackInput): Promise<void>;
  /** Jours compris entre since et until inclus (AAAA-MM-JJ). */
  analyticsDays(opts: { siteId?: string; since: string; until: string }): Promise<AnalyticsDay[]>;

  saveReport(r: Omit<Report, "id" | "created_at">): Promise<Report>;
  listReports(limit?: number): Promise<Report[]>;

  getSetting<T = unknown>(key: string): Promise<T | null>;
  setSetting(key: string, value: unknown): Promise<void>;
}
