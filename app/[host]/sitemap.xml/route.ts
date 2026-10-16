import { db } from "@/lib/db";
import { siteFromHost, siteUrl } from "@/lib/sites";
import { LEGAL_PAGES } from "../legal";

export const revalidate = 3600;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export async function GET(_req: Request, { params }: { params: Promise<{ host: string }> }) {
  const site = await siteFromHost((await params).host);
  if (!site) return new Response("Not found", { status: 404 });
  const [products, guides] = await Promise.all([
    db.listProducts({ siteId: site.id, activeOnly: true }),
    db.listGuides({ siteId: site.id, publishedOnly: true }),
  ]);
  const latest = [...products.map((p) => p.updated_at), ...guides.map((g) => g.updated_at)].sort().pop();
  const urls: { loc: string; lastmod?: string; images?: string[] }[] = [
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
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    (u) =>
      `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ""}${(u.images ?? [])
        .map((i) => `<image:image><image:loc>${esc(i)}</image:loc></image:image>`)
        .join("")}</url>`,
  )
  .join("\n")}
</urlset>`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
