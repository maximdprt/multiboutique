import "server-only";
// Agent de veille : chaque jour, cherche sur le web des niches et produits porteurs pour le marché français.
import { db } from "../db";
import type { Opportunity } from "../types";
import { hasClaude, S, structured } from "./claude";
import type { Ctx } from "./run";

type Found = Omit<Opportunity, "id" | "created_at" | "run_id" | "status" | "site_id">;

const SYSTEM = `Tu es l'analyste produit d'un e-commerçant français qui lance de petites boutiques de niche (dropshipping ou petit stock), très optimisées pour le référencement naturel et les moteurs IA.
Ta mission : repérer des opportunités concrètes et vérifiables. Règles :
- Marché : France, Belgique, Suisse francophone. Prix de vente visé 15 € à 80 €, produit léger, peu fragile, non saisonnier à l'extrême sauf si la fenêtre est maintenant.
- Évite : contrefaçons et marques déposées, produits réglementés ou à risque (cosmétiques, compléments alimentaires, médical, jouets pour moins de 3 ans, électrique sur secteur, armes, produits pour bébé), et les promesses de santé.
- Privilégie les niches où l'on peut écrire beaucoup de guides utiles (« comment… », « quel… choisir ») et où les premiers résultats Google sont faibles (forums, marketplaces, pages pauvres) : c'est là qu'une boutique neuve peut se classer vite.
- Appuie-toi sur des signaux publics : tendances de recherche, articles récents, sélections cadeaux, marketplaces, boutiques indépendantes qui vendent déjà ce produit. Cite les boutiques et les sources réellement trouvées, n'invente aucune URL.
- On s'inspire de ce qui marche (produit, angle, prix), on ne copie jamais les textes, photos ou marques d'un concurrent.
Écris en français, simplement.`;

const TOOL = {
  name: "enregistrer_opportunites",
  description: "Enregistre les opportunités trouvées, de la plus prometteuse à la moins prometteuse.",
  schema: S.obj({
    opportunites: S.arr(
      S.obj({
        niche: S.str("La niche, en quelques mots"),
        product: S.str("Le produit d'appel précis à vendre"),
        summary: S.str("Pourquoi c'est intéressant, en 2 phrases"),
        why_now: S.str("Pourquoi maintenant (saison, tendance, actualité)"),
        queries: S.arr(S.str("Requête"), "4 à 6 recherches Google longue traîne qu'une boutique neuve peut viser"),
        competition: S.enumOf(["faible", "moyenne", "forte"], "Concurrence sur ces requêtes dans Google"),
        price_range: S.str("Fourchette de prix de vente constatée, ex. 19 € à 29 €"),
        margin_hint: S.str("Coût d'achat estimé et marge, ex. Achat 4 € à 7 €"),
        score: S.num("Note de 0 à 100 : potentiel × facilité à se classer vite"),
        examples: S.arr(
          S.obj({ name: S.str("Nom de la boutique"), url: S.str("Adresse trouvée"), note: S.str("Ce qui marche chez elle") }),
          "1 à 3 boutiques qui vendent déjà ce produit",
        ),
        sources: S.arr(S.str("URL"), "Pages consultées qui appuient l'analyse"),
      }),
      "6 à 8 opportunités",
    ),
  }),
};

export async function runVeille(ctx: Ctx) {
  const [recent, sites] = await Promise.all([db.listOpportunities({ limit: 80 }), db.listSites()]);
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

  if (!hasClaude()) {
    ctx.log("Mode démo : pas de clé ANTHROPIC_API_KEY, ajout d'exemples.");
    const rows = demoIdeas(recent.map((r) => r.product));
    await db.addOpportunities(rows.map((r) => ({ ...r, run_id: ctx.runId, status: "nouvelle", site_id: null })));
    return { ajoutees: rows.length, demo: true };
  }

  ctx.log("Recherche des tendances et des boutiques qui vendent bien…");
  const { data, sources } = await structured<{ opportunites: Found[] }>({
    system: SYSTEM,
    tool: TOOL,
    searches: 14,
    log: ctx.log,
    prompt: `Nous sommes le ${today}.
Trouve 6 à 8 nouvelles opportunités de boutiques de niche à lancer dans les prochains jours.
Déjà proposées récemment (ne les répète pas) : ${recent.map((r) => r.product).join(" ; ") || "aucune"}.
Boutiques déjà ouvertes (évite les doublons) : ${sites.map((s) => `${s.name} (${s.tagline})`).join(" ; ") || "aucune"}.
Pour chaque opportunité, vérifie au moins une boutique qui vend déjà le produit et regarde qui occupe la première page Google sur les requêtes visées.`,
  });

  const rows = (data.opportunites ?? []).slice(0, 10).map((o) => ({
    ...o,
    score: Math.max(0, Math.min(100, Math.round(Number(o.score) || 50))),
    queries: (o.queries ?? []).slice(0, 8),
    examples: (o.examples ?? []).filter((e) => /^https?:\/\//.test(e.url)).slice(0, 3),
    sources: [...new Set([...(o.sources ?? []), ...sources])].filter((u) => /^https?:\/\//.test(u)).slice(0, 6),
    run_id: ctx.runId,
    status: "nouvelle" as const,
    site_id: null,
  }));
  await db.addOpportunities(rows);
  ctx.log(`${rows.length} opportunité(s) enregistrée(s).`);
  return { ajoutees: rows.length };
}

// ---------- Mode démo ----------
const IDEAS: Found[] = [
  {
    niche: "Rangement de l'entrée",
    product: "Porte-clés mural en bois avec vide-poche",
    summary: "Petit objet décoratif et pratique, facile à mettre en scène, beaucoup de déclinaisons possibles.",
    why_now: "Recherches stables, pic en septembre-octobre (emménagements) et en janvier.",
    queries: ["porte clé mural bois", "vide poche entrée", "organiser son entrée petit espace"],
    competition: "faible",
    price_range: "22 € à 35 €",
    margin_hint: "Achat 5 € à 9 €",
    score: 68,
    examples: [{ name: "Boutique d'exemple", url: "https://example.com", note: "Exemple de démonstration." }],
    sources: [],
  },
  {
    niche: "Café à la maison",
    product: "Moulin à café manuel à meules céramique",
    summary: "Public passionné, nombreuses questions techniques (mouture, réglages) idéales pour des guides.",
    why_now: "Idée cadeau de fin d'année très recherchée.",
    queries: ["moulin à café manuel", "quelle mouture pour cafetière italienne", "moulin café meule céramique"],
    competition: "moyenne",
    price_range: "29 € à 49 €",
    margin_hint: "Achat 9 € à 14 €",
    score: 66,
    examples: [{ name: "Boutique d'exemple", url: "https://example.com", note: "Exemple de démonstration." }],
    sources: [],
  },
  {
    niche: "Plantes d'intérieur",
    product: "Arrosage automatique par mèche pour vacances",
    summary: "Problème concret, réponse simple, contenu facile : « arroser ses plantes pendant les vacances ».",
    why_now: "Recherches fortes avant chaque période de vacances scolaires.",
    queries: ["arrosage automatique plante intérieur", "arroser plantes pendant vacances", "mèche arrosage plante"],
    competition: "faible",
    price_range: "14 € à 24 €",
    margin_hint: "Achat 2 € à 5 €",
    score: 63,
    examples: [{ name: "Boutique d'exemple", url: "https://example.com", note: "Exemple de démonstration." }],
    sources: [],
  },
];

function demoIdeas(already: string[]) {
  const fresh = IDEAS.filter((i) => !already.includes(i.product));
  return fresh.length ? fresh : [];
}
