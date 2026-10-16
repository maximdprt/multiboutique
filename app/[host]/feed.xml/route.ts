// Flux produits Google Merchant Center : fait apparaître les produits dans l'onglet Shopping de Google,
// gratuitement, souvent en quelques jours (bien plus vite que le référencement naturel classique).
// À déclarer dans Merchant Center > Produits > Flux > « Récupération planifiée » : https://votre-domaine/feed.xml
import { db } from "@/lib/db";
import { siteFromHost, siteUrl } from "@/lib/sites";
import { plainText, truncate } from "@/lib/richtext";

export const revalidate = 3600;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET(_req: Request, { params }: { params: Promise<{ host: string }> }) {
  const site = await siteFromHost((await params).host);
  if (!site) return new Response("Not found", { status: 404 });
  const products = (await db.listProducts({ siteId: site.id, activeOnly: true })).filter((p) => p.images.length && !p.images[0].endsWith(".svg"));
  const free = (cents: number) => site.shipping.free_from_cents > 0 && cents >= site.shipping.free_from_cents;
  const items = products
    .map((p) => {
      const img = (i: string) => (i.startsWith("/") ? siteUrl(site, i) : i);
      return `<item>
<g:id>${esc(p.sku || p.id)}</g:id>
<g:title>${esc(p.title)}</g:title>
<g:description>${esc(truncate(plainText(p.description), 4900))}</g:description>
<g:link>${esc(siteUrl(site, `/produits/${p.slug}`))}</g:link>
<g:image_link>${esc(img(p.images[0]))}</g:image_link>
${p.images
  .slice(1, 10)
  .map((i) => `<g:additional_image_link>${esc(img(i))}</g:additional_image_link>`)
  .join("\n")}
<g:availability>${p.stock === 0 ? "out_of_stock" : "in_stock"}</g:availability>
<g:price>${(p.price_cents / 100).toFixed(2)} EUR</g:price>
<g:condition>new</g:condition>
<g:brand>${esc(p.brand || site.name)}</g:brand>
${p.gtin ? `<g:gtin>${esc(p.gtin)}</g:gtin>` : "<g:identifier_exists>no</g:identifier_exists>"}
${p.category ? `<g:product_type>${esc(p.category)}</g:product_type>` : ""}
${site.shipping.countries
  .map(
    (c) =>
      `<g:shipping><g:country>${c}</g:country><g:price>${free(p.price_cents) ? "0.00" : (site.shipping.flat_cents / 100).toFixed(2)} EUR</g:price></g:shipping>`,
  )
  .join("\n")}
</item>`;
    })
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${esc(site.name)}</title>
<link>${esc(siteUrl(site))}</link>
<description>${esc(site.description)}</description>
${items}
</channel>
</rss>`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
