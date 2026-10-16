"use client";
// Panier stocké dans le navigateur (localStorage), un panier par boutique.
// Les prix affichés ici sont indicatifs : le serveur recalcule tout au moment du paiement.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = { id: string; slug: string; title: string; price_cents: number; image: string; qty: number; max: number | null };

type Ctx = {
  ready: boolean;
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const CartContext = createContext<Ctx | null>(null);

export function CartProvider({ siteId, children }: { siteId: string; children: ReactNode }) {
  const key = `panier:${siteId}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // stockage indisponible (navigation privée stricte) : panier en mémoire seulement
    }
    setReady(true);
  }, [key]);

  const save = useCallback(
    (next: CartItem[]) => {
      setItems(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
    },
    [key],
  );

  const value = useMemo<Ctx>(() => {
    const clamp = (q: number, max: number | null) => Math.max(1, Math.min(max ?? 20, 20, q));
    return {
      ready,
      items,
      count: items.reduce((s, i) => s + i.qty, 0),
      subtotal: items.reduce((s, i) => s + i.qty * i.price_cents, 0),
      add: (item, qty = 1) => {
        const ex = items.find((i) => i.id === item.id);
        save(
          ex
            ? items.map((i) => (i.id === item.id ? { ...i, ...item, qty: clamp(i.qty + qty, item.max) } : i))
            : [...items, { ...item, qty: clamp(qty, item.max) }],
        );
      },
      setQty: (id, qty) => save(items.map((i) => (i.id === id ? { ...i, qty: clamp(qty, i.max) } : i))),
      remove: (id) => save(items.filter((i) => i.id !== id)),
      clear: () => save([]),
    };
  }, [items, ready, save]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const c = useContext(CartContext);
  if (!c) throw new Error("useCart doit être utilisé dans <CartProvider>");
  return c;
}

export function CartLink() {
  const { count, ready } = useCart();
  return (
    <a href="/panier" className="cart-link" aria-label={ready ? `Panier, ${count} article${count > 1 ? "s" : ""}` : "Panier"}>
      Panier
      {ready && count > 0 && <span className="cart-count">{count}</span>}
    </a>
  );
}

export function ClearCart() {
  const { clear, ready, count } = useCart();
  useEffect(() => {
    if (ready && count > 0) clear();
  }, [ready, count, clear]);
  return null;
}
