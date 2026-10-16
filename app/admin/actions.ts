"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { parseEuros, slugify } from "@/lib/format";
import { getStripe } from "@/lib/stripe";
import { sendShippingNotice } from "@/lib/email";
import { pingIndexNow } from "@/lib/indexnow";
import { siteUrl } from "@/lib/sites";
import type { OrderStatus, QA, Site, Spec } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const lines = (v: string) =>
  v
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/** "Libellé : valeur" par ligne */
const parseSpecs = (v: string): Spec[] =>
  lines(v).map((l) => {
    const i = l.indexOf(":");
    return i > 0 ? { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() } : { label: l, value: "" };
  });

/** Blocs séparés par une ligne vide : 1re ligne = question, le reste = réponse */
const parseFaq = (v: string): QA[] =>
  v
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((b) => b.trim().split("\n"))
    .filter((b) => b[0])
    .map(([q, ...a]) => ({ q: q.trim(), a: a.join(" ").trim() }));

function refresh() {
  revalidatePath("/", "layout");
}

// ---------- Produits ----------
export async function saveProduct(f: FormData) {
  await requireAdmin();
  const id = str(f, "id");
  const title = str(f, "title");
  const siteId = str(f, "site_id");
  if (!title || !siteId) throw new Error("Le titre et la boutique sont obligatoires.");
  const stockRaw = str(f, "stock");
  const saved = await db.saveProduct({
    ...(id ? { id } : {}),
    site_id: siteId,
    title,
    slug: slugify(str(f, "slug") || title),
    subtitle: str(f, "subtitle"),
    description: String(f.get("description") ?? ""),
    highlights: lines(str(f, "highlights")),
    specs: parseSpecs(str(f, "specs")),
    faq: parseFaq(String(f.get("faq") ?? "")),
    category: str(f, "category"),
    price_cents: parseEuros(f.get("price")) ?? 0,
    compare_at_cents: parseEuros(f.get("compare_at")),
    cost_cents: parseEuros(f.get("cost")),
    stock: stockRaw === "" ? null : Math.max(0, Math.floor(Number(stockRaw))),
    images: lines(str(f, "images")),
    sku: str(f, "sku"),
    gtin: str(f, "gtin"),
    brand: str(f, "brand"),
    supplier: str(f, "supplier"),
    supplier_url: str(f, "supplier_url"),
    seo_title: str(f, "seo_title"),
    seo_description: str(f, "seo_description"),
    active: f.get("active") === "on",
    position: Number(str(f, "position")) || 0,
  });
  refresh();
  const site = await db.getSite(saved.site_id);
  if (site && saved.active) await pingIndexNow(site, [siteUrl(site, `/produits/${saved.slug}`)]).catch(() => {});
  redirect(`/admin/produits/${saved.id}?ok=1`);
}

export async function deleteProduct(f: FormData) {
  await requireAdmin();
  await db.deleteProduct(str(f, "id"));
  refresh();
  redirect("/admin/produits");
}

// ---------- Guides ----------
export async function saveGuide(f: FormData) {
  await requireAdmin();
  const id = str(f, "id");
  const title = str(f, "title");
  const siteId = str(f, "site_id");
  if (!title || !siteId) throw new Error("Le titre et la boutique sont obligatoires.");
  const saved = await db.saveGuide({
    ...(id ? { id } : {}),
    site_id: siteId,
    title,
    slug: slugify(str(f, "slug") || title),
    excerpt: str(f, "excerpt"),
    body: String(f.get("body") ?? ""),
    product_ids: f.getAll("product_ids").map(String),
    seo_title: str(f, "seo_title"),
    seo_description: str(f, "seo_description"),
    published: f.get("published") === "on",
  });
  refresh();
  const site = await db.getSite(saved.site_id);
  if (site && saved.published) await pingIndexNow(site, [siteUrl(site, `/guides/${saved.slug}`)]).catch(() => {});
  redirect(`/admin/guides/${saved.id}?ok=1`);
}

export async function deleteGuide(f: FormData) {
  await requireAdmin();
  await db.deleteGuide(str(f, "id"));
  refresh();
  redirect("/admin/guides");
}

// ---------- Boutiques ----------
export async function saveSite(f: FormData) {
  await requireAdmin();
  const isNew = f.get("is_new") === "1";
  const id = slugify(str(f, "id")).replace(/-/g, "");
  if (!id) throw new Error("L'identifiant est obligatoire.");
  const existing = await db.getSite(id);
  if (isNew && existing) throw new Error(`Une boutique « ${id} » existe déjà.`);
  const site: Site = {
    id,
    name: str(f, "name"),
    domain: str(f, "domain").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""),
    tagline: str(f, "tagline"),
    description: str(f, "description"),
    hero_title: str(f, "hero_title"),
    hero_text: str(f, "hero_text"),
    hero_product_id: str(f, "hero_product_id") || null,
    theme: {
      background: str(f, "bg") || "#f5f5f2",
      ink: str(f, "ink") || "#1c1f24",
      primary: str(f, "primary") || "#2d5a43",
      accent: str(f, "accent") || "#b8901f",
      font: str(f, "font") === "grotesk" ? "grotesk" : "serif",
    },
    legal: {
      company: str(f, "company"),
      siret: str(f, "siret"),
      address: str(f, "address"),
      email: str(f, "email"),
      phone: str(f, "phone"),
      vat: str(f, "vat"),
      host: str(f, "host"),
      mediator: str(f, "mediator"),
    },
    shipping: {
      flat_cents: parseEuros(f.get("flat")) ?? 0,
      free_from_cents: parseEuros(f.get("free_from")) ?? 0,
      delay: str(f, "delay"),
      countries: str(f, "countries")
        .toUpperCase()
        .split(/[^A-Z]+/)
        .filter((c) => c.length === 2),
    },
    return_days: Math.max(14, Number(str(f, "return_days")) || 14),
    faq: parseFaq(String(f.get("faq") ?? "")),
    active: f.get("active") === "on",
    created_at: existing?.created_at ?? new Date().toISOString(),
  };
  await db.saveSite(site);
  refresh();
  redirect(`/admin/boutiques/${site.id}?ok=1`);
}

// ---------- Commandes ----------
export async function updateOrder(f: FormData) {
  await requireAdmin();
  const id = str(f, "id");
  const before = await db.getOrder(id);
  if (!before) throw new Error("Commande introuvable.");
  const status = str(f, "status") as OrderStatus;
  const order = await db.updateOrder(id, {
    status,
    tracking_number: str(f, "tracking_number"),
    tracking_url: str(f, "tracking_url"),
    notes: str(f, "notes"),
  });
  if (status === "shipped" && before.status !== "shipped" && order.tracking_number && f.get("notify") === "on") {
    const site = await db.getSite(order.site_id);
    if (site) await sendShippingNotice(site, order);
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/commandes/${id}?ok=1`);
}

export async function refundOrder(f: FormData) {
  await requireAdmin();
  const id = str(f, "id");
  const order = await db.getOrder(id);
  if (!order || order.status === "refunded") redirect(`/admin/commandes/${id}`);
  const stripe = getStripe();
  if (order.stripe_payment_intent && stripe) {
    await stripe.refunds.create({ payment_intent: order.stripe_payment_intent });
  }
  // Le webhook "charge.refunded" voit ensuite que la commande est déjà remboursée et ne refait rien.
  await db.updateOrder(id, { status: "refunded" });
  for (const i of order.items) await db.adjustStock(i.product_id, i.quantity);
  refresh();
  redirect(`/admin/commandes/${id}?ok=rembourse`);
}
