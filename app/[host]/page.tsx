import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { siteFromHost, siteUrl } from "@/lib/sites";
import { money } from "@/lib/format";
import { JsonLd, faqLd, organizationLd, websiteLd } from "@/lib/seo";
import { ProductImage, ProductTile } from "@/components/ProductBits";
import { StoreLink } from "@/components/store";

type Props = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await siteFromHost((await params).host);
  if (!site) return {};
  return { alternates: { canonical: siteUrl(site) }, openGraph: { title: site.name, description: site.description, url: siteUrl(site) } };
}

export default async function Home({ params }: Props) {
  const site = await siteFromHost((await params).host);
  if (!site) notFound();
  const [products, guides] = await Promise.all([
    db.listProducts({ siteId: site.id, activeOnly: true }),
    db.listGuides({ siteId: site.id, publishedOnly: true }),
  ]);
  const hero = products.find((p) => p.id === site.hero_product_id) ?? products[0];
  const facts = [
    site.shipping.free_from_cents > 0 ? `Livraison offerte dès ${money(site.shipping.free_from_cents)}` : `Livraison ${site.shipping.delay}`,
    `Retours sous ${site.return_days} jours`,
    "Paiement sécurisé par Stripe",
  ];
  const faq = faqLd(site.faq);

  return (
    <>
      <JsonLd data={[organizationLd(site), websiteLd(site), ...(faq ? [faq] : [])]} />

      <section className="hero">
        <div className="wrap">
          <div>
            <h1>{site.hero_title}</h1>
            <p className="hero-text">{site.hero_text}</p>
            <div className="hero-actions">
              <StoreLink className="btn" href="/produits">
                Voir les produits
              </StoreLink>
              {guides[0] && (
                <StoreLink className="btn btn-quiet" href={`/guides/${guides[0].slug}`}>
                  Lire nos conseils
                </StoreLink>
              )}
            </div>
          </div>
          {hero && (
            <StoreLink className="hero-pick" href={`/produits/${hero.slug}`}>
              <figure>
                <div className="media">
                  <ProductImage src={hero.images[0]} alt={hero.title} sizes="(max-width: 820px) 100vw, 520px" priority />
                </div>
                <figcaption>
                  <span>{hero.title}</span>
                  <span>{money(hero.price_cents)}</span>
                </figcaption>
              </figure>
            </StoreLink>
          )}
        </div>
      </section>

      <div className="facts">
        <ul className="wrap">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>

      <section className="section" aria-labelledby="produits">
        <div className="wrap">
          <div className="section-head">
            <h2 id="produits">Les produits</h2>
            <StoreLink href="/produits">Tout voir</StoreLink>
          </div>
          <div className="grid">
            {products.slice(0, 6).map((p, i) => (
              <ProductTile key={p.id} p={p} priority={i < 3} />
            ))}
          </div>
        </div>
      </section>

      {guides.length > 0 && (
        <section className="section" aria-labelledby="guides">
          <div className="wrap">
            <div className="section-head">
              <h2 id="guides">Guides et conseils</h2>
              <StoreLink href="/guides">Tous les guides</StoreLink>
            </div>
            <ul className="guide-list">
              {guides.slice(0, 4).map((g) => (
                <li key={g.id}>
                  <StoreLink href={`/guides/${g.slug}`}>
                    <h3>{g.title}</h3>
                    <p>{g.excerpt}</p>
                  </StoreLink>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {site.faq.length > 0 && (
        <section className="section" aria-labelledby="faq">
          <div className="wrap">
            <div className="section-head">
              <h2 id="faq">Questions fréquentes</h2>
            </div>
            <div className="faq">
              {site.faq.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
