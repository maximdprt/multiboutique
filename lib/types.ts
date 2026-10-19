// Types partagés. Les noms de champs suivent les colonnes de la base Supabase (snake_case).

export type QA = { q: string; a: string };
export type Spec = { label: string; value: string };

export type SiteTheme = {
  /** Fond de page */
  background: string;
  /** Couleur du texte */
  ink: string;
  /** Couleur principale (boutons, liens) */
  primary: string;
  /** Couleur secondaire (prix barrés, badges) */
  accent: string;
  /** Police des titres */
  font: "serif" | "grotesk";
};

export type SiteLegal = {
  company: string; // raison sociale ou nom + prénom (micro-entreprise)
  siret: string;
  address: string;
  email: string;
  phone?: string;
  vat?: string; // n° de TVA intracommunautaire, si assujetti
  host: string; // hébergeur (obligatoire dans les mentions légales)
  mediator?: string; // médiateur de la consommation (obligatoire pour vendre aux particuliers)
};

export type SiteShipping = {
  flat_cents: number; // frais de port
  free_from_cents: number; // livraison offerte à partir de (0 = jamais)
  delay: string; // ex. "5 à 8 jours ouvrés"
  countries: string[]; // codes ISO acceptés au paiement
};

export type Site = {
  id: string; // identifiant court, ex. "cuisine"
  name: string;
  domain: string; // ex. "atelier-cuisine.fr" (sans https ni www)
  tagline: string;
  description: string; // description longue, utilisée pour le SEO et llms.txt
  hero_title: string;
  hero_text: string;
  hero_product_id: string | null;
  theme: SiteTheme;
  legal: SiteLegal;
  shipping: SiteShipping;
  return_days: number;
  faq: QA[];
  active: boolean;
  created_at: string;
};

export type Product = {
  id: string;
  site_id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string; // texte simple : paragraphes, "## titre", "- liste", **gras**
  highlights: string[];
  specs: Spec[];
  faq: QA[];
  category: string;
  price_cents: number;
  compare_at_cents: number | null;
  cost_cents: number | null; // prix d'achat fournisseur (pour la marge, jamais affiché)
  stock: number | null; // null = pas de suivi de stock (dropshipping)
  images: string[];
  sku: string;
  gtin: string;
  brand: string;
  supplier: string;
  supplier_url: string;
  /** Identifiant de variante chez le fournisseur (CJ : "vid") : nécessaire pour la commande automatique */
  supplier_variant_id?: string;
  /** Pays de l'entrepôt d'expédition (CN, FR, DE…) */
  supplier_country?: string;
  seo_title: string;
  seo_description: string;
  active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export type Guide = {
  id: string;
  site_id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  product_ids: string[];
  seo_title: string;
  seo_description: string;
  published: boolean;
  published_at: string;
  updated_at: string;
};

export type OrderStatus =
  | "paid"
  | "sent_to_supplier"
  | "shipped"
  | "delivered"
  | "refunded"
  | "cancelled";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  paid: "Payée",
  sent_to_supplier: "Transmise au fournisseur",
  shipped: "Expédiée",
  delivered: "Livrée",
  refunded: "Remboursée",
  cancelled: "Annulée",
};

export type OrderItem = {
  product_id: string;
  title: string;
  slug: string;
  quantity: number;
  unit_price_cents: number;
  unit_cost_cents: number | null;
  supplier_url: string;
  supplier?: string;
  supplier_variant_id?: string;
  supplier_country?: string;
};

export type Address = {
  line1: string;
  line2?: string;
  postal_code: string;
  city: string;
  country: string;
};

export type Order = {
  id: string;
  number: number;
  site_id: string;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  email: string;
  name: string;
  phone: string;
  shipping_address: Address | null;
  items: OrderItem[];
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  status: OrderStatus;
  tracking_number: string;
  tracking_url: string;
  notes: string;
  /** Commande passée chez le fournisseur */
  supplier_order_id?: string | null;
  /** auto = envoyée automatiquement ; approbation = au-dessus du seuil, attend votre clic ; erreur = voir supplier_note */
  supplier_status?: "" | "auto" | "approbation" | "erreur" | "manuel";
  supplier_note?: string;
  mode: "live" | "test" | "demo";
  created_at: string;
  updated_at: string;
};

export type NewOrder = Omit<Order, "id" | "number" | "created_at" | "updated_at"> & {
  created_at?: string;
};

// ---------- Agents ----------
export type Opportunity = {
  id: string;
  created_at: string;
  run_id: string | null;
  niche: string;
  product: string;
  summary: string;
  why_now: string;
  queries: string[]; // recherches Google visées (longue traîne)
  competition: "faible" | "moyenne" | "forte";
  price_range: string;
  margin_hint: string;
  score: number; // 0 à 100
  examples: { name: string; url: string; note: string }[]; // boutiques qui vendent déjà
  sources: string[];
  status: "nouvelle" | "retenue" | "ecartee" | "lancee";
  site_id: string | null;
};

export type AgentKind = "veille" | "construction" | "contenu" | "commandes" | "rapport" | "domaines";

export type AgentRun = {
  id: string;
  kind: AgentKind;
  status: "en_cours" | "termine" | "echec";
  title: string;
  log: string[];
  result: Record<string, unknown> | null;
  site_id: string | null;
  created_at: string;
  finished_at: string | null;
};

// ---------- Mesure d'audience (sans cookie) ----------
export type Counter = Record<string, number>;

export type AnalyticsDay = {
  site_id: string;
  day: string; // AAAA-MM-JJ
  pageviews: number;
  sessions: number;
  visitors: number;
  add_to_cart: number;
  checkouts: number;
  sources: Counter;
  devices: Counter;
  countries: Counter;
  pages: Counter;
};

export type TrackInput = {
  site_id: string;
  day: string;
  type: "pageview" | "add_to_cart" | "checkout";
  path: string;
  source: string;
  device: string;
  country: string;
  visitor: string;
  entry: boolean;
};

// ---------- Rapports ----------
export type ReportLine = { label: string; value: string; trend?: number | null; href?: string };
export type ReportTodo = { label: string; href: string; level: "urgent" | "normal" | "info" };
export type Report = {
  id: string;
  day: string; // jour couvert (hier)
  created_at: string;
  headline: string; // "Hier : 412 € de CA, 11 commandes"
  revenue_cents: number;
  profit_cents: number;
  orders: number;
  sites: { site_id: string; name: string; revenue_cents: number; orders: number; sessions: number; trend: number | null }[];
  todos: ReportTodo[];
  alerts: string[];
  agents: string[];
  ideas: string[];
};
