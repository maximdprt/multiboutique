"use client";
// Barre d'achat collée en bas de l'écran sur mobile, dès que le bouton « Ajouter au panier » n'est plus visible.
import { useEffect, useState } from "react";
import { money } from "@/lib/format";
import { useCart, type CartItem } from "./cart";
import { StoreLink } from "./store";
import { track } from "./track";

export function StickyBuy({ product, watch = "achat" }: { product: Omit<CartItem, "qty">; watch?: string }) {
  const { add } = useCart();
  const [show, setShow] = useState(false);
  const [added, setAdded] = useState(false);
  useEffect(() => {
    const el = document.getElementById(watch);
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [watch]);
  if (product.max === 0) return null;
  return (
    <div className={`sticky-buy${show ? " on" : ""}`} aria-hidden={!show}>
      <div>
        <b>{product.title}</b>
        <span>{money(product.price_cents)}</span>
      </div>
      {added ? (
        <StoreLink className="btn" href="/panier" tabIndex={show ? undefined : -1}>
          Voir le panier
        </StoreLink>
      ) : (
        <button
          type="button"
          className="btn"
          tabIndex={show ? undefined : -1}
          onClick={() => {
            add(product, 1);
            setAdded(true);
            track("add_to_cart");
          }}
        >
          Ajouter au panier
        </button>
      )}
    </div>
  );
}
