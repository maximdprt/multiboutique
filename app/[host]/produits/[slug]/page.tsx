import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { siteFromHost, siteUrl } from "@/lib/sites";
import { money } from "@/lib/format";
import { RichText, plainText, truncate } from "@/lib/richtext";
import { JsonLd, breadcrumbLd, faqLd, productLd } from "@/lib/seo";
import { Price, ProductImage, ProductTile } from "@/components/ProductBits";
import { AddToCart } from "@/components/AddToCart";

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

  const [all, guides] = await Promise.all([
    db.listProducts({ siteId: site.id, activeOnly: true }),
    db.listGuides({ siteId: site.id, publishedOnly: true }),
  ]);
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
              <a href="/">Accueil</a>
            </li>
            <li>
              <a href="/produits">Produits</a>
            </li>
            <li aria-current="page">{p.title}</li>
          </ol>
        </nav>

        <div className="pdp">
          <div className="gallery">
            <div className="media">
              <ProductImage src={p.images[0]} alt={p.title} sizes="(max-width: 860px) 100vw, 620px" priority />
            </div>
            {p.images.length > 1 && (
              <div className="thumbs">
                {p.images.slice(1, 6).map((src, i) => (
                  <div className="media" key={src}>
                    <ProductImage src={src} alt={`${p.title}, vue ${i + 2}`} sizes="76px" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="buy">
            <h1>{p.title}</h1>
            {p.subtitle && <p className="sub">{p.subtitle}</p>}
            <Price p={p} />
            {p.stock !== null && p.stock > 0 && p.stock <= 5 && <p className="stock-note">Plus que {p.stock} en stock</p>}
            <AddToCart
              product={{ id: p.id, slug: p.slug, title: p.title, price_cents: p.price_cents, image: p.images[0] ?? "", max: p.stock }}
            />
            {p.highlights.length > 0 && (
              <ul className="highlights">
                {p.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
            <p className="ship-note">
              Livraison en {site.shipping.delay}
              {free ? `, offerte dès ${money(site.shipping.free_from_cents)}` : ""}. Retours sous {site.return_days} jours.
            </p>
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
                      <a href={`/guides/${g.slug}`}>
                        <h3>{g.title}</h3>
                        <p>{g.excerpt}</p>
                      </a>
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
    </>
  );
}
