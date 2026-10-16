import "server-only";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { fulfillOrder } from "./fulfillment";
import { db } from "./db";
import { sendOrderConfirmation } from "./email";
import type { Address, NewOrder, Order, OrderItem, Product, Site } from "./types";

export type CartLine = { id: string; qty: number };

/** Recalcule le panier côté serveur à partir des prix en base (on ne fait jamais confiance au navigateur). */
export async function priceCart(site: Site, lines: CartLine[]) {
  const items: { product: Product; qty: number }[] = [];
  for (const l of lines) {
    const qty = Math.max(1, Math.min(20, Math.floor(Number(l.qty) || 0)));
    const product = await db.getProduct(String(l.id));
    if (!product || product.site_id !== site.id || !product.active) continue;
    if (product.stock !== null && product.stock < qty) {
      throw new Error(product.stock === 0 ? `« ${product.title} » n'est plus en stock.` : `Il ne reste que ${product.stock} « ${product.title} ».`);
    }
    items.push({ product, qty });
  }
  const subtotal = items.reduce((s, i) => s + i.product.price_cents * i.qty, 0);
  const free = site.shipping.free_from_cents > 0 && subtotal >= site.shipping.free_from_cents;
  const shipping = items.length && !free ? site.shipping.flat_cents : 0;
  return { items, subtotal, shipping, total: subtotal + shipping };
}

export function toOrderItems(items: { product: Product; qty: number }[]): OrderItem[] {
  return items.map(({ product: p, qty }) => ({
    product_id: p.id,
    title: p.title,
    slug: p.slug,
    quantity: qty,
    unit_price_cents: p.price_cents,
    unit_cost_cents: p.cost_cents,
    supplier_url: p.supplier_url,
    supplier: p.supplier,
    supplier_variant_id: p.supplier_variant_id ?? "",
    supplier_country: p.supplier_country ?? "",
  }));
}

/** Enregistre une commande payée : création, mise à jour du stock, e-mail, rafraîchissement des pages. */
export async function recordPaidOrder(
  site: Site,
  data: {
    items: OrderItem[];
    email: string;
    name: string;
    phone?: string;
    address: Address | null;
    subtotal: number;
    shipping: number;
    total: number;
    sessionId: string | null;
    paymentIntent: string | null;
    mode: Order["mode"];
  },
): Promise<Order> {
  const order: NewOrder = {
    site_id: site.id,
    stripe_session_id: data.sessionId,
    stripe_payment_intent: data.paymentIntent,
    email: data.email,
    name: data.name,
    phone: data.phone ?? "",
    shipping_address: data.address,
    items: data.items,
    subtotal_cents: data.subtotal,
    shipping_cents: data.shipping,
    total_cents: data.total,
    currency: "eur",
    status: "paid",
    tracking_number: "",
    tracking_url: "",
    notes: "",
    mode: data.mode,
  };
  const created = await db.createOrder(order);
  for (const i of data.items) await db.adjustStock(i.product_id, -i.quantity);
  try {
    await sendOrderConfirmation(site, created);
  } catch (e) {
    console.error(e);
  }
  revalidatePath("/", "layout");
  // envoi automatique au fournisseur, après la réponse (le client n'attend pas)
  after(() => fulfillOrder(created.id).catch((e) => console.error("Envoi fournisseur :", e)));
  return created;
}
