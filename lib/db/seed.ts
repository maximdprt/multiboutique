// Données de démonstration : deux boutiques, leurs produits, leurs guides
// et ~4 mois de commandes générées, pour voir l'admin "vivant" dès le premier lancement.
import type { AnalyticsDay, Guide, Opportunity, Order, OrderItem, Product, Site } from "../types";
import { dayKeyOf } from "../dates";

const NOW = Date.now();
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const DAY = 86_400_000;

export const DEMO_SITES: Site[] = [
  {
    id: "bocal",
    name: "Bocal & Cie",
    domain: "bocal-et-cie.fr",
    tagline: "Rangement et conservation pour cuisines qui débordent",
    description:
      "Bocal & Cie vend des bocaux, boîtes de conservation et organiseurs de placard pour ranger une cuisine durablement. Livraison en France, Belgique, Suisse et Luxembourg, retours sous 30 jours.",
    hero_title: "Un placard rangé, ça tient en un samedi.",
    hero_text:
      "Bocaux hermétiques, boîtes en verre et organiseurs choisis pour durer. Tout est testé dans une vraie cuisine avant d'arriver ici.",
    hero_product_id: "p-bocal-1",
    theme: {
      background: "#f2f4ef",
      ink: "#17231b",
      primary: "#2d5a43",
      accent: "#b8901f",
      font: "serif",
    },
    legal: {
      company: "Votre Nom — Entrepreneur individuel",
      siret: "000 000 000 00000",
      address: "1 rue de l'Exemple, 75000 Paris",
      email: "contact@bocal-et-cie.fr",
      host: "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
    },
    shipping: {
      flat_cents: 490,
      free_from_cents: 4900,
      delay: "3 à 5 jours ouvrés",
      countries: ["FR", "BE", "CH", "LU"],
    },
    return_days: 30,
    faq: [
      {
        q: "Les bocaux passent-ils au lave-vaisselle ?",
        a: "Oui, le verre et les joints passent au lave-vaisselle. Les couvercles en bambou se lavent à la main pour ne pas se fendre.",
      },
      {
        q: "Combien de temps prend la livraison ?",
        a: "Comptez 3 à 5 jours ouvrés en France métropolitaine. La livraison est offerte dès 49 € d'achat.",
      },
      {
        q: "Puis-je retourner un produit ?",
        a: "Vous avez 30 jours après réception pour nous retourner un article non utilisé. Le remboursement part dès que le colis nous revient.",
      },
    ],
    active: true,
    created_at: iso(140 * DAY),
  },
  {
    id: "chat",
    name: "Chat Perché",
    domain: "chat-perche.fr",
    tagline: "Accessoires pour chats d'intérieur, testés par des chats d'intérieur",
    description:
      "Chat Perché vend des fontaines, griffoirs, arbres et jouets pour chats d'appartement. Chaque produit est choisi pour répondre à un besoin précis : boire, griffer, grimper, chasser.",
    hero_title: "Un chat d'appartement a besoin de grimper, griffer et chasser.",
    hero_text:
      "On sélectionne des accessoires qui répondent à ces besoins sans encombrer votre salon. Livraison en 4 à 6 jours, retours gratuits.",
    hero_product_id: "p-chat-1",
    // Exemple du gabarit Studio (sombre, Kanit, dégradé violet et orange)
    theme: {
      background: "#0c0c0c",
      ink: "#d7e2ea",
      primary: "#7621b0",
      accent: "#be4c00",
      font: "kanit",
      template: "studio",
    },
    legal: {
      company: "Votre Nom — Entrepreneur individuel",
      siret: "000 000 000 00000",
      address: "1 rue de l'Exemple, 75000 Paris",
      email: "bonjour@chat-perche.fr",
      host: "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
    },
    shipping: {
      flat_cents: 590,
      free_from_cents: 5000,
      delay: "4 à 6 jours ouvrés",
      countries: ["FR", "BE", "LU"],
    },
    return_days: 14,
    faq: [
      {
        q: "Mon chat va-t-il vraiment utiliser une fontaine ?",
        a: "La plupart des chats préfèrent l'eau qui bouge. Placez la fontaine loin de la gamelle de nourriture et de la litière, et laissez-lui quelques jours pour s'habituer.",
      },
      {
        q: "Les produits conviennent-ils aux chatons ?",
        a: "Oui, sauf mention contraire sur la fiche. Pour les jouets avec ficelle ou plume, gardez toujours un œil sur votre chaton pendant le jeu.",
      },
      {
        q: "Combien coûte la livraison ?",
        a: "5,90 € en France, offerte dès 50 € d'achat. Les commandes partent sous 24 h ouvrées.",
      },
    ],
    active: true,
    created_at: iso(110 * DAY),
  },
];

type P = Omit<Product, "created_at" | "updated_at" | "position" | "active" | "gtin" | "brand" | "seo_title" | "seo_description"> &
  Partial<Product>;

