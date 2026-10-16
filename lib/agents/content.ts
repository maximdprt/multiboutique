import "server-only";
// Agent de contenu : chaque semaine, écrit et publie un nouveau guide par boutique,
// sur une question que les gens posent vraiment et que la boutique ne couvre pas encore.
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { slugify } from "../format";
import { siteUrl } from "../sites";
import { pingIndexNow } from "../indexnow";
import type { Site } from "../types";
import { hasClaude, S, structured } from "./claude";
import type { Ctx } from "./run";

const SYSTEM = `Tu es rédacteur SEO francophone pour une petite boutique en ligne. Tu choisis une question réelle, à faible concurrence, que la boutique ne traite pas encore, puis tu écris le meilleur article possible pour y répondre.
Règles : réponse directe dans la première phrase ; intertitres ## formulés en questions ; listes ; exemples concrets ; aucun fait inventé, aucune promesse de santé ; texte original ; 1 à 3 liens naturels vers les produits au format [texte](/produits/adresse). Longueur : 5 000 à 8 000 caractères.`;

const TOOL = {
  name: "publier_guide",
  description: "Enregistre le guide à publier.",
  schema: S.obj({
    query: S.str("Requête Google visée"),
    title: S.str("Titre = la question"),
    excerpt: S.str("Réponse directe en 1 ou 2 phrases"),
    body: S.str("L'article"),
    product_slugs: S.arr(S.str("adresse du produit, sans /produits/"), "Produits cités"),
    seo_title: S.str("Titre Google, 60 caractères maximum"),
    seo_description: S.str("Description Google, environ 150 caractères"),
  }),
};

export async function writeGuideFor(ctx: Ctx, site: Site) {
  const [guides, products] = await Promise.all([db.listGuides({ siteId: site.id }), db.listProducts({ siteId: site.id, activeOnly: true })]);
  if (!hasClaude()) {
    ctx.log(`${site.name} : mode démo, aucun guide écrit (ajoutez ANTHROPIC_API_KEY).`);
    return null;
  }
  ctx.log(`${site.name} : recherche d'une question non couverte…`);
  const { data } = await structured<{ query: string; title: string; excerpt: string; body: string; product_slugs: string[]; seo_title: string; seo_description: string }>({
    system: SYSTEM,
    tool: TOOL,
    searches: 5,
    log: ctx.log,
    maxTokens: 12000,
    prompt: `Boutique « ${site.name} » (${site.domain}) : ${site.description}
Produits :
${products.map((p) => `- ${p.title} : ${p.slug}`).join("\n")}
Guides déjà publiés (ne pas refaire) :
${guides.map((g) => `- ${g.title}`).join("\n") || "aucun"}
Cherche ce que les gens demandent autour de cette niche (suggestions, « autres questions posées », forums) et choisis la question la plus prometteuse pour une boutique récente.`,
  });
  const slug = slugify(data.title);
  if (guides.some((g) => g.slug === slug)) {
    ctx.log(`${site.name} : sujet déjà traité, rien publié.`);
    return null;
  }
  const g = await db.saveGuide({
    site_id: site.id,
    slug,
    title: data.title,
    excerpt: data.excerpt,
    body: data.body,
    product_ids: products.filter((p) => (data.product_slugs ?? []).includes(p.slug)).map((p) => p.id),
    seo_title: (data.seo_title ?? "").slice(0, 70),
    seo_description: (data.seo_description ?? "").slice(0, 170),
    published: process.env.AGENT_AUTOPUBLISH !== "false",
    published_at: new Date().toISOString(),
  });
  revalidatePath("/", "layout");
  await pingIndexNow(site, [siteUrl(site, `/guides/${g.slug}`), siteUrl(site, "/guides")]).catch(() => {});
  ctx.log(`${site.name} : guide ${g.published ? "publié" : "enregistré en brouillon"} : « ${g.title} » (requête : ${data.query}).`);
  return g;
}

export async function runContent(ctx: Ctx, siteId?: string) {
  const sites = (await db.listSites()).filter((s) => s.active && (!siteId || s.id === siteId));
  let written = 0;
  for (const s of sites) {
    try {
      if (await writeGuideFor(ctx, s)) written++;
    } catch (e) {
      ctx.log(`${s.name} : échec (${(e as Error).message}).`);
    }
  }
  return { guides: written, boutiques: sites.length };
}
