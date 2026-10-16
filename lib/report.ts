import "server-only";
// Rapport quotidien, calculé à partir de vos données : aucune IA payante.
// Il couvre la veille (hier), compare aux 7 jours précédents, liste les choses à faire,
// signale les alertes et propose des idées d'amélioration concrètes.
import { db } from "./db";
import { dayKeyOf } from "./dates";
import { isCounted } from "./stats";
import { aiSessions, sumDays } from "./analytics";
import { moneyRound } from "./format";
import type { Order, Report, ReportTodo } from "./types";

const DAY = 86_400_000;

function profit(orders: Order[]) {
  let p = 0;
  for (const o of orders) {
    if (!isCounted(o)) continue;
    const cost = o.items.reduce((s, i) => s + (i.unit_cost_cents ?? 0) * i.quantity, 0);
    p += o.total_cents - cost - Math.round(o.total_cents * 0.015 + 25);
  }
  return p;
}
const pct = (cur: number, avg: number) => (avg > 0 ? (cur - avg) / avg : null);
const fmtPct = (v: number | null) => (v === null ? "" : `${v >= 0 ? "+" : "−"}${Math.round(Math.abs(v) * 100)} %`);

export async function buildDailyReport(now = Date.now()): Promise<Omit<Report, "id" | "created_at">> {
  const day = dayKeyOf(now - DAY);
  const weekKeys = Array.from({ length: 7 }, (_, i) => dayKeyOf(now - (i + 2) * DAY));
  const since = new Date(now - 10 * DAY).toISOString();

  const [sites, orders, analytics, products, guides, runs, opportunities, paid] = await Promise.all([
    db.listSites(),
    db.listOrders({ since }),
    db.analyticsDays({ since: weekKeys[6], until: day }),
    db.listProducts(),
    db.listGuides(),
    db.listRuns(60),
    db.listOpportunities({ status: "nouvelle", limit: 50 }),
    db.listOrders({ status: "paid" }),
  ]);
  const ofDay = (k: string) => orders.filter((o) => dayKeyOf(o.created_at) === k && isCounted(o));
  const y = ofDay(day);
  const revenue = y.reduce((s, o) => s + o.total_cents, 0);
  const weekAvgRevenue = weekKeys.reduce((s, k) => s + ofDay(k).reduce((x, o) => x + o.total_cents, 0), 0) / 7;

  const siteRows = sites
    .filter((s) => s.active)
    .map((s) => {
      const so = y.filter((o) => o.site_id === s.id);
      const rev = so.reduce((x, o) => x + o.total_cents, 0);
      const avg = weekKeys.reduce((x, k) => x + ofDay(k).filter((o) => o.site_id === s.id).reduce((z, o) => z + o.total_cents, 0), 0) / 7;
      const sess = analytics.filter((a) => a.site_id === s.id && a.day === day).reduce((x, a) => x + a.sessions, 0);
      return { site_id: s.id, name: s.name, revenue_cents: rev, orders: so.length, sessions: sess, trend: pct(rev, avg) };
    })
    .sort((a, b) => b.revenue_cents - a.revenue_cents);

  // ---------- À faire ----------
  const todos: ReportTodo[] = [];
  const approval = paid.filter((o) => o.supplier_status === "approbation");
  const errors = paid.filter((o) => o.supplier_status === "erreur" || o.supplier_status === "manuel");
  if (approval.length) todos.push({ level: "urgent", label: `${approval.length} commande(s) au-dessus du seuil : approuver l'envoi au fournisseur`, href: "/admin/commandes?onglet=a-transmettre" });
  if (errors.length) todos.push({ level: "urgent", label: `${errors.length} commande(s) à transmettre à la main (voir le motif)`, href: "/admin/commandes?onglet=a-transmettre" });
  const noPhoto = products.filter((p) => p.active && (!p.images.length || p.images.every((i) => i.startsWith("/demo/"))));
  if (noPhoto.length) todos.push({ level: "normal", label: `Ajouter de vraies photos à ${noPhoto.length} produit(s)`, href: "/admin/boutiques" });
  const noCost = products.filter((p) => p.active && p.cost_cents == null);
  if (noCost.length) todos.push({ level: "normal", label: `Renseigner le prix d'achat de ${noCost.length} produit(s) (bénéfice faussé sinon)`, href: "/admin/boutiques" });
  const noVid = products.filter((p) => p.active && !p.supplier_variant_id);
  if (noVid.length && process.env.CJ_API_KEY)
    todos.push({ level: "normal", label: `Ajouter l'identifiant CJ de ${noVid.length} produit(s) pour l'envoi automatique`, href: "/admin/boutiques" });
  const lowStock = products.filter((p) => p.active && p.stock !== null && p.stock <= 5);
  if (lowStock.length) todos.push({ level: "normal", label: `${lowStock.length} produit(s) en stock faible`, href: "/admin/produits?onglet=stock-faible" });
  if (opportunities.length) todos.push({ level: "info", label: `${opportunities.length} idée(s) de la veille à trier`, href: "/admin/veille" });
  const incomplete = sites.filter((s) => s.active && (!s.legal.siret || /^0{3}/.test(s.legal.siret.replace(/\s/g, "")) || !s.legal.mediator));
  if (incomplete.length) todos.push({ level: "normal", label: `Compléter les informations légales de ${incomplete.map((s) => s.name).join(", ")}`, href: "/admin/boutiques" });

  // ---------- Alertes ----------
  const alerts: string[] = [];
  for (const s of sites.filter((x) => x.active)) {
    const cur = analytics.filter((a) => a.site_id === s.id && a.day === day).reduce((x, a) => x + a.sessions, 0);
    const avg = analytics.filter((a) => a.site_id === s.id && weekKeys.includes(a.day)).reduce((x, a) => x + a.sessions, 0) / 7;
    if (avg >= 20 && cur < avg * 0.6) alerts.push(`${s.name} : visites en baisse de ${Math.round((1 - cur / avg) * 100)} % hier par rapport à la semaine.`);
    const sOrders = weekKeys.flatMap((k) => ofDay(k).filter((o) => o.site_id === s.id)).length;
    if (sOrders >= 7 && !y.some((o) => o.site_id === s.id)) alerts.push(`${s.name} : aucune vente hier alors qu'elle en fait d'habitude. Vérifiez que le paiement fonctionne.`);
  }
  const refunds = orders.filter((o) => o.status === "refunded" && dayKeyOf(o.updated_at) === day);
  if (refunds.length >= 2) alerts.push(`${refunds.length} remboursements hier : regardez s'il y a un problème de produit ou de délai.`);
  const failed = runs.filter((r) => r.status === "echec" && dayKeyOf(r.created_at) === day);
  if (failed.length) alerts.push(`${failed.length} tâche(s) d'agent en échec hier : voir la page Agents.`);

  // ---------- Activité des agents ----------
  const agents = runs
    .filter((r) => dayKeyOf(r.created_at) === day || dayKeyOf(r.created_at) === dayKeyOf(now))
    .filter((r) => r.status === "termine")
    .slice(0, 6)
    .map((r) => `${r.title}${r.result && typeof r.result === "object" ? ` : ${summarize(r.result)}` : ""}`);

  // ---------- Idées d'amélioration (règles simples, chiffrées) ----------
  const ideas: string[] = [];
  const week = sumDays(analytics.filter((a) => weekKeys.includes(a.day) || a.day === day));
  const weekOrders = [day, ...weekKeys].flatMap(ofDay);
  const conv = week.sessions ? weekOrders.length / week.sessions : 0;
  if (week.sessions > 200 && conv < 0.012)
    ideas.push(`Conversion de ${(conv * 100).toFixed(1)} % sur 8 jours : testez la livraison offerte plus tôt, de vraies photos et un prix d'appel plus bas.`);
  if (week.add_to_cart > 0 && week.checkouts / week.add_to_cart < 0.4)
    ideas.push(`Seulement ${Math.round((week.checkouts / week.add_to_cart) * 100)} % des paniers vont jusqu'au paiement : affichez les frais de port dès la fiche produit.`);
  const aov = weekOrders.length ? weekOrders.reduce((s, o) => s + o.total_cents, 0) / weekOrders.length : 0;
  const nearFree = sites.find((s) => s.shipping.free_from_cents > 0 && aov > 0 && s.shipping.free_from_cents - aov > 1500);
  if (nearFree)
    ideas.push(`Panier moyen ${moneyRound(aov)} pour une livraison offerte à ${moneyRound(nearFree.shipping.free_from_cents)} chez ${nearFree.name} : un lot de 2 juste au-dessus du seuil ferait monter le panier.`);
  const ai = aiSessions(week.sources);
  if (week.sessions > 0 && ai / week.sessions > 0.05)
    ideas.push(`${Math.round((ai / week.sessions) * 100)} % des visites viennent des assistants IA : continuez les guides avec des réponses courtes et chiffrées, c'est ce qu'ils citent.`);
  const fewGuides = sites.filter((s) => s.active && guides.filter((g) => g.site_id === s.id && g.published).length < 3);
  if (fewGuides.length) ideas.push(`${fewGuides.map((s) => s.name).join(", ")} : moins de 3 guides publiés. Chaque guide est une porte d'entrée depuis Google.`);
  const best = siteRows[0];
  if (best && best.revenue_cents > 0 && siteRows.length > 1 && best.revenue_cents > revenue * 0.6)
    ideas.push(`${best.name} fait ${Math.round((best.revenue_cents / Math.max(revenue, 1)) * 100)} % du CA d'hier : c'est la boutique où concentrer vos efforts (contenu, produits complémentaires).`);
  const topOpp = opportunities.sort((a, b) => b.score - a.score)[0];
  if (topOpp && topOpp.score >= 75) ideas.push(`Meilleure idée de la veille : « ${topOpp.product} » (${topOpp.score}/100).`);

  const trend = pct(revenue, weekAvgRevenue);
  const dateLabel = new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return {
    day,
    headline: `${cap(dateLabel)} : ${moneyRound(revenue)} de CA, ${y.length} commande${y.length > 1 ? "s" : ""}${trend !== null ? ` (${fmtPct(trend)} par rapport à la moyenne de la semaine)` : ""}`,
    revenue_cents: revenue,
    profit_cents: profit(y),
    orders: y.length,
    sites: siteRows,
    todos,
    alerts,
    agents,
    ideas: ideas.slice(0, 5),
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function summarize(r: Record<string, unknown>) {
  if ("error" in r) return "échec";
  return Object.entries(r)
    .filter(([, v]) => typeof v === "number" || typeof v === "string")
    .slice(0, 3)
    .map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`)
    .join(", ");
}

/** Version texte (e-mail, Telegram). */
export function reportText(r: Omit<Report, "id" | "created_at">) {
  const lines = [r.headline, `Bénéfice estimé : ${moneyRound(r.profit_cents)}`, ""];
  if (r.sites.length) {
    lines.push("Par boutique");
    for (const s of r.sites) lines.push(`  ${s.name} : ${moneyRound(s.revenue_cents)}, ${s.orders} cmd, ${s.sessions} visites${s.trend !== null ? ` (${fmtPct(s.trend)})` : ""}`);
    lines.push("");
  }
  if (r.todos.length) {
    lines.push(`À faire (${r.todos.length})`);
    r.todos.forEach((t, i) => lines.push(`  ${i + 1}. ${t.label}`));
    lines.push("");
  }
  if (r.alerts.length) lines.push("Alertes", ...r.alerts.map((a) => `  ${a}`), "");
  if (r.ideas.length) lines.push("Idées", ...r.ideas.map((a) => `  ${a}`), "");
  if (r.agents.length) lines.push("Les agents", ...r.agents.map((a) => `  ${a}`));
  return lines.join("\n");
}
