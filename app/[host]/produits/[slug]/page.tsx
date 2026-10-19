import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { siteFromHost, siteUrl } from "@/lib/sites";
import { money } from "@/lib/format";
import { RichText, plainText, truncate } from "@/lib/richtext";
import { JsonLd, breadcrumbLd, faqLd, productLd } from "@/lib/seo";
import { Price, ProductTile } from "@/components/ProductBits";
import { AddToCart } from "@/components/AddToCart";
import { Gallery } from "@/components/Gallery";
import { StickyBuy } from "@/components/StickyBuy";
import { galleryOf } from "@/lib/images/gallery";
import { StoreLink } from "@/components/store";

type Props = { params: Promise<{ host: string; slug: string }> };

async function load(params: Props["params"]) {
  const { host, slug } = await params;
  const site = await siteFromHost(host);
  if (!site) return null;
  const product = await db.getProductBySlug(site.id, slug);
  if (!product || !product.active) return null;
  return { site, product };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  if (!data) return {};
  const { site, product: p } = data;
  const description = p.seo_description || truncate(`${p.subtitle ? p.subtitle + ". " : ""}${plainText(p.description)}`);
  const url = siteUrl(site, `/produits/${p.slug}`);
  return {
    title: p.seo_title || p.title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", title: p.seo_title || p.title, description, url, images: p.images.slice(0, 1) },
  };
}

export default async function ProductPage({ params }: Props) {
  const data = await load(params);
  if (!data) notFound();
  const { site, product: p } = data;

  const [all, guides, gallery] = await Promise.all([
    db.listProducts({ siteId: site.id, activeOnly: true }),
    db.listGuides({ siteId: site.id, publishedOnly: true }),
    galleryOf(p),
  ]);
  const cartItem = { id: p.id, slug: p.slug, title: p.title, price_cents: p.price_cents, image: p.images[0] ?? "", max: p.stock };
  const related = all.filter((x) => x.id !== p.id && x.category === p.category).concat(all.filter((x) => x.id !== p.id && x.category !== p.category)).slice(0, 3);
  const linkedGuides = guides.filter((g) => g.product_ids.includes(p.id));
  const free = site.shipping.free_from_cents > 0;
  const faq = faqLd(p.faq);

  return (
    <>
      <JsonLd
        data={[
          productLd(site, p),
          breadcrumbLd(site, [
            { name: "Accueil", path: "/" },
            { name: "Produits", path: "/produits" },
            { name: p.title, path: `/produits/${p.slug}` },
          ]),
          ...(faq ? [faq] : []),
        ]}
      />
      <div className="wrap">
        <nav className="crumbs" aria-label="Fil d'Ariane">
          <ol>
            <li>
              <StoreLink href="/">Accueil</StoreLink>
            </li>
            <li>
              <StoreLink href="/produits">Produits</StoreLink>
            </li>
            <li aria-current="page">{p.title}</li>
          </ol>
        </nav>

        <div className="pdp">
          <Gallery title={p.title} images={gallery.map((m) => ({ src: m.url, alt: m.alt || p.title, width: m.width, height: m.height }))} />

          <div className="buy">
            <h1>{p.title}</h1>
            {p.subtitle && <p className="sub">{p.subtitle}</p>}
            <Price p={p} />
            {p.stock !== null && p.stock > 0 && p.stock <= 5 && <p className="stock-note">Plus que {p.stock} en stock</p>}
            <AddToCart product={cartItem} />
            {p.highlights.length > 0 && (
              <ul className="highlights">
                {p.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
            <ul className="trust" aria-label="Livraison, retours et paiement">
              <li>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
                  <circle cx="7" cy="17.5" r="1.8" />
                  <circle cx="17" cy="17.5" r="1.8" />
                </svg>
                <span>
                  Livraison en {site.shipping.delay}
                  {free ? `, offerte dès ${money(site.shipping.free_from_cents)}` : ""}
                </span>
              </li>
              <li>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4" />
                </svg>
                <span>Retours sous {site.return_days} jours</span>
              </li>
              <li>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <span>Paiement sécurisé par Stripe</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="details">
          <section aria-labelledby="description">
            <h2 id="description">En détail</h2>
            <RichText source={p.description} className="prose" />
          </section>
          <div>
            {p.specs.length > 0 && (
              <section aria-labelledby="caracteristiques">
                <h2 id="caracteristiques">Caractéristiques</h2>
                <dl className="specs">
                  {p.specs.map((s) => (
                    <div key={s.label}>
                      <dt>{s.label}</dt>
                      <dd>{s.value}</dd>
                    </div>
                  ))}
                  {p.sku && (
                    <div>
                      <dt>Référence</dt>
                      <dd>{p.sku}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}
            {linkedGuides.length > 0 && (
              <section aria-labelledby="a-lire" style={{ marginTop: 40 }}>
                <h2 id="a-lire">À lire avant d&apos;acheter</h2>
                <ul className="guide-list" style={{ gridTemplateColumns: "1fr" }}>
                  {linkedGuides.map((g) => (
                    <li key={g.id}>
                      <StoreLink href={`/guides/${g.slug}`}>
                        <h3>{g.title}</h3>
                        <p>{g.excerpt}</p>
                      </StoreLink>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        {p.faq.length > 0 && (
          <section className="section" aria-labelledby="questions">
            <div className="section-head">
              <h2 id="questions">Vos questions sur ce produit</h2>
            </div>
            <div className="faq">
              {p.faq.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section className="section" aria-labelledby="aussi">
            <div className="section-head">
              <h2 id="aussi">Vous aimerez aussi</h2>
            </div>
            <div className="grid">
              {related.map((r) => (
                <ProductTile key={r.id} p={r} />
              ))}
            </div>
          </section>
        )}
      </div>
      <StickyBuy product={cartItem} />
    </>
  );
}
