// Accueil du gabarit « Studio » : sombre, nom de la boutique en très grand, images qui défilent avec la page,
// présentation révélée au défilement, collections numérotées, produits phares en cartes empilées.
// Tout vient des données de la boutique (aucun texte ni image inventés).
import type { CSSProperties } from "react";
import { money, slugify } from "@/lib/format";
import type { Guide, Product, Site } from "@/lib/types";
import { ProductImage } from "@/components/ProductBits";
import { StoreLink } from "@/components/store";
import { FadeIn, Magnet, Marquee, RevealText, StackCards, type MarqueeItem } from "@/components/studio";

const two = (n: number) => String(n).padStart(2, "0");

/** Images des produits, répétées au besoin pour remplir les deux bandeaux (11 + 10 vignettes). */
function marqueeRows(products: Product[]): [MarqueeItem[], MarqueeItem[]] {
  const all = products.flatMap((p) => p.images.map((src) => ({ href: `/produits/${p.slug}`, src, label: p.title })));
  if (!all.length) return [[], []];
  const items = Array.from({ length: 21 }, (_, i) => all[i % all.length]);
  return [items.slice(0, 11), items.slice(11)];
}

/** Collections : une par catégorie, avec le nombre de produits et l'écart de prix (des faits, pas des promesses). */
function collections(products: Product[]) {
  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
  return cats.map((name) => {
    const ps = products.filter((p) => p.category === name);
    const prices = ps.map((p) => p.price_cents);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = min === max ? money(min) : `de ${money(min)} à ${money(max)}`;
    return { name, text: `${ps.length} produit${ps.length > 1 ? "s" : ""}, ${range}. ${ps.slice(0, 3).map((p) => p.title).join(", ")}.` };
  });
}

