import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { siteFromHost, siteUrl } from "@/lib/sites";
import { getStripe } from "@/lib/stripe";
import { priceCart, recordPaidOrder, toOrderItems, type CartLine } from "@/lib/orders";

function origin(req: NextRequest) {
  const host = req.headers.get("host") ?? "localhost:3000";
  const local = /(^|\.)localhost(:\d+)?$|^127\.0\.0\.1/.test(host);
  const proto = req.headers.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  const site = await siteFromHost(req.headers.get("host") ?? "");
  if (!site) return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });

  let lines: CartLine[];
  try {
    const body = await req.json();
    lines = Array.isArray(body?.items) ? body.items.slice(0, 50) : [];
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  let cart;
  try {
    cart = await priceCart(site, lines);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
  if (!cart.items.length) return NextResponse.json({ error: "Votre panier est vide." }, { status: 400 });

  const base = origin(req);
  const stripe = getStripe();

  // Pas de Stripe : en mode démo on simule un paiement réussi pour tester l'admin.
  if (!stripe) {
    if (db.kind !== "demo")
      return NextResponse.json({ error: "Le paiement n'est pas encore configuré (STRIPE_SECRET_KEY manquante)." }, { status: 503 });
    const order = await recordPaidOrder(site, {
      items: toOrderItems(cart.items),
      email: "client.demo@exemple.fr",
      name: "Client Démo",
      address: { line1: "1 rue de la Démo", postal_code: "75001", city: "Paris", country: "FR" },
      subtotal: cart.subtotal,
      shipping: cart.shipping,
      total: cart.total,
      sessionId: null,
      paymentIntent: null,
      mode: "demo",
    });
    return NextResponse.json({ url: `${base}/merci?commande=${order.number}` });
  }

  const nums = (site.shipping.delay.match(/\d+/g) ?? ["3", "7"]).map(Number);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    locale: "fr",
    line_items: cart.items.map(({ product: p, qty }) => ({
      quantity: qty,
      price_data: {
        currency: "eur",
        unit_amount: p.price_cents,
        product_data: {
          name: p.title,
          // Stripe n'accepte que des images publiques en https
          images: p.images.map((i) => (i.startsWith("/") ? siteUrl(site, i) : i)).filter((i) => i.startsWith("https://") && !i.endsWith(".svg")).slice(0, 1),
          metadata: { product_id: p.id, site_id: site.id },
        },
      },
    })),
    shipping_address_collection: { allowed_countries: site.shipping.countries as never },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: cart.shipping ? "Livraison standard" : "Livraison offerte",
          fixed_amount: { amount: cart.shipping, currency: "eur" },
          delivery_estimate: {
            minimum: { unit: "business_day", value: nums[0] },
            maximum: { unit: "business_day", value: nums[nums.length - 1] },
          },
        },
      },
    ],
    phone_number_collection: { enabled: true },
    metadata: { site_id: site.id },
    payment_intent_data: { metadata: { site_id: site.id } },
    custom_text: {
      submit: { message: `En validant, vous acceptez les conditions générales de vente de ${site.name} (${siteUrl(site, "/cgv")}).` },
    },
    success_url: `${base}/merci?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/panier`,
  });

  return NextResponse.json({ url: session.url });
}
