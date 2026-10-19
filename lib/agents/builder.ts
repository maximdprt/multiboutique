import "server-only";
// Agent constructeur : propose une identité (noms, couleurs, produits, guides), puis construit la boutique.
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { slugify } from "../format";
import type { Product, QA, Site, Spec } from "../types";
import { hasClaude, S, structured } from "./claude";
import type { Ctx } from "./run";
import { pingIndexNow } from "../indexnow";
import { siteUrl } from "../sites";
import { hasCJ } from "../suppliers/cj";
import { sourceProduct } from "./catalog";

// ---------- Étape 1 : propositions ----------
export type Palette = { label: string; background: string; ink: string; primary: string; accent: string; font: "serif" | "grotesk" | "kanit" };
export type Proposal = {
  tagline: string;
  names: { name: string; domain: string; why: string }[];
  palettes: Palette[];
  products: { title: string; why: string }[];
  guides: { title: string; query: string }[];
};

const BRAND_SYSTEM = `Tu es directeur artistique et stratège SEO pour de petites boutiques en ligne françaises.
Noms : courts, faciles à retenir et à épeler, sans marque déposée existante, en français. Domaines en .fr, sans accents, avec tirets si besoin.
Gabarit : toutes les boutiques utilisent le gabarit « Studio » : fond très sombre, nom de la boutique en lettres géantes (dégradé du gris vers la couleur du texte), images produits qui défilent, bouton principal en dégradé de la couleur principale vers la couleur d'accent, police Kanit.
Couleurs : pour ce gabarit, un fond presque noir (luminosité < 8 %, ex. #0c0c0c, #0b0d12, #100c0a), un texte très clair légèrement teinté (ex. #d7e2ea, #ece6dc), une couleur principale saturée et une couleur d'accent chaude ou complémentaire qui forment ensemble un beau dégradé (ex. violet #7621b0 vers orange #be4c00). Contraste texte/fond d'au moins 7:1. Adaptées à la niche, toutes différentes entre elles. Évite le noir + vert fluo.
Produits : une gamme cohérente autour du produit d'appel, 6 à 10 idées vendables en dropshipping.
Guides : des questions réelles que les gens tapent dans Google, longue traîne, où une boutique neuve peut se classer vite.`;

const BRAND_TOOL = {
  name: "proposer_identite",
  description: "Propose l'identité de la boutique.",
  schema: S.obj({
    tagline: S.str("Accroche de la boutique, une ligne"),
    names: S.arr(S.obj({ name: S.str("Nom"), domain: S.str("domaine.fr"), why: S.str("Pourquoi ce nom, une phrase") }), "3 noms"),
    palettes: S.arr(
      S.obj({
        label: S.str("Nom de l'ambiance, 2 ou 3 mots"),
        background: S.str("Fond presque noir, hex"),
        ink: S.str("Texte très clair, hex"),
        primary: S.str("Couleur principale saturée (début du dégradé des boutons), hex"),
        accent: S.str("Couleur d'accent (fin du dégradé), hex"),
        font: S.enumOf(["kanit", "grotesk", "serif"], "kanit = police du gabarit Studio (conseillée), grotesk = moderne, serif = artisanal"),
      }),
      "3 palettes",
    ),
    products: S.arr(S.obj({ title: S.str("Produit"), why: S.str("Pourquoi, courte phrase") }), "8 produits"),
    guides: S.arr(S.obj({ title: S.str("Titre du guide"), query: S.str("Requête Google visée") }), "5 guides"),
  }),
};

export async function proposeBrand(input: { niche: string; product: string; notes: string }): Promise<Proposal> {
  if (!hasClaude()) return demoProposal(input);
  const { data } = await structured<Proposal>({
    system: BRAND_SYSTEM,
    tool: BRAND_TOOL,
    maxTokens: 4000,
    prompt: `Niche : ${input.niche}\nProduit d'appel : ${input.product}\nPrécisions : ${input.notes || "aucune"}\nPropose l'identité de la boutique.`,
  });
  return data;
}

