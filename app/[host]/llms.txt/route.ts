// llms.txt : un résumé en texte simple de la boutique, pensé pour les assistants IA.
// Il leur donne en une lecture : qui vous êtes, ce que vous vendez, à quel prix, et où lire la suite.
import { db } from "@/lib/db";
import { siteFromHost, siteUrl } from "@/lib/sites";
import { money } from "@/lib/format";
import { LEGAL_PAGES } from "../legal";

export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: Promise<{ host: string }> }) {
  const site = await siteFromHost((await params).host);
  if (!site) return new Response("Not found", { status: 404 });
  const [products, guides] = await Promise.all([
    db.listProducts({ siteId: site.id, activeOnly: true }),
    db.listGuides({ siteId: site.id, publishedOnly: true }),
  ]);
  const shipping =
    site.shipping.free_from_cents > 0
      ? `${money(site.shipping.flat_cents)}, offerte dès ${money(site.shipping.free_from_cents)}`
      : money(site.shipping.flat_cents);
  const lines = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    `- Livraison : ${site.shipping.delay}, ${shipping}`,
    `- Retours : ${site.return_days} jours après réception`,
    `- Paiement : carte bancaire, Apple Pay, Google Pay (Stripe)`,
    `- Contact : ${site.legal.email}`,
    "",
    "## Produits",
    "",
    ...products.map(
      (p) => `- [${p.title}](${siteUrl(site, `/produits/${p.slug}`)}) : ${money(p.price_cents)}${p.stock === 0 ? " (épuisé)" : ""}. ${p.subtitle}`,
    ),
    "",
    "## Guides",
    "",
    ...guides.map((g) => `- [${g.title}](${siteUrl(site, `/guides/${g.slug}`)}) : ${g.excerpt}`),
    "",
    "## Questions fréquentes",
    "",
    ...site.faq.flatMap((f) => [`### ${f.q}`, "", f.a, ""]),
    "## Informations",
    "",
    ...Object.entries(LEGAL_PAGES).map(([k, v]) => `- [${v.title}](${siteUrl(site, `/${k}`)})`),
  ];
  return new Response(lines.join("\n") + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
