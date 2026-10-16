import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { siteFromHost, siteUrl } from "@/lib/sites";
import { slugify } from "@/lib/format";
import { JsonLd, breadcrumbLd } from "@/lib/seo";
import { ProductTile } from "@/components/ProductBits";

type Props = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await siteFromHost((await params).host);
  if (!site) return {};
  return {
    title: "Tous les produits",
    description: `Tous les produits ${site.name} : ${site.tagline.toLowerCase()}. Livraison ${site.shipping.delay}, retours sous ${site.return_days} jours.`,
    alternates: { canonical: siteUrl(site, "/produits") },
  };
}

export default async function Catalogue({ params }: Props) {
  const site = await siteFromHost((await params).host);
  if (!site) notFound();
  const products = await db.listProducts({ siteId: site.id, activeOnly: true });
  const groups = new Map<string, typeof products>();
  for (const p of products) {
    const k = p.category || "Autres";
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: products.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: siteUrl(site, `/produits/${p.slug}`), name: p.title })),
  };

  return (
    <>
      <JsonLd data={[itemList, breadcrumbLd(site, [{ name: "Accueil", path: "/" }, { name: "Produits", path: "/produits" }])]} />
      <div className="wrap">
        <header className="page-title">
          <h1>Tous les produits</h1>
          <p>{site.tagline}.</p>
          {groups.size > 1 && (
            <nav className="cat-nav" aria-label="Catégories">
              {[...groups.keys()].map((c) => (
                <a key={c} href={`#${slugify(c)}`}>
                  {c}
                </a>
              ))}
            </nav>
          )}
        </header>
        {[...groups.entries()].map(([cat, list]) => (
          <section key={cat} className="section" aria-labelledby={slugify(cat)}>
            <div className="section-head">
              <h2 id={slugify(cat)}>{cat}</h2>
            </div>
            <div className="grid">
              {list.map((p) => (
                <ProductTile key={p.id} p={p} />
              ))}
            </div>
          </section>
        ))}
        <div style={{ height: 72 }} />
      </div>
    </>
  );
}