const base = (p: P, i: number): Product => ({
  active: true,
  gtin: "",
  brand: "",
  seo_title: "",
  seo_description: "",
  position: i,
  created_at: iso((100 - i) * DAY),
  updated_at: iso((100 - i) * DAY),
  ...p,
});

export const DEMO_PRODUCTS: Product[] = [
  // ---------- Bocal & Cie ----------
  {
    id: "p-bocal-1",
    site_id: "bocal",
    slug: "bocaux-verre-hermetiques-lot-6",
    title: "Bocaux en verre hermétiques, lot de 6",
    subtitle: "1 litre, couvercle à levier et joint silicone",
    description:
      "Ces bocaux gardent les pâtes, le riz et les farines à l'abri de l'humidité et des mites alimentaires. Le couvercle à levier se ferme d'une main et le joint en silicone alimentaire se retire pour le lavage.\n\n## Pour quoi faire\n\n- Ranger les féculents et les céréales du placard\n- Conserver les légumineuses sèches plusieurs mois\n- Voir d'un coup d'œil ce qu'il reste\n\nLe verre est épais de 4 mm : il supporte le lave-vaisselle et ne garde ni odeur ni couleur, contrairement au plastique.",
    highlights: ["Joint silicone alimentaire amovible", "Verre de 4 mm, lave-vaisselle", "Fermeture d'une seule main"],
    specs: [
      { label: "Contenance", value: "1 L par bocal" },
      { label: "Dimensions", value: "10,5 × 10,5 × 17 cm" },
      { label: "Matières", value: "Verre sodocalcique, acier inoxydable, silicone" },
      { label: "Lave-vaisselle", value: "Oui (bocal et joint)" },
    ],
    faq: [
      { q: "Le joint est-il vraiment étanche ?", a: "Oui pour l'air et l'humidité. Pour des liquides, gardez le bocal debout : il n'est pas conçu pour être transporté couché." },
      { q: "Peut-on faire des conserves stérilisées avec ?", a: "Non, ces bocaux sont faits pour le rangement à sec. Pour la stérilisation, il faut des bocaux à joint caoutchouc prévus pour la cuisson." },
    ],
    category: "Bocaux",
    price_cents: 3490,
    compare_at_cents: 4290,
    cost_cents: 1120,
    stock: null,
    images: ["/demo/bocal-1.svg"],
    sku: "BOC-001",
    supplier: "CJ Dropshipping",
    supplier_url: "https://example.com/fournisseur/bocaux",
  },
  {
    id: "p-bocal-2",
    site_id: "bocal",
    slug: "organiseur-epices-extensible",
    title: "Organiseur à épices extensible",
    subtitle: "3 marches, de 25 à 48 cm de large",
    description:
      "Les épices rangées en rang sur une seule ligne finissent toujours cachées les unes derrière les autres. Ce gradin en trois marches s'étire pour s'adapter à la largeur de votre placard et met chaque étiquette à hauteur d'œil.\n\nIl se pose sans vis et accueille environ 18 petits pots standards.",
    highlights: ["S'adapte de 25 à 48 cm", "Environ 18 pots", "Sans vis ni perçage"],
    specs: [
      { label: "Largeur", value: "25 à 48 cm" },
      { label: "Profondeur", value: "23 cm" },
      { label: "Hauteur", value: "9 cm" },
      { label: "Matière", value: "Acier laqué" },
    ],
    faq: [{ q: "Est-ce que ça tient dans un tiroir ?", a: "Oui, à condition que le tiroir fasse au moins 10 cm de haut." }],
    category: "Organisation",
    price_cents: 2490,
    compare_at_cents: null,
    cost_cents: 740,
    stock: null,
    images: ["/demo/bocal-2.svg"],
    sku: "BOC-002",
    supplier: "CJ Dropshipping",
    supplier_url: "https://example.com/fournisseur/epices",
  },
  {
    id: "p-bocal-3",
    site_id: "bocal",
    slug: "boites-conservation-verre-bambou-lot-5",
    title: "Boîtes de conservation en verre, lot de 5",
    subtitle: "Verre borosilicate, couvercles en bambou",
    description:
      "Des boîtes qui passent du frigo au four (sans le couvercle) et qui s'empilent sans glisser. Le verre borosilicate supporte les écarts de température, et le bambou évite le plastique au contact des aliments.\n\n## Les tailles du lot\n\n- 2 boîtes de 370 ml\n- 2 boîtes de 640 ml\n- 1 boîte de 1 040 ml",
    highlights: ["Verre borosilicate, four jusqu'à 400 °C", "Couvercles en bambou", "Empilables"],
    specs: [
      { label: "Contenances", value: "370 ml, 640 ml, 1 040 ml" },
      { label: "Four", value: "Oui, sans le couvercle" },
      { label: "Micro-ondes", value: "Oui, sans le couvercle" },
      { label: "Lave-vaisselle", value: "Verre uniquement" },
    ],
    faq: [],
    category: "Conservation",
    price_cents: 3990,
    compare_at_cents: null,
    cost_cents: 1350,
    stock: 42,
    images: ["/demo/bocal-3.svg"],
    sku: "BOC-003",
    supplier: "BigBuy",
    supplier_url: "https://example.com/fournisseur/boites",
  },
  {
    id: "p-bocal-4",
    site_id: "bocal",
    slug: "distributeur-cereales-double",
    title: "Distributeur de céréales double",
    subtitle: "2 × 3,5 L, dose réglable",
    description:
      "Deux réservoirs côte à côte, une molette chacun : les céréales restent croquantes et sortent sans renverser la boîte entière. Pratique aussi pour le riz, les lentilles ou les croquettes.",
    highlights: ["2 réservoirs de 3,5 L", "Molette sans effort", "Démontable pour le lavage"],
    specs: [
      { label: "Contenance", value: "2 × 3,5 L" },
      { label: "Dimensions", value: "33 × 16 × 37 cm" },
      { label: "Matière", value: "Plastique ABS sans BPA" },
    ],
    faq: [],
    category: "Organisation",
    price_cents: 2990,
    compare_at_cents: 3490,
    cost_cents: 980,
    stock: null,
    images: ["/demo/bocal-4.svg"],
    sku: "BOC-004",
    supplier: "CJ Dropshipping",
    supplier_url: "https://example.com/fournisseur/cereales",
  },
  {
    id: "p-bocal-5",
    site_id: "bocal",
    slug: "etiquettes-ardoise-reutilisables",
    title: "Étiquettes ardoise réutilisables",
    subtitle: "60 étiquettes et 1 feutre craie",
    description:
      "Des étiquettes noires mates à coller sur vos bocaux, qui s'écrivent au feutre craie et s'effacent avec une éponge humide. Elles tiennent au lavage à la main.",
    highlights: ["60 étiquettes, 3 formats", "Feutre craie inclus", "Effaçables à l'eau"],
    specs: [
      { label: "Formats", value: "5 × 3,5 cm, 7 × 5 cm, 9 × 6 cm" },
      { label: "Contenu", value: "60 étiquettes, 1 feutre blanc" },
    ],
    faq: [],
    category: "Accessoires",
    price_cents: 1290,
    compare_at_cents: null,
    cost_cents: 210,
    stock: 180,
    images: ["/demo/bocal-5.svg"],
    sku: "BOC-005",
    supplier: "AliExpress",
    supplier_url: "https://example.com/fournisseur/etiquettes",
  },
  {
    id: "p-bocal-6",
    site_id: "bocal",
    slug: "tiroirs-coulissants-sous-evier",
    title: "Tiroirs coulissants sous évier",
    subtitle: "2 niveaux, contourne le siphon",
    description:
      "Le dessous d'évier est l'endroit le plus mal rangé de la cuisine. Ces deux bacs coulissants se glissent de part et d'autre du siphon et sortent entièrement pour attraper le produit du fond.",
    highlights: ["2 bacs coulissants", "Passe autour du siphon", "Montage sans outil"],
    specs: [
      { label: "Dimensions", value: "40 × 26 × 37 cm" },
      { label: "Charge", value: "8 kg par bac" },
    ],
    faq: [],
    category: "Organisation",
    price_cents: 3290,
    compare_at_cents: null,
    cost_cents: 1190,
    stock: 6,
    images: ["/demo/bocal-6.svg"],
    sku: "BOC-006",
    supplier: "BigBuy",
    supplier_url: "https://example.com/fournisseur/sous-evier",
  },
  // ---------- Chat Perché ----------
  {
    id: "p-chat-1",
    site_id: "chat",
    slug: "fontaine-eau-silencieuse-2-5l",
    title: "Fontaine à eau silencieuse 2,5 L",
    subtitle: "Pompe à moins de 30 dB, filtre charbon",
    description:
      "Beaucoup de chats boudent l'eau stagnante de leur gamelle. Cette fontaine fait circuler l'eau en continu à travers un filtre, ce qui encourage à boire plus souvent.\n\n## Ce qui change au quotidien\n\n- Un remplissage tous les 4 à 7 jours pour un chat\n- Une pompe qu'on n'entend pas la nuit\n- Un voyant qui prévient quand l'eau manque\n\nLe filtre se change toutes les 3 à 4 semaines.",
    highlights: ["Moins de 30 dB", "Filtre charbon et mousse", "Voyant de niveau d'eau"],
    specs: [
      { label: "Contenance", value: "2,5 L" },
      { label: "Alimentation", value: "USB 5 V, câble 1,5 m" },
      { label: "Dimensions", value: "19 × 19 × 13 cm" },
      { label: "Filtres inclus", value: "2" },
    ],
    faq: [
      { q: "Est-ce que ça remplace la visite chez le vétérinaire ?", a: "Non. Si votre chat boit soudain beaucoup plus ou beaucoup moins, parlez-en à votre vétérinaire." },
      { q: "Faut-il un adaptateur secteur ?", a: "Le câble est en USB : n'importe quel chargeur de téléphone convient." },
    ],
    category: "Boire et manger",
    price_cents: 3990,
    compare_at_cents: 4990,
    cost_cents: 1240,
    stock: null,
    images: ["/demo/chat-1.svg"],
    sku: "CHA-001",
    supplier: "CJ Dropshipping",
    supplier_url: "https://example.com/fournisseur/fontaine",
  },
  {
    id: "p-chat-2",
    site_id: "chat",
    slug: "griffoir-carton-incline",
    title: "Griffoir en carton incliné",
    subtitle: "Carton ondulé recyclé, réversible",
    description:
      "Un griffoir posé au sol, en pente douce, que le chat attaque en s'étirant. Le carton est réversible : quand une face est usée, on le retourne.",
    highlights: ["Réversible", "Herbe à chat incluse", "Carton recyclé"],
    specs: [
      { label: "Dimensions", value: "48 × 24 × 12 cm" },
      { label: "Matière", value: "Carton ondulé recyclé" },
    ],
    faq: [],
    category: "Griffer",
    price_cents: 1990,
    compare_at_cents: null,
    cost_cents: 480,
    stock: 64,
    images: ["/demo/chat-2.svg"],
    sku: "CHA-002",
    supplier: "BigBuy",
    supplier_url: "https://example.com/fournisseur/griffoir",
  },
  {
    id: "p-chat-3",
    site_id: "chat",
    slug: "arbre-a-chat-compact-3-niveaux",
    title: "Arbre à chat compact, 3 niveaux",
    subtitle: "95 cm, emprise au sol 40 × 40 cm",
    description:
      "Trois plateformes, une niche et deux poteaux en sisal sur moins d'un demi-mètre carré. Pensé pour les appartements où chaque centimètre compte.",
    highlights: ["95 cm de haut", "Poteaux en sisal naturel", "Niche fermée"],
    specs: [
      { label: "Hauteur", value: "95 cm" },
      { label: "Emprise au sol", value: "40 × 40 cm" },
      { label: "Poids max. conseillé", value: "8 kg" },
    ],
    faq: [{ q: "Faut-il le fixer au mur ?", a: "Ce n'est pas obligatoire à cette hauteur, mais une attache murale est fournie pour les chats très sauteurs." }],
    category: "Grimper",
    price_cents: 6990,
    compare_at_cents: null,
    cost_cents: 2600,
    stock: 12,
    images: ["/demo/chat-3.svg"],
    sku: "CHA-003",
    supplier: "BigBuy",
    supplier_url: "https://example.com/fournisseur/arbre",
  },
  {
    id: "p-chat-4",
    site_id: "chat",
    slug: "hamac-fenetre-ventouses",
    title: "Hamac de fenêtre à ventouses",
    subtitle: "Supporte 18 kg, se pose sans perçage",
    description:
      "Quatre ventouses industrielles, un hamac en toile lavable : votre chat surveille la rue au soleil, sans occuper le rebord.",
    highlights: ["Jusqu'à 18 kg", "Housse lavable", "Sans perçage"],
    specs: [
      { label: "Dimensions", value: "55 × 35 cm" },
      { label: "Charge max.", value: "18 kg" },
    ],
    faq: [{ q: "Ça tient sur du double vitrage ?", a: "Oui, sur toute vitre lisse et propre. Nettoyez la vitre à l'alcool avant la pose." }],
    category: "Se reposer",
    price_cents: 2790,
    compare_at_cents: null,
    cost_cents: 790,
    stock: null,
    images: ["/demo/chat-4.svg"],
    sku: "CHA-004",
    supplier: "AliExpress",
    supplier_url: "https://example.com/fournisseur/hamac",
  },
  {
    id: "p-chat-5",
    site_id: "chat",
    slug: "jouet-plume-interactif",
    title: "Jouet plume interactif",
    subtitle: "Mouvements aléatoires, arrêt automatique",
    description:
      "Une plume qui tourne et se cache sous un disque, à un rythme imprévisible. De quoi occuper un chat seul pendant les heures de bureau. Arrêt automatique après 10 minutes pour ne pas lasser.",
    highlights: ["Rythme aléatoire", "Arrêt après 10 min", "Rechargeable USB"],
    specs: [
      { label: "Autonomie", value: "Environ 8 h d'usage" },
      { label: "Plumes de rechange", value: "3" },
    ],
    faq: [],
    category: "Jouer",
    price_cents: 2290,
    compare_at_cents: 2790,
    cost_cents: 630,
    stock: null,
    images: ["/demo/chat-5.svg"],
    sku: "CHA-005",
    supplier: "CJ Dropshipping",
    supplier_url: "https://example.com/fournisseur/plume",
  },
  {
    id: "p-chat-6",
    site_id: "chat",
    slug: "tapis-litiere-double-couche",
    title: "Tapis de litière double couche",
    subtitle: "Retient les grains, imperméable",
    description:
      "Les grains de litière tombent à travers la grille du dessus et restent piégés dans la poche du dessous. Il suffit d'ouvrir le tapis pour le vider.",
    highlights: ["Piège à grains en nid d'abeille", "Imperméable", "Se vide en 10 secondes"],
    specs: [
      { label: "Dimensions", value: "60 × 45 cm" },
      { label: "Matière", value: "EVA sans phtalates" },
    ],
    faq: [],
    category: "Hygiène",
    price_cents: 2190,
    compare_at_cents: null,
    cost_cents: 540,
    stock: 3,
    images: ["/demo/chat-6.svg"],
    sku: "CHA-006",
    supplier: "AliExpress",
    supplier_url: "https://example.com/fournisseur/tapis",
  },
].map((p, i) => base(p as P, i % 6));