export function StudioHome({ site, products, guides }: { site: Site; products: Product[]; guides: Guide[] }) {
  const hero = products.find((p) => p.id === site.hero_product_id) ?? products[0];
  const featured = [hero, ...products.filter((p) => p !== hero)].filter(Boolean).slice(0, 3) as Product[];
  const corners = products.filter((p) => p !== hero && p.images[0]).slice(0, 4);
  const facts = [
    site.shipping.free_from_cents > 0 ? `Livraison offerte dès ${money(site.shipping.free_from_cents)}` : `Livraison en ${site.shipping.delay}`,
    `Retours sous ${site.return_days} jours`,
    "Paiement sécurisé par Stripe",
  ];

  return (
    <div className="studio-home">
      {/* 1. Accueil */}
      <section className="s-hero" aria-labelledby="s-nom">
        <FadeIn delay={0.15} y={40} className="s-hero-title">
          <h1 id="s-nom" className="s-gradient s-giant" style={{ "--chars": Math.max(site.name.length, 6) } as CSSProperties}>
            {site.name}
          </h1>
        </FadeIn>
        {hero?.images[0] && (
          <FadeIn delay={0.6} y={30} className="s-portrait">
            <Magnet padding={150} strength={3}>
              <StoreLink href={`/produits/${hero.slug}`} className="s-portrait-link" aria-label={`${hero.title}, ${money(hero.price_cents)}`}>
                <span className="s-portrait-media">
                  <ProductImage src={hero.images[0]} alt="" sizes="(max-width: 640px) 280px, 520px" priority />
                </span>
                <span className="s-chip">
                  {hero.title} · {money(hero.price_cents)}
                </span>
              </StoreLink>
            </Magnet>
          </FadeIn>
        )}
        <div className="s-hero-bottom">
          <FadeIn delay={0.35} y={20}>
            <p className="s-lede">{site.tagline}</p>
          </FadeIn>
          <FadeIn delay={0.5} y={20}>
            <StoreLink className="s-cta" href="/produits">
              Voir la boutique
            </StoreLink>
          </FadeIn>
        </div>
      </section>

      {/* 2. Bandeaux d'images liés au défilement */}
      {products.length > 0 && <Marquee rows={marqueeRows(products)} />}

      {/* 3. À propos */}
      <section className="s-about" id="a-propos" aria-labelledby="s-a-propos">
        {corners.map((p, i) => (
          <FadeIn key={p.id} delay={[0.1, 0.15, 0.25, 0.3][i]} duration={0.9} x={i % 2 === 0 ? -80 : 80} y={0} className={`s-corner s-corner-${i + 1}`}>
            <span className="s-corner-media" aria-hidden="true">
              <ProductImage src={p.images[0]} alt="" sizes="220px" />
            </span>
          </FadeIn>
        ))}
        <div className="s-about-inner">
          <FadeIn y={40}>
            <h2 id="s-a-propos" className="s-gradient s-heading">
              À propos
            </h2>
          </FadeIn>
          <RevealText text={site.description || site.hero_text} className="s-about-text" />
          <StoreLink className="s-cta" href="/produits">
            Voir les produits
          </StoreLink>
        </div>
      </section>

      {/* 4. Collections (fond clair) */}
      <section className="s-services" aria-labelledby="s-collections">
        <h2 id="s-collections" className="s-heading s-dark">
          Collections
        </h2>
        <ol className="s-list">
          {collections(products).map((c, i) => (
            <li key={c.name}>
              <FadeIn delay={i * 0.1}>
                <StoreLink href={`/produits#${slugify(c.name)}`} className="s-item">
                  <span className="s-num" aria-hidden="true">
                    {two(i + 1)}
                  </span>
                  <span>
                    <span className="s-item-name">{c.name}</span>
                    <span className="s-item-text">{c.text}</span>
                  </span>
                </StoreLink>
              </FadeIn>
            </li>
          ))}
        </ol>
        <ul className="s-facts">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>

      {/* 5. Produits phares en cartes empilées */}
      {featured.length > 0 && (
        <section className="s-projects" aria-labelledby="s-phares">
          <h2 id="s-phares" className="s-gradient s-heading">
            Produits phares
          </h2>
          <StackCards>
            {featured.map((p, i) => {
              const [a, b, c] = [p.images[0], p.images[1] ?? p.images[0], p.images[2] ?? p.images[0]];
              return (
                <article key={p.id} className="s-card" aria-labelledby={`s-card-${p.id}`}>
                  <div className="s-card-top">
                    <span className="s-num" aria-hidden="true">
                      {two(i + 1)}
                    </span>
                    <div className="s-card-title">
                      <span className="s-card-cat">{p.category}</span>
                      <h3 id={`s-card-${p.id}`}>{p.title}</h3>
                      <span className="s-card-price">
                        {money(p.price_cents)}
                        {p.compare_at_cents && p.compare_at_cents > p.price_cents && (
                          <s>
                            <span className="sr-only">Au lieu de </span>
                            {money(p.compare_at_cents)}
                          </s>
                        )}
                      </span>
                    </div>
                    <StoreLink className="s-ghost" href={`/produits/${p.slug}`} aria-label={`Voir le produit ${p.title}`}>
                      Voir le produit
                    </StoreLink>
                  </div>
                  <div className="s-card-grid">
                    <div className="s-card-col">
                      <span className="s-img s-img-1">
                        <ProductImage src={a} alt={p.title} sizes="(max-width: 640px) 40vw, 420px" />
                      </span>
                      <span className="s-img s-img-2">
                        <ProductImage src={b} alt="" sizes="(max-width: 640px) 40vw, 420px" />
                      </span>
                    </div>
                    <span className="s-img s-img-3">
                      <ProductImage src={c} alt="" sizes="(max-width: 640px) 60vw, 640px" />
                    </span>
                  </div>
                </article>
              );
            })}
          </StackCards>
        </section>
      )}

      {/* 6. Guides et questions */}
      {guides.length > 0 && (
        <section className="s-guides" aria-labelledby="s-guides">
          <h2 id="s-guides" className="s-gradient s-heading s-heading-sm">
            Guides
          </h2>
          <ul>
            {guides.slice(0, 4).map((g, i) => (
              <li key={g.id}>
                <FadeIn delay={i * 0.1}>
                  <StoreLink href={`/guides/${g.slug}`}>
                    <h3>{g.title}</h3>
                    <p>{g.excerpt}</p>
                  </StoreLink>
                </FadeIn>
              </li>
            ))}
          </ul>
          <StoreLink className="s-ghost" href="/guides">
            Tous les guides
          </StoreLink>
        </section>
      )}
      {site.faq.length > 0 && (
        <section className="s-faq" aria-labelledby="s-faq">
          <h2 id="s-faq" className="s-gradient s-heading s-heading-sm">
            Questions
          </h2>
          <div className="faq">
            {site.faq.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
