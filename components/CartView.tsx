"use client";
import { useState } from "react";
import Image from "next/image";
import { useCart } from "./cart";
import { money } from "@/lib/format";
import { track } from "./track";

export function CartView({ flat, freeFrom }: { flat: number; freeFrom: number }) {
  const { items, ready, subtotal, setQty, remove } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!ready) return <div className="empty" aria-busy="true" />;
  if (!items.length)
    return (
      <div className="empty">
        <p>Votre panier est vide.</p>
        <a className="btn" href="/produits">
          Voir les produits
        </a>
      </div>
    );

  const free = freeFrom > 0 && subtotal >= freeFrom;
  const shipping = free ? 0 : flat;

  async function checkout() {
    setBusy(true);
    setError("");
    track("checkout");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map((i) => ({ id: i.id, qty: i.qty })) }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Le paiement n'a pas pu démarrer.");
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="cart">
      <ul className="cart-lines">
        {items.map((i) => (
          <li key={i.id}>
            <a className="media" href={`/produits/${i.slug}`} aria-label={i.title}>
              {i.image && <Image src={i.image} alt="" fill sizes="88px" unoptimized={i.image.endsWith(".svg")} />}
            </a>
            <div>
              <a href={`/produits/${i.slug}`} style={{ textDecoration: "none", fontWeight: 600 }}>
                {i.title}
              </a>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center" }}>
                <div className="qty" role="group" aria-label={`Quantité pour ${i.title}`}>
                  <button type="button" aria-label="Retirer un" onClick={() => (i.qty > 1 ? setQty(i.id, i.qty - 1) : remove(i.id))}>
                    −
                  </button>
                  <output>{i.qty}</output>
                  <button type="button" aria-label="Ajouter un" onClick={() => setQty(i.id, i.qty + 1)}>
                    +
                  </button>
                </div>
                <button type="button" className="remove" onClick={() => remove(i.id)}>
                  Retirer
                </button>
              </div>
            </div>
            <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{money(i.price_cents * i.qty)}</div>
          </li>
        ))}
      </ul>
      <aside className="summary" aria-label="Récapitulatif">
        <dl>
          <div>
            <dt>Sous-total</dt>
            <dd>{money(subtotal)}</dd>
          </div>
          <div>
            <dt>Livraison</dt>
            <dd>{shipping ? money(shipping) : "Offerte"}</dd>
          </div>
          <div className="total">
            <dt>Total</dt>
            <dd>{money(subtotal + shipping)}</dd>
          </div>
        </dl>
        <button type="button" className="btn btn-wide" onClick={checkout} disabled={busy}>
          {busy ? "Redirection vers le paiement…" : "Payer la commande"}
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!free && freeFrom > 0 && (
          <p className="hint">Plus que {money(freeFrom - subtotal)} pour la livraison offerte.</p>
        )}
        <p className="hint">Paiement sécurisé par Stripe : carte bancaire, Apple Pay, Google Pay.</p>
      </aside>
    </div>
  );
}