// ---------- Étape 2 : construction ----------
export type BuildInput = {
  niche: string;
  product: string;
  notes: string;
  opportunity_id?: string;
  name: string;
  domain: string;
  tagline: string;
  palette: Palette;
  products: string[];
  guides: string[];
  countries: string[];
  flat_cents: number;
  free_from_cents: number;
  delay: string;
  return_days: number;
};

type GenProduct = {
  title: string;
  subtitle: string;
  category: string;
  description: string;
  highlights: string[];
  specs: Spec[];
  faq: QA[];
  price_eur: number;
  compare_at_eur?: number | null;
  cost_estimate_eur: number;
  supplier: string;
  supplier_url: string;
  /** Mots-clés anglais pour retrouver le produit dans le catalogue CJ */
  supplier_keywords_en?: string;
  seo_title: string;
  seo_description: string;
};
type GenSite = { description: string; hero_title: string; hero_text: string; faq: QA[] };
type GenGuide = { title: string; excerpt: string; body: string; product_titles: string[]; seo_title: string; seo_description: string };

const WRITER_SYSTEM = `Tu es rédacteur e-commerce et SEO francophone. Tu écris pour de vrais clients, simplement, sans jargon ni superlatifs creux.
Règles impératives :
- Textes 100 % originaux. Ne recopie jamais une description de fournisseur ou de concurrent.
- N'invente aucune caractéristique : n'écris une dimension, une matière ou une contenance que si tu l'as trouvée sur une page fournisseur ; sinon laisse la caractéristique de côté.
- Aucun faux avis, aucune fausse promotion, aucune promesse de santé ou de résultat.
- Format des descriptions : paragraphes séparés par une ligne vide, intertitres « ## », listes « - », gras **ainsi**.
- Optimisation pour Google et les moteurs IA : la réponse ou le bénéfice principal dans la première phrase, des intertitres sous forme de questions, une FAQ qui répond aux vraies objections d'achat.`;

const SITE_TOOL = {
  name: "creer_boutique",
  description: "Enregistre les textes de la boutique et les fiches produits.",
  schema: S.obj({
    site: S.obj({
      description: S.str("2 à 3 phrases : ce que vend la boutique, à qui, où elle livre"),
      hero_title: S.str("Grand titre de l'accueil, une phrase courte et concrète"),
      hero_text: S.str("Texte d'introduction, 2 phrases"),
      faq: S.arr(S.obj({ q: S.str("Question"), a: S.str("Réponse") }), "4 questions fréquentes (livraison, retours, usage)"),
    }),
    products: S.arr(
      S.obj({
        title: S.str("Titre tel qu'un client le chercherait, sans majuscules à chaque mot"),
        subtitle: S.str("Précision courte : taille, usage, matière"),
        category: S.str("Catégorie courte"),
        description: S.str("700 à 1 200 caractères, avec 2 intertitres ## et une liste"),
        highlights: S.arr(S.str("Point fort court"), "3 points forts"),
        specs: S.arr(S.obj({ label: S.str("Libellé"), value: S.str("Valeur trouvée") }), "Caractéristiques vérifiées seulement (peut être vide)"),
        faq: S.arr(S.obj({ q: S.str("Question"), a: S.str("Réponse") }), "3 questions"),
        price_eur: S.num("Prix de vente conseillé en euros, cohérent avec le marché"),
        compare_at_eur: { type: ["number", "null"], description: "Laisser null (pas de prix barré inventé)" },
        cost_estimate_eur: S.num("Coût d'achat fournisseur estimé, livraison comprise"),
        supplier: S.str("Plateforme fournisseur (CJ Dropshipping, BigBuy, AliExpress…)"),
        supplier_url: S.str("URL de la fiche fournisseur trouvée, ou vide"),
        supplier_keywords_en: S.str("2 à 5 mots-clés anglais pour retrouver ce produit dans le catalogue CJ Dropshipping, ex. « cat water fountain silent »"),
        seo_title: S.str("Titre Google de 55 caractères maximum"),
        seo_description: S.str("Description Google de 150 caractères environ"),
      }),
      "Une fiche par produit demandé",
    ),
  }),
};

