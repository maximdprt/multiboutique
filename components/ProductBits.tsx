import Image from "next/image";
import type { Product } from "@/lib/types";
import { money } from "@/lib/format";
import { StoreLink } from "./store";

export function ProductImage({
  src,
  alt,
  sizes,
  priority,
}: {
  src: string | undefined;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      // les SVG de démonstration n'ont pas besoin d'être convertis
      unoptimized={src.endsWith(".svg")}
    />
  );
}

export function Price({ p }: { p: Pick<Product, "price_cents" | "compare_at_cents"> }) {
  const promo = p.compare_at_cents && p.compare_at_cents > p.price_cents;
  return (
    <p className="price">
      <span className="now">{money(p.price_cents)}</span>
      {promo && (
        <s>
          <span className="sr-only">Au lieu de </span>
          {money(p.compare_at_cents!)}
        </s>
      )}
    </p>
  );
}

export function ProductTile({ p, priority }: { p: Product; priority?: boolean }) {
  const promo = p.compare_at_cents && p.compare_at_cents > p.price_cents;
  return (
    <StoreLink className="tile" href={`/produits/${p.slug}`}>
      <div className="media">
        <ProductImage src={p.images[0]} alt={p.title} sizes="(max-width: 900px) 50vw, 380px" priority={priority} />
        {p.stock === 0 ? (
          <span className="badge">Épuisé</span>
        ) : promo ? (
          <span className="badge">−{Math.round((1 - p.price_cents / p.compare_at_cents!) * 100)} %</span>
        ) : null}
      </div>
      <h3>{p.title}</h3>
      {p.subtitle && <p className="sub">{p.subtitle}</p>}
      <Price p={p} />
    </StoreLink>
  );
}
