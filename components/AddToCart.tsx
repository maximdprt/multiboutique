"use client";
import { useState } from "react";
import { useCart, type CartItem } from "./cart";
import { track } from "./track";
import { StoreLink } from "./store";

export function AddToCart({ product }: { product: Omit<CartItem, "qty"> }) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const soldOut = product.max === 0;
  const max = Math.min(product.max ?? 20, 20);

  return (
    <>
      <div className="add">
        <div className="qty" role="group" aria-label="Quantité">
          <button type="button" aria-label="Retirer un" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={soldOut}>
            −
          </button>
          <output aria-live="polite">{qty}</output>
          <button type="button" aria-label="Ajouter un" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={soldOut}>
            +
          </button>
        </div>
        <button
          type="button"
          className="btn"
          disabled={soldOut}
          onClick={() => {
            add(product, qty);
            setAdded(true);
            track("add_to_cart");
          }}
        >
          {soldOut ? "Épuisé" : "Ajouter au panier"}
        </button>
      </div>
      <p className="added" aria-live="polite">
        {added && (
          <>
            Ajouté au panier. <StoreLink href="/panier">Voir le panier</StoreLink>
          </>
        )}
      </p>
    </>
  );
}