const GUIDE_TOOL = {
  name: "ecrire_guide",
  description: "Enregistre le guide de conseil.",
  schema: S.obj({
    title: S.str("Titre = la question posée"),
    excerpt: S.str("La réponse directe en 1 ou 2 phrases"),
    body: S.str("Article de 5 000 à 8 000 caractères, intertitres ## en questions, listes, liens [texte](/produits/adresse) vers 1 à 3 produits"),
    product_titles: S.arr(S.str("Titre exact d'un produit cité"), "Produits cités"),
    seo_title: S.str("Titre Google de 60 caractères maximum"),
    seo_description: S.str("Description Google d'environ 150 caractères"),
  }),
};

export async function buildSite(ctx: Ctx, input: BuildInput) {
  const sites = await db.listSites();
  let id = slugify(input.name).replace(/-/g, "").slice(0, 20) || "boutique";
  while (sites.some((s) => s.id === id)) id = `${id}${Math.floor(Math.random() * 90 + 10)}`;
  const legal = sites[0]?.legal ?? {
    company: "À compléter",
    siret: "",
    address: "",
    email: `contact@${input.domain}`,
    host: "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
  };

  // 1. Textes et fiches produits
  ctx.log(`Rédaction de la boutique et de ${input.products.length} fiches produits${hasClaude() ? ", avec recherche des fournisseurs" : ""}…`);
  const gen = hasClaude()
    ? (
        await structured<{ site: GenSite; products: GenProduct[] }>({
          system: WRITER_SYSTEM,
          tool: SITE_TOOL,
          searches: 8,
          log: ctx.log,
          maxTokens: 24000,
          prompt: `Boutique « ${input.name} » (${input.domain}), niche : ${input.niche}. Accroche : ${input.tagline}.
Produit d'appel : ${input.product}. Précisions : ${input.notes || "aucune"}.
Livraison : ${input.countries.join(", ")}, ${input.delay}. Retours : ${input.return_days} jours.
Fiches à écrire (dans cet ordre) :
${input.products.map((p, i) => `${i + 1}. ${p}`).join("\n")}
Cherche pour chaque produit une fiche chez un fournisseur dropshipping qui livre en Europe pour estimer le coût et relever les vraies caractéristiques, et regarde les prix pratiqués en France.`,
        })
      ).data
    : demoBuild(input);

  const site: Site = {
    id,
    name: input.name,
    domain: input.domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, ""),
    tagline: input.tagline,
    description: gen.site.description,
    hero_title: gen.site.hero_title,
    hero_text: gen.site.hero_text,
    hero_product_id: null,
    theme: {
      background: input.palette.background,
      ink: input.palette.ink,
      primary: input.palette.primary,
      accent: input.palette.accent,
      font: input.palette.font,
      template: "studio",
    },
    legal: { ...legal, email: `contact@${input.domain}` },
    shipping: { flat_cents: input.flat_cents, free_from_cents: input.free_from_cents, delay: input.delay, countries: input.countries },
    return_days: Math.max(14, input.return_days),
    faq: gen.site.faq ?? [],
    active: true,
    created_at: new Date().toISOString(),
  };
  await db.saveSite(site);
  ctx.log(`Boutique « ${site.name} » créée.`);

  const saved: Product[] = [];
  for (const [i, p] of (gen.products ?? []).entries()) {
    const cents = (n: number | null | undefined) => (n && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null);
    saved.push(
      await db.saveProduct({
        site_id: id,
        slug: slugify(p.title),
        title: p.title,
        subtitle: p.subtitle ?? "",
        description: p.description ?? "",
        highlights: (p.highlights ?? []).slice(0, 5),
        specs: (p.specs ?? []).filter((s) => s.label && s.value),
        faq: p.faq ?? [],
        category: p.category ?? "",
        price_cents: cents(p.price_eur) ?? 2990,
        compare_at_cents: null,
        cost_cents: cents(p.cost_estimate_eur),
        stock: null,
        images: [],
        sku: `${id.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
        gtin: "",
        brand: "",
        supplier: p.supplier ?? "",
        supplier_url: /^https?:\/\//.test(p.supplier_url ?? "") ? p.supplier_url : "",
        seo_title: (p.seo_title ?? "").slice(0, 70),
        seo_description: (p.seo_description ?? "").slice(0, 170),
        active: true,
        position: i,
      }),
    );
  }
  if (saved[0]) await db.saveSite({ ...site, hero_product_id: saved[0].id });
  ctx.log(`${saved.length} fiches produits enregistrées.`);

  // 1 bis. Agent Catalogue + agent Images : produit réel chez CJ, prix d'achat, photos contrôlées et rangées chez nous
  if (hasCJ()) {
    ctx.log("Recherche des produits chez CJ et récupération des photos…");
    let withImages = 0;
    for (const [i, p] of saved.entries()) {
      const r = await sourceProduct(p, gen.products?.[i]?.supplier_keywords_en ?? "", ctx.log);
      if (r.images) withImages++;
    }
    ctx.log(`${withImages} produit(s) sur ${saved.length} avec des photos du fournisseur.`);
  } else ctx.log("Sans CJ_API_KEY : les photos sont à ajouter dans chaque fiche produit (section Images).");

  // 2. Guides
  let guidesCount = 0;
  if (input.guides.length) {
    ctx.log(`Rédaction de ${input.guides.length} guides optimisés pour Google et les IA…`);
    const catalog = saved.map((p) => `- ${p.title} : /produits/${p.slug}`).join("\n");
    // un appel par guide, en parallèle : plus rapide
    const guides = hasClaude()
      ? (
          await Promise.all(
            input.guides.map((title) =>
              structured<GenGuide>({
                system: WRITER_SYSTEM,
                tool: GUIDE_TOOL,
                searches: 2,
                log: ctx.log,
                maxTokens: 8000,
                prompt: `Boutique « ${site.name} » : ${site.description}
Produits (titre : adresse) :
${catalog}
Écris le guide « ${title} ». Vérifie rapidement ce que les gens demandent sur ce sujet pour couvrir les vraies questions.`,
              })
                .then((r) => r.data)
                .catch((e) => {
                  ctx.log(`Guide « ${title} » : échec (${(e as Error).message}).`);
                  return null;
                }),
            ),
          )
        ).filter((g): g is GenGuide => g !== null)
      : demoGuides(input, saved);
    for (const g of guides ?? []) {
      await db.saveGuide({
        site_id: id,
        slug: slugify(g.title),
        title: g.title,
        excerpt: g.excerpt ?? "",
        body: g.body ?? "",
        product_ids: saved.filter((p) => (g.product_titles ?? []).includes(p.title)).map((p) => p.id),
        seo_title: (g.seo_title ?? "").slice(0, 70),
        seo_description: (g.seo_description ?? "").slice(0, 170),
        published: true,
        published_at: new Date().toISOString(),
      });
      guidesCount++;
    }
    ctx.log(`${guidesCount} guides publiés.`);
  }

  if (input.opportunity_id) await db.updateOpportunity(input.opportunity_id, { status: "lancee", site_id: id });
  revalidatePath("/", "layout");
  await pingIndexNow(site, [siteUrl(site), siteUrl(site, "/produits"), ...saved.map((p) => siteUrl(site, `/produits/${p.slug}`))]).catch(() => {});
  return { site_id: id, domain: site.domain, produits: saved.length, guides: guidesCount };
}

// ---------- Mode démo (sans clé API) : contenu modèle, pour tester le parcours ----------
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function demoProposal({ niche, product }: { niche: string; product: string }): Proposal {
  const word = cap((product || niche).split(/\s+/)[0].toLowerCase());
  const base = slugify(word);
  return {
    tagline: `${cap(niche)} : des produits choisis et des conseils clairs`,
    names: [
      { name: `Maison ${word}`, domain: `maison-${base}.fr`, why: "Simple et rassurant, évoque le fait-maison." },
      { name: `${word} & Co`, domain: `${base}-et-co.fr`, why: "Court, se retient facilement." },
      { name: `Le Petit ${word}`, domain: `le-petit-${base}.fr`, why: "Chaleureux, adapté à une petite boutique spécialisée." },
    ],
    palettes: [
      { label: "Nuit et braise", background: "#0c0c0c", ink: "#d7e2ea", primary: "#7621b0", accent: "#be4c00", font: "kanit" },
      { label: "Abysse et corail", background: "#0b0d12", ink: "#e3e8f2", primary: "#1f4fd1", accent: "#e0663f", font: "kanit" },
      { label: "Forêt et laiton", background: "#0a0f0c", ink: "#e4ece4", primary: "#1f7a52", accent: "#c99a2e", font: "kanit" },
    ],
    products: [product, `${product}, lot de 2`, `Housse de rechange pour ${product.toLowerCase()}`, `Coffret cadeau ${niche.toLowerCase()}`, `Accessoire de rangement ${niche.toLowerCase()}`, `${product}, format voyage`].map(
      (t) => ({ title: cap(t), why: "Complète la gamme (mode démo)." }),
    ),
    guides: [
      { title: `Comment choisir ${product.toLowerCase()} ?`, query: `choisir ${product.toLowerCase()}` },
      { title: `${cap(niche)} : les erreurs à éviter`, query: `${niche.toLowerCase()} erreurs` },
      { title: `Entretenir ${product.toLowerCase()} pour qu'il dure`, query: `entretien ${product.toLowerCase()}` },
    ],
  };
}

function demoBuild(input: BuildInput): { site: GenSite; products: GenProduct[] } {
  return {
    site: {
      description: `${input.name} vend ${input.product.toLowerCase()} et des accessoires autour de ${input.niche.toLowerCase()}. Livraison en ${input.delay}, retours sous ${input.return_days} jours.`,
      hero_title: input.tagline,
      hero_text: "Texte de démonstration : avec une clé API Claude, l'agent écrit ici une introduction adaptée à votre niche.",
      faq: [
        { q: "Quels sont les délais de livraison ?", a: `Comptez ${input.delay} après validation de la commande.` },
        { q: "Puis-je retourner un article ?", a: `Oui, vous avez ${input.return_days} jours après réception.` },
      ],
    },
    products: input.products.map((t, i) => ({
      title: t,
      subtitle: "Fiche de démonstration",
      category: cap(input.niche),
      description: `Fiche générée en mode démo pour « ${t} ».\n\n## À quoi ça sert\n\nAvec une clé API Claude, l'agent rédige ici une description originale de 700 à 1 200 caractères, après avoir vérifié les caractéristiques chez le fournisseur.\n\n## Ce que vous devez compléter\n\n- Les photos\n- Le lien fournisseur et le prix d'achat\n- Les caractéristiques exactes`,
      highlights: ["Point fort à préciser", "Livraison suivie", `Retours sous ${input.return_days} jours`],
      specs: [],
      faq: [{ q: "Question fréquente à compléter ?", a: "Réponse à compléter." }],
      price_eur: 24.9 + i * 5,
      compare_at_eur: null,
      cost_estimate_eur: 7 + i * 1.5,
      supplier: "À choisir",
      supplier_url: "",
      seo_title: t.slice(0, 55),
      seo_description: `${t} : description de démonstration à remplacer.`,
    })),
  };
}

function demoGuides(input: BuildInput, products: Product[]): GenGuide[] {
  return input.guides.map((g) => ({
    title: g,
    excerpt: "Guide de démonstration : avec une clé API, l'agent écrit un vrai article qui répond directement à la question.",
    body: `Ce guide a été créé en mode démo.\n\n## Que contiendra le vrai guide ?\n\nUne réponse directe dès la première phrase, des intertitres qui reprennent les questions des internautes, et des liens vers vos produits, par exemple [${products[0]?.title ?? "un produit"}](/produits/${products[0]?.slug ?? ""}).`,
    product_titles: products.slice(0, 2).map((p) => p.title),
    seo_title: g.slice(0, 60),
    seo_description: `${g} : guide de démonstration.`,
  }));
}
