import { siteFromHost } from "@/lib/sites";
import { sitemapEntries } from "@/lib/sitemap";

export const revalidate = 3600;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export async function GET(_req: Request, { params }: { params: Promise<{ host: string }> }) {
  const site = await siteFromHost((await params).host);
  if (!site) return new Response("Not found", { status: 404 });
  const urls = await sitemapEntries(site);
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
