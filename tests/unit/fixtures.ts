// Données de test : une commande, un produit, une boutique, avec des valeurs par défaut réalistes.
import type { Order, OrderItem, Product, Site } from "@/lib/types";

let n = 1000;

export function item(p: Partial<OrderItem> = {}): OrderItem {
  return { product_id: "p1", title: "Bocal 1 L", slug: "bocal-1l", quantity: 1, unit_price_cents: 2000, unit_cost_cents: 600, supplier_url: "", ...p };
}

export function order(p: Partial<Order> = {}): Order {
  n += 1;
  const items = p.items ?? [item()];
  const subtotal = items.reduce((s, i) => s + i.unit_price_cents * i.quantity, 0);
  return {
    id: `o${n}`,
    number: n,
    site_id: "bocal",
    stripe_session_id: null,
    stripe_payment_intent: null,
    email: "client@exemple.fr",
    name: "Client Test",
    phone: "",
    shipping_address: { line1: "1 rue Test", postal_code: "75001", city: "Paris", country: "FR" },
    items,
    subtotal_cents: subtotal,
    shipping_cents: 0,
    total_cents: subtotal,
    currency: "eur",
    status: "paid",
    tracking_number: "",
    tracking_url: "",
    notes: "",
    mode: "test",
    created_at: "2026-10-15T10:00:00.000Z",
    updated_at: "2026-10-15T10:00:00.000Z",
    ...p,
  };
}

export function product(p: Partial<Product> = {}): Product {
  return {
    id: "p1",
    site_id: "bocal",
    slug: "bocal-1l",
    title: "Bocal 1 L",
    subtitle: "",
    description: "",
    highlights: [],
    specs: [],
    faq: [],
    category: "",
    price_cents: 2000,
    compare_at_cents: null,
    cost_cents: 600,
    stock: null,
    images: ["https://cdn.exemple.fr/bocal.jpg"],
    sku: "",
    gtin: "",
    brand: "",
    supplier: "CJ",
    supplier_url: "",
    supplier_variant_id: "vid-1",
    supplier_country: "CN",
    seo_title: "",
    seo_description: "",
    active: true,
    position: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...p,
  };
}

export function site(p: Partial<Site> = {}): Site {
  return {
    id: "bocal",
    name: "Bocal & Cie",
    domain: "bocal-et-cie.fr",
    tagline: "",
    description: "",
    hero_title: "",
    hero_text: "",
    hero_product_id: null,
    theme: { background: "#fff", ink: "#111", primary: "#264", accent: "#c50", font: "serif" },
    legal: { company: "Test SAS", siret: "123 456 789 00012", address: "Paris", email: "contact@exemple.fr", host: "Vercel", mediator: "CM2C" },
    shipping: { flat_cents: 490, free_from_cents: 4900, delay: "3 à 5 jours ouvrés", countries: ["FR", "BE"] },
    return_days: 14,
    faq: [],
    active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    ...p,
  };
}