export const DEMO_GUIDES: Guide[] = [
  {
    id: "g-bocal-1",
    site_id: "bocal",
    slug: "ranger-placard-cuisine-en-un-apres-midi",
    title: "Ranger un placard de cuisine en un après-midi",
    excerpt: "Une méthode en quatre étapes pour vider, trier et réorganiser un placard sans tout racheter.",
    body:
      "Ranger un placard de cuisine ne demande pas un week-end entier. Avec un peu de méthode, un après-midi suffit.\n\n## 1. Tout sortir\n\nVidez complètement le placard et posez tout sur la table. C'est le seul moyen de voir ce que vous avez vraiment, y compris les trois paquets de lentilles entamés.\n\n## 2. Trier par usage\n\nFaites trois tas : ce que vous utilisez chaque semaine, ce que vous utilisez parfois, et ce qui est périmé ou que vous n'utiliserez jamais.\n\n## 3. Passer en contenants transparents\n\nTransvaser les féculents et céréales dans des **bocaux hermétiques** évite les mites alimentaires et montre d'un coup d'œil ce qui manque. Collez une étiquette avec le nom et la date d'ouverture.\n\n## 4. Ranger par hauteur\n\nLes produits du quotidien à hauteur d'yeux, les réserves en haut, le lourd en bas. Un **gradin à épices** évite que les petits pots se cachent au fond.\n\n## Combien de bocaux prévoir ?\n\nPour une famille de quatre, comptez en général 8 à 12 bocaux d'un litre pour les féculents, céréales et légumineuses.",
    product_ids: ["p-bocal-1", "p-bocal-2", "p-bocal-5"],
    seo_title: "Ranger un placard de cuisine : la méthode en 4 étapes",
    seo_description: "Vider, trier, passer en bocaux, ranger par hauteur : la méthode simple pour un placard de cuisine organisé en un après-midi.",
    published: true,
    published_at: iso(60 * DAY),
    updated_at: iso(20 * DAY),
  },
  {
    id: "g-bocal-2",
    site_id: "bocal",
    slug: "conserver-aliments-secs-verre-ou-plastique",
    title: "Aliments secs : verre ou plastique ?",
    excerpt: "Ce qui compte vraiment pour bien conserver pâtes, riz et farines, et pourquoi le joint compte plus que la matière.",
    body:
      "Pour les aliments secs, la vraie question n'est pas le verre ou le plastique, c'est l'étanchéité.\n\n## Ce qui abîme les aliments secs\n\n- L'humidité, qui ramollit et fait grumeler\n- Les mites alimentaires, qui passent par les emballages ouverts\n- La lumière, pour les épices et les huiles\n\n## Le verre\n\nIl ne garde aucune odeur, se lave à haute température et dure des décennies. Il est plus lourd et peut casser.\n\n## Le plastique\n\nPlus léger et incassable, mais il se raye et peut garder les odeurs. Choisissez-le sans BPA.\n\n## Notre conseil\n\nVerre à joint silicone pour le placard, plastique pour les distributeurs et ce qui doit être manipulé souvent.",
    product_ids: ["p-bocal-1", "p-bocal-3", "p-bocal-4"],
    seo_title: "",
    seo_description: "",
    published: true,
    published_at: iso(30 * DAY),
    updated_at: iso(30 * DAY),
  },
  {
    id: "g-chat-1",
    site_id: "chat",
    slug: "chat-boit-peu-comment-l-aider",
    title: "Votre chat boit peu : comment l'encourager",
    excerpt: "Pourquoi beaucoup de chats boivent trop peu, et cinq gestes simples pour les aider à boire davantage.",
    body:
      "Le chat descend d'animaux du désert qui tiraient l'essentiel de leur eau de leurs proies. Résultat : beaucoup de chats d'intérieur nourris aux croquettes boivent moins qu'ils ne devraient.\n\n## Cinq gestes qui aident\n\n- Éloigner l'eau de la nourriture : dans la nature, le chat ne boit pas près de sa proie\n- Multiplier les points d'eau dans l'appartement\n- Préférer une gamelle large, qui ne touche pas les moustaches\n- Proposer de l'eau qui bouge, avec une **fontaine**\n- Ajouter de la nourriture humide, si votre vétérinaire est d'accord\n\n## Quand s'inquiéter\n\nUn changement brutal de consommation d'eau, dans un sens ou dans l'autre, mérite toujours un avis vétérinaire.",
    product_ids: ["p-chat-1"],
    seo_title: "Chat qui boit peu : 5 gestes pour l'aider à boire",
    seo_description: "Pourquoi les chats boivent souvent trop peu et comment les encourager : points d'eau, fontaine, gamelle large. Conseils simples.",
    published: true,
    published_at: iso(45 * DAY),
    updated_at: iso(45 * DAY),
  },
  {
    id: "g-chat-2",
    site_id: "chat",
    slug: "quel-griffoir-choisir",
    title: "Quel griffoir choisir pour son chat ?",
    excerpt: "Horizontal, incliné ou vertical : le bon griffoir dépend de la façon dont votre chat griffe déjà vos meubles.",
    body:
      "Le meilleur indice pour choisir un griffoir, c'est ce que votre chat abîme déjà.\n\n## Il griffe le canapé, debout\n\nIl aime griffer à la verticale. Il lui faut un poteau stable et assez haut pour qu'il s'étire complètement, comme sur un **arbre à chat**.\n\n## Il griffe le tapis\n\nIl préfère l'horizontale. Un **griffoir en carton** posé au sol fera l'affaire.\n\n## Où le placer\n\nJuste à côté de l'endroit qu'il abîme, puis déplacez-le petit à petit. Les chats griffent aussi au réveil : un griffoir près de son couchage est souvent adopté.",
    product_ids: ["p-chat-2", "p-chat-3"],
    seo_title: "",
    seo_description: "",
    published: true,
    published_at: iso(15 * DAY),
    updated_at: iso(15 * DAY),
  },
];

