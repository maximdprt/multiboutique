// Stripe appelle cette adresse à chaque paiement ou remboursement.
// À déclarer dans Stripe > Développeurs > Webhooks : https://VOTRE-DOMAINE/api/stripe/webhook
// Événements : checkout.session.completed, checkout.session.async_payment_succeeded, charge.refunded
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { recordPaidOrder } from "@/lib/orders";
import type { Address, OrderItem } from "@/lib/types";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", secret);
  } catch (e) {
    return NextResponse.json({ error: `Signature invalide : ${(e as Error).message}` }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.payment_status === "paid") await handlePaidSession(stripe, s.id);
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      if (charge.refunded && typeof charge.payment_intent === "string") {
        const sessions = await stripe.checkout.sessions.list({ payment_intent: charge.payment_intent, limit: 1 });
        const order = sessions.data[0] && (await db.getOrderBySession(sessions.data[0].id));
        if (order && order.status !== "refunded") {
          await db.updateOrder(order.id, { status: "refunded" });
          for (const i of order.items) await db.adjustStock(i.product_id, i.quantity);
          revalidatePath("/", "layout");
        }
      }
    }
  } catch (e) {
    console.error("Webhook Stripe :", e);
    // 500 => Stripe réessaiera automatiquement plus tard
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handlePaidSession(stripe: Stripe, sessionId: string) {
  if (await db.getOrderBySession(sessionId)) return; // déjà enregistrée (Stripe peut envoyer deux fois)

  const s = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items.data.price.product"] });
  const site = await db.getSite(String(s.metadata?.site_id ?? ""));
  if (!site) throw new Error(`Boutique inconnue pour la session ${sessionId}`);

  const items: OrderItem[] = [];
  for (const li of s.line_items?.data ?? []) {
    const prod = li.price?.product as Stripe.Product | undefined;
    const productId = prod?.metadata?.product_id ?? "";
    const p = productId ? await db.getProduct(productId) : null;
    items.push({
      product_id: productId,
      title: p?.title ?? li.description ?? "Produit",
      slug: p?.slug ?? "",
      quantity: li.quantity ?? 1,
      unit_price_cents: li.price?.unit_amount ?? Math.round(li.amount_total / (li.quantity || 1)),
      unit_cost_cents: p?.cost_cents ?? null,
      supplier_url: p?.supplier_url ?? "",
    });
  }

  // Selon la version de l'API Stripe, l'adresse est à l'un de ces deux endroits.
  const anyS = s as unknown as {
    collected_information?: { shipping_details?: { name?: string; address?: Stripe.Address } };
    shipping_details?: { name?: string; address?: Stripe.Address };
  };
  const ship = anyS.collected_information?.shipping_details ?? anyS.shipping_details;
  const a = ship?.address;
  const address: Address | null = a
    ? { line1: a.line1 ?? "", line2: a.line2 ?? "", postal_code: a.postal_code ?? "", city: a.city ?? "", country: a.country ?? "" }
    : null;

  const subtotal = s.amount_subtotal ?? 0;
  const total = s.amount_total ?? subtotal;
  await recordPaidOrder(site, {
    items,
    email: s.customer_details?.email ?? "",
    name: ship?.name ?? s.customer_details?.name ?? "",
    phone: s.customer_details?.phone ?? "",
    address,
    subtotal,
    shipping: s.shipping_cost?.amount_total ?? total - subtotal,
    total,
    sessionId: s.id,
    paymentIntent: typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null),
    mode: s.livemode ? "live" : "test",
  });
}
