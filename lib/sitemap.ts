import "server-only";
// Adresses publiques d'une boutique : utilisées par sitemap.xml et pour prévenir IndexNow à la mise en ligne.
import { LEGAL_PAGES } from "@/app/[host]/legal";
import { db } from "./db";
import { siteUrl } from "./sites";
import type { Site } from "./types";

export type SitemapEntry = { loc: string; lastmod?: string; images?: string[] };

export async function sitemapEntries(site: Site): Promise<SitemapEntry[]> {
  const [products, guides] = await Promise.all([
    db.listProducts({ siteId: site.id, activeOnly: true }),
    db.listGuides({ siteId: site.id, publishedOnly: true }),
  ]);
  const latest = [...products.map((p) => p.updated_at), ...guides.map((g) => g.updated_at)].sort().pop();
  return [
    { loc: siteUrl(site), lastmod: latest },
    { loc: siteUrl(site, "/produits"), lastmod: latest },
    { loc: siteUrl(site, "/guides"), lastmod: guides[0]?.updated_at },
    ...products.map((p) => ({
      loc: siteUrl(site, `/produits/${p.slug}`),
      lastmod: p.updated_at,
      images: p.images.map((i) => (i.startsWith("/") ? siteUrl(site, i) : i)),
    })),
    ...guides.map((g) => ({ loc: siteUrl(site, `/guides/${g.slug}`), lastmod: g.updated_at })),
    ...Object.keys(LEGAL_PAGES).map((k) => ({ loc: siteUrl(site, `/${k}`) })),
  ];
}