// ---------- Commandes générées ----------
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const FIRST = ["Camille", "Léa", "Hugo", "Manon", "Lucas", "Chloé", "Nathan", "Inès", "Louis", "Sarah", "Jules", "Emma", "Théo", "Zoé", "Adam", "Julie", "Paul", "Alice", "Mathis", "Clara"];
const LAST = ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel", "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier"];
const CITIES: [string, string][] = [["75011", "Paris"], ["69003", "Lyon"], ["13006", "Marseille"], ["33000", "Bordeaux"], ["44000", "Nantes"], ["31000", "Toulouse"], ["59000", "Lille"], ["67000", "Strasbourg"], ["35000", "Rennes"], ["06000", "Nice"], ["1000", "Bruxelles"]];

export function generateDemoOrders(): Order[] {
  const r = rng(42);
  const orders: Order[] = [];
  let number = 1001;
  const customers = Array.from({ length: 140 }, (_, i) => {
    const f = FIRST[Math.floor(r() * FIRST.length)];
    const l = LAST[Math.floor(r() * LAST.length)];
    const [postal, city] = CITIES[Math.floor(r() * CITIES.length)];
    return {
      name: `${f} ${l}`,
      email: `${f}.${l}${i}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + "@exemple.fr",
      address: { line1: `${1 + Math.floor(r() * 120)} rue de la République`, postal_code: postal, city, country: city === "Bruxelles" ? "BE" : "FR" },
    };
  });

  for (const site of DEMO_SITES) {
    const products = DEMO_PRODUCTS.filter((p) => p.site_id === site.id);
    const ageDays = Math.floor((NOW - Date.parse(site.created_at)) / DAY) - 10;
    for (let d = ageDays; d >= 0; d--) {
      // croissance progressive + effet week-end
      const growth = 1 + ((ageDays - d) / ageDays) * 2.2;
      const dow = new Date(NOW - d * DAY).getDay();
      const weekend = dow === 0 || dow === 6 ? 1.35 : 1;
      const expected = (site.id === "bocal" ? 1.6 : 1.1) * growth * weekend;
      const count = Math.max(0, Math.round(expected + (r() - 0.5) * 2.4));
      for (let k = 0; k < count; k++) {
        const c = customers[Math.floor(r() * (r() < 0.25 ? 20 : customers.length))];
        const nItems = r() < 0.7 ? 1 : r() < 0.8 ? 2 : 3;
        const chosen = new Map<string, OrderItem>();
        for (let j = 0; j < nItems; j++) {
          const p = products[Math.floor(Math.pow(r(), 1.6) * products.length)];
          const ex = chosen.get(p.id);
          if (ex) ex.quantity += 1;
          else
            chosen.set(p.id, {
              product_id: p.id,
              title: p.title,
              slug: p.slug,
              quantity: 1,
              unit_price_cents: p.price_cents,
              unit_cost_cents: p.cost_cents,
              supplier_url: p.supplier_url,
            });
        }
        const items = [...chosen.values()];
        const subtotal = items.reduce((s, i) => s + i.unit_price_cents * i.quantity, 0);
        const shipping = subtotal >= site.shipping.free_from_cents ? 0 : site.shipping.flat_cents;
        const at = NOW - d * DAY - Math.floor(r() * DAY * 0.9);
        const status: Order["status"] =
          r() < 0.03 ? "refunded" : d > 9 ? "delivered" : d > 4 ? "shipped" : d > 1 ? "sent_to_supplier" : "paid";
        orders.push({
          id: `o-${number}`,
          number: number++,
          site_id: site.id,
          stripe_session_id: null,
          stripe_payment_intent: null,
          email: c.email,
          name: c.name,
          phone: "",
          shipping_address: c.address,
          items,
          subtotal_cents: subtotal,
          shipping_cents: shipping,
          total_cents: subtotal + shipping,
          currency: "eur",
          status,
          tracking_number: status === "shipped" || status === "delivered" ? `LP${Math.floor(r() * 1e9)}FR` : "",
          tracking_url: "",
          notes: "",
          mode: "demo",
          created_at: new Date(at).toISOString(),
          updated_at: new Date(at).toISOString(),
        });
      }
    }
  }
  return orders.sort((a, b) => a.created_at.localeCompare(b.created_at)).map((o, i) => ({ ...o, number: 1001 + i, id: `o-${1001 + i}` }));
}

// ---------- Veille : exemples (mode démo uniquement) ----------
type O = Omit<Opportunity, "id" | "created_at" | "run_id" | "status" | "site_id" | "sources" | "examples">;
const opp = (o: O, daysAgo: number, i: number): Opportunity => ({
  ...o,
  id: `opp-demo-${i}`,
  created_at: iso(daysAgo * DAY + i * 60_000),
  run_id: null,
  status: "nouvelle",
  site_id: null,
  sources: [],
  examples: [{ name: "Boutique d'exemple", url: "https://example.com", note: "Exemple de démonstration : la veille réelle cite de vraies boutiques et ses sources." }],
});

export const DEMO_OPPORTUNITIES: Opportunity[] = [
  opp(
    {
      niche: "Confort d'hiver à la maison",
      product: "Bouillotte sèche aux graines de lin, housse amovible",
      summary: "Produit simple, léger, peu fragile, qui se vend d'octobre à février. Recherches stables chaque hiver et beaucoup de questions pratiques à transformer en guides.",
      why_now: "Début de la saison froide : les recherches montent dès la mi-octobre et culminent en décembre (idée cadeau).",
      queries: ["bouillotte graines de lin", "bouillotte sèche micro-ondes", "bouillotte nuque et épaules", "comment chauffer une bouillotte sèche"],
      competition: "moyenne",
      price_range: "19 € à 29 €",
      margin_hint: "Achat 4 € à 7 €, marge brute 60 à 70 %",
      score: 82,
    },
    0,
    1,
  ),
  opp(
    {
      niche: "Jardinage d'intérieur",
      product: "Kit de culture de micro-pousses sans terre",
      summary: "Niche éducative et visuelle, idéale pour des guides « comment faire pousser… ». Les kits se déclinent en recharges de graines, ce qui fait revenir les clients.",
      why_now: "L'hiver pousse les jardiniers à l'intérieur ; forte demande cadeau pour Noël.",
      queries: ["kit micro pousses", "faire pousser des micro pousses", "graines à germer bio", "germoir bocal"],
      competition: "faible",
      price_range: "24 € à 39 €",
      margin_hint: "Achat 7 € à 11 €, recharges à forte marge",
      score: 78,
    },
    0,
    2,
  ),
  opp(
    {
      niche: "Bien-être du chien",
      product: "Tapis de fouille et jouets d'occupation pour chien",
      summary: "Les propriétaires cherchent des solutions contre l'ennui et la gloutonnerie. Beaucoup de contenu possible (exercices, races, âge).",
      why_now: "Moins de promenades en hiver : les recherches « occuper son chien » augmentent.",
      queries: ["tapis de fouille chien", "occuper son chien en appartement", "jeu d'intelligence chien", "chien mange trop vite"],
      competition: "moyenne",
      price_range: "19 € à 34 €",
      margin_hint: "Achat 5 € à 9 €",
      score: 74,
    },
    0,
    3,
  ),
  opp(
    {
      niche: "Fêtes de fin d'année",
      product: "Calendrier de l'Avent en bois à remplir",
      summary: "Achat réutilisable chaque année, très saisonnier : il faut être en ligne avant le 1er novembre pour en profiter.",
      why_now: "Fenêtre courte : recherches fortes de mi-octobre à fin novembre.",
      queries: ["calendrier de l'avent à remplir bois", "calendrier avent réutilisable", "idées pour remplir calendrier de l'avent"],
      competition: "forte",
      price_range: "29 € à 49 €",
      margin_hint: "Achat 9 € à 15 €",
      score: 61,
    },
    1,
    4,
  ),
  opp(
    {
      niche: "Cuisine pratique",
      product: "Range-épices magnétique pour le réfrigérateur",
      summary: "Petit produit malin pour cuisines exiguës, très visuel sur Pinterest et TikTok, peu de concurrents qui font du contenu.",
      why_now: "Demande stable toute l'année, petit pic de rangement à la rentrée et en janvier.",
      queries: ["boite à épices magnétique", "rangement épices petite cuisine", "étagère magnétique frigo"],
      competition: "faible",
      price_range: "16 € à 26 €",
      margin_hint: "Achat 3 € à 6 €",
      score: 70,
    },
    1,
    5,
  ),
];

// ---------- Audience générée (cohérente avec les commandes) ----------
function spread(r: () => number, weights: [string, number][], total: number) {
  const out: Record<string, number> = {};
  const w = weights.map(([k, v]) => [k, v * (0.75 + r() * 0.5)] as [string, number]);
  const sum = w.reduce((s, [, v]) => s + v, 0);
  let left = total;
  w.forEach(([k, v], i) => {
    const n = i === w.length - 1 ? left : Math.min(left, Math.round((v / sum) * total));
    if (n > 0) out[k] = n;
    left -= n;
  });
  return out;
}

export function generateDemoAnalytics(orders: Order[]): AnalyticsDay[] {
  const r = rng(7);
  const perDay = new Map<string, number>();
  for (const o of orders) {
    const k = `${o.site_id}|${dayKeyOf(o.created_at)}`;
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const out: AnalyticsDay[] = [];
  for (const site of DEMO_SITES) {
    const products = DEMO_PRODUCTS.filter((p) => p.site_id === site.id);
    const guides = DEMO_GUIDES.filter((g) => g.site_id === site.id);
    const total = Math.floor((NOW - Date.parse(site.created_at)) / DAY);
    for (let d = total; d >= 0; d--) {
      const day = dayKeyOf(NOW - d * DAY);
      const progress = 1 - d / total;
      const n = perDay.get(`${site.id}|${day}`) ?? 0;
      const sessions = Math.max(12, Math.round(n / (0.017 + r() * 0.012) + (r() - 0.5) * 20 + 15 * progress));
      const pageviews = Math.round(sessions * (2.3 + r() * 0.8));
      const checkouts = Math.max(n, Math.round(sessions * (0.028 + r() * 0.012)));
      const ai = 0.03 + 0.11 * progress;
      out.push({
        site_id: site.id,
        day,
        sessions,
        visitors: Math.round(sessions * (0.86 + r() * 0.06)),
        pageviews,
        checkouts,
        add_to_cart: Math.max(checkouts, Math.round(sessions * (0.065 + r() * 0.03))),
        sources: spread(
          r,
          (
            [
              ["Google", 0.36 + 0.08 * progress],
              ["Direct", 0.2],
              ["Instagram", site.id === "chat" ? 0.12 : 0.06],
              ["TikTok", site.id === "chat" ? 0.08 : 0.03],
              ["Pinterest", site.id === "bocal" ? 0.1 : 0.03],
              ["Facebook", 0.04],
              ["Bing", 0.035],
              ["ChatGPT", ai * 0.6],
              ["Perplexity", ai * 0.2],
              ["Gemini", ai * 0.1],
              ["Claude", ai * 0.07],
              ["Copilot", ai * 0.03],
            ] as [string, number][]
          ),
          sessions,
        ),
        devices: spread(r, [["Mobile", 0.67], ["Ordinateur", 0.28], ["Tablette", 0.05]], sessions),
        countries: spread(r, [["FR", 0.86], ["BE", 0.07], ["CH", 0.03], ["LU", 0.015], ["CA", 0.01]], sessions),
        pages: spread(
          r,
          [
            ["/", 0.24],
            ["/produits", 0.12],
            ...products.map((p, i) => [`/produits/${p.slug}`, 0.1 / (1 + i * 0.35)] as [string, number]),
            ...guides.map((g) => [`/guides/${g.slug}`, 0.03 + 0.06 * progress] as [string, number]),
            ["/panier", 0.05],
          ],
          pageviews,
        ),
      });
    }
  }
  return out;
}
