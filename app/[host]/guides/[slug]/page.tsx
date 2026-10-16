import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { siteFromHost, siteUrl } from "@/lib/sites";
import { date } from "@/lib/format";
import { RichText, plainText, truncate } from "@/lib/richtext";
import { JsonLd, articleLd, breadcrumbLd } from "@/lib/seo";
import { ProductTile } from "@/components/ProductBits";

type Props = { params: Promise<{ host: string; slug: string }> };

async function load(params: Props["params"]) {
  const { host, slug } = await params;
  const site = await siteFromHost(host);
  if (!site) return null;
  const guide = await db.getGuideBySlug(site.id, slug);
  if (!guide || !guide.published) return null;
  return { site, guide };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  if (!data) return {};
  const { site, guide: g } = data;
  const description = g.seo_description || g.excerpt || truncate(plainText(g.body));
  const url = siteUrl(site, `/guides/${g.slug}`);
  return {
    title: g.seo_title || g.title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", title: g.seo_title || g.title, description, url, publishedTime: g.published_at, modifiedTime: g.updated_at },
  };
}

export default async function GuidePage({ params }: Props) {
  const data = await load(params);
  if (!data) notFound();
  const { site, guide: g } = data;
  const products = (await db.listProducts({ siteId: site.id, activeOnly: true })).filter((p) => g.product_ids.includes(p.id));

  return (
    <>
      <JsonLd
        data={[
          articleLd(site, g),
          breadcrumbLd(site, [
            { name: "Accueil", path: "/" },
            { name: "Guides", path: "/guides" },
            { name: g.title, path: `/guides/${g.slug}` },
          ]),
        ]}
      />
      <div className="wrap">
        <nav className="crumbs" aria-label="Fil d'Ariane">
          <ol>
            <li>
              <a href="/">Accueil</a>
            </li>
            <li>
              <a href="/guides">Guides</a>
            </li>
            <li aria-current="page">{g.title}</li>
          </ol>
        </nav>
        <article className="article">
          <header>
            <h1>{g.title}</h1>
            {g.excerpt && <p className="lede">{g.excerpt}</p>}
            <p className="meta">
              Par l&apos;équipe {site.name}, mis à jour le <time dateTime={g.updated_at}>{date(g.updated_at)}</time>
            </p>
          </header>
          <RichText source={g.body} className="prose" />
        </article>
        {products.length > 0 && (
          <section className="section" aria-labelledby="produits-cites" style={{ paddingTop: 0, paddingBottom: 72 }}>
            <div className="section-head">
              <h2 id="produits-cites">Les produits cités</h2>
            </div>
            <div className="grid">
              {products.map((p) => (
                <ProductTile key={p.id} p={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
