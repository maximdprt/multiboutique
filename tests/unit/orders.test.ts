import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/types";
import { product, site } from "./fixtures";

const products = vi.hoisted(() => new Map<string, Product>());

vi.mock("@/lib/db", () => ({ db: { getProduct: async (id: string) => products.get(id) ?? null } }));
vi.mock("@/lib/fulfillment", () => ({ fulfillOrder: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendOrderConfirmation: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));

const { priceCart, toOrderItems } = await import("@/lib/orders");

// Livraison 4,90 €, offerte dès 49 €
const shop = site();

beforeEach(() => {
  products.clear();
  for (const p of [
    product({ id: "a", price_cents: 2000 }),
    product({ id: "b", price_cents: 3500 }),
    product({ id: "autre-boutique", site_id: "chat", price_cents: 100 }),
    product({ id: "inactif", active: false }),
    product({ id: "dernier", stock: 1 }),
    product({ id: "epuise", stock: 0, title: "Bocal épuisé" }),
  ])
    products.set(p.id, p);
});

describe("prix du panier (recalculé côté serveur)", () => {
  it("prend les prix en base et ajoute la livraison sous le seuil", async () => {
    const c = await priceCart(shop, [{ id: "a", qty: 2 }]);
    expect(c.subtotal).toBe(4000);
    expect(c.shipping).toBe(490);
    expect(c.total).toBe(4490);
  });

  it("offre la livraison à partir du seuil", async () => {
    const c = await priceCart(shop, [
      { id: "a", qty: 1 },
      { id: "b", qty: 1 },
    ]);
    expect(c.subtotal).toBe(5500);
    expect(c.shipping).toBe(0);
    expect(c.total).toBe(5500);
  });

  it("ne facture jamais de livraison pour un panier vide", async () => {
    const c = await priceCart(shop, []);
    expect(c).toMatchObject({ subtotal: 0, shipping: 0, total: 0 });
  });

  it("facture toujours la livraison si la boutique ne l'offre jamais", async () => {
    const c = await priceCart(site({ shipping: { ...shop.shipping, free_from_cents: 0 } }), [{ id: "b", qty: 10 }]);
    expect(c.shipping).toBe(490);
  });

  it("ignore les produits d'une autre boutique, inactifs ou inconnus", async () => {
    const c = await priceCart(shop, [
      { id: "autre-boutique", qty: 1 },
      { id: "inactif", qty: 1 },
      { id: "inconnu", qty: 1 },
    ]);
    expect(c.items).toHaveLength(0);
    expect(c.total).toBe(0);
  });

  it("borne les quantités entre 1 et 20", async () => {
    const c = await priceCart(shop, [
      { id: "a", qty: 500 },
      { id: "b", qty: -3 },
    ]);
    expect(c.items.map((i) => i.qty)).toEqual([20, 1]);
  });

  it("refuse une quantité supérieure au stock, avec un message clair", async () => {
    await expect(priceCart(shop, [{ id: "dernier", qty: 2 }])).rejects.toThrow("Il ne reste que 1 « Bocal 1 L ».");
    await expect(priceCart(shop, [{ id: "epuise", qty: 1 }])).rejects.toThrow("« Bocal épuisé » n'est plus en stock.");
  });

  it("garde le coût et l'identifiant fournisseur dans les lignes de commande", async () => {
    const c = await priceCart(shop, [{ id: "a", qty: 2 }]);
    expect(toOrderItems(c.items)[0]).toMatchObject({ product_id: "a", quantity: 2, unit_price_cents: 2000, unit_cost_cents: 600, supplier_variant_id: "vid-1" });
  });
});
