import "server-only";
// Commandes fournisseur automatiques.
// À chaque commande payée : si tous les articles ont un identifiant de variante CJ et que le coût
// reste sous le seuil, la commande part seule chez CJ. Au-dessus du seuil, elle attend votre clic.
// Chaque jour, les numéros de suivi sont récupérés et envoyés aux clients.
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { hasCJ, createOrder, orderDetail } from "./suppliers/cj";
import { sendShippingNotice } from "./email";
import type { Order } from "./types";

const COUNTRY_NAMES: Record<string, string> = { FR: "France", BE: "Belgium", CH: "Switzerland", LU: "Luxembourg", DE: "Germany", ES: "Spain", IT: "Italy", NL: "Netherlands", CA: "Canada" };

export const autoFulfillEnabled = () => process.env.AUTO_FULFILL !== "false";
export const maxAutoCostCents = () => Number(process.env.AUTO_FULFILL_MAX_CENTS || 15000);

export type FulfillResult = { status: NonNullable<Order["supplier_status"]>; note: string };

/** Envoie la commande au fournisseur. `force` = envoi approuvé à la main (ignore le seuil). */
export async function fulfillOrder(orderId: string, force = false): Promise<FulfillResult> {
  const o = await db.getOrder(orderId);
  if (!o) return { status: "erreur", note: "Commande introuvable" };
  if (o.supplier_order_id) return { status: o.supplier_status || "auto", note: "Déjà transmise" };
  if (o.status !== "paid") return { status: "manuel", note: "Commande non payée ou déjà traitée" };

  const save = async (patch: Partial<Order>, r: FulfillResult) => {
    await db.updateOrder(o.id, { ...patch, supplier_status: r.status, supplier_note: r.note });
    revalidatePath("/admin", "layout");
    return r;
  };

  // Enrichit chaque ligne avec les infos fournisseur actuelles du produit
  const lines = await Promise.all(
    o.items.map(async (i) => {
      const p = i.product_id ? await db.getProduct(i.product_id) : null;
      return { ...i, vid: i.supplier_variant_id || p?.supplier_variant_id || "", from: i.supplier_country || p?.supplier_country || "CN", supplier: p?.supplier ?? "" };
    }),
  );
  const cost = lines.reduce((s, l) => s + (l.unit_cost_cents ?? 0) * l.quantity, 0);

  // Mode démo : on simule l'envoi pour voir le parcours
  if (!hasCJ()) {
    if (db.kind === "demo") {
      return save(
        { status: "sent_to_supplier", supplier_order_id: `DEMO-${o.number}` },
        { status: "auto", note: "Simulation (mode démo, pas de clé CJ)" },
      );
    }
    return save({}, { status: "manuel", note: "Clé CJ_API_KEY absente : à transmettre à la main" });
  }
  if (!autoFulfillEnabled() && !force) return save({}, { status: "manuel", note: "Envoi automatique désactivé" });

  const missing = lines.filter((l) => !l.vid);
  if (missing.length) return save({}, { status: "manuel", note: `Identifiant CJ manquant : ${missing.map((m) => m.title).join(", ")}` });
  if (!force && cost > maxAutoCostCents())
    return save({}, { status: "approbation", note: `Coût fournisseur ${(cost / 100).toFixed(2)} € au-dessus du seuil : à approuver` });
  const a = o.shipping_address;
  if (!a) return save({}, { status: "erreur", note: "Adresse de livraison manquante" });

  // Une commande CJ par entrepôt de départ
  const byOrigin = new Map<string, typeof lines>();
  for (const l of lines) byOrigin.set(l.from, [...(byOrigin.get(l.from) ?? []), l]);
  try {
    const ids: string[] = [];
    let i = 0;
    for (const [from, group] of byOrigin) {
      const r = await createOrder({
        orderNumber: byOrigin.size > 1 ? `${o.number}-${++i}` : String(o.number),
        from,
        payByBalance: process.env.CJ_PAY_MODE !== "manual",
        products: group.map((l) => ({ vid: l.vid, quantity: l.quantity })),
        address: {
          name: o.name,
          phone: o.phone,
          line1: a.line1,
          line2: a.line2,
          zip: a.postal_code,
          city: a.city,
          province: a.city,
          country: a.country,
          countryName: COUNTRY_NAMES[a.country] ?? a.country,
        },
      });
      ids.push(r.orderId);
    }
    return save(
      { status: "sent_to_supplier", supplier_order_id: ids.join(",") },
      { status: "auto", note: process.env.CJ_PAY_MODE === "manual" ? "Créée chez CJ, à payer dans votre compte CJ" : "Créée et payée chez CJ" },
    );
  } catch (e) {
    return save({}, { status: "erreur", note: (e as Error).message });
  }
}

/** Récupère les numéros de suivi chez CJ et prévient les clients. */
export async function syncTracking(log: (s: string) => void = () => {}) {
  const pending = await db.listOrders({ status: "sent_to_supplier" });
  let shipped = 0;
  let delivered = 0;
  for (const o of pending) {
    if (!o.supplier_order_id) continue;
    if (o.supplier_order_id.startsWith("DEMO-")) {
      // démo : expédiée après 2 jours
      if (Date.now() - Date.parse(o.created_at) > 2 * 86_400_000) {
        await db.updateOrder(o.id, { status: "shipped", tracking_number: `LP${o.number}FR` });
        shipped++;
      }
      continue;
    }
    if (!hasCJ()) continue;
    try {
      const firstId = o.supplier_order_id.split(",")[0];
      const d = await orderDetail(firstId);
      if (d.orderStatus === "SHIPPED" && d.trackNumber) {
        const updated = await db.updateOrder(o.id, { status: "shipped", tracking_number: d.trackNumber, tracking_url: d.trackingUrl ?? "" });
        const site = await db.getSite(o.site_id);
        if (site) await sendShippingNotice(site, updated).catch(() => {});
        shipped++;
        log(`Commande ${o.number} expédiée : ${d.trackNumber}`);
      } else if (d.orderStatus === "DELIVERED") {
        await db.updateOrder(o.id, { status: "delivered", tracking_number: d.trackNumber ?? o.tracking_number });
        delivered++;
      } else if (d.orderStatus === "CANCELLED") {
        await db.updateOrder(o.id, { supplier_status: "erreur", supplier_note: "Commande annulée chez CJ" });
        log(`Commande ${o.number} annulée chez CJ : à vérifier`);
      }
    } catch (e) {
      log(`Commande ${o.number} : ${(e as Error).message}`);
    }
  }
  revalidatePath("/admin", "layout");
  return { suivies: pending.length, expediees: shipped, livrees: delivered };
}
