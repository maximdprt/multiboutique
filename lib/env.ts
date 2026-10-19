// Variables d'environnement : validation (obligatoires, facultatives, format) et état de chaque service.
// Ne renvoie jamais la valeur d'un secret : seulement « configuré ou non » et ce qu'il faut corriger.
// Une variable vide compte comme absente. Rien ici ne bloque le site : le mode démo doit toujours démarrer.
import { z } from "zod";

type Source = Record<string, string | undefined>;

const blank = (v: unknown) => (typeof v === "string" ? v.trim() || undefined : v);
const opt = <T extends z.ZodType>(s: T) => z.preprocess(blank, s.optional());
const re = (pattern: RegExp, error: string) => z.string().regex(pattern, { error });
const bool = opt(z.enum(["true", "false"], { error: "Mettez true ou false." }));

function validTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Format de chaque variable (toutes facultatives prises une à une ; les obligations sont dans `rules`). */
export const ENV_FIELDS = {
  ADMIN_PASSWORD: opt(z.string().min(8, { error: "Au moins 8 caractères (un long mot de passe est préférable)." })),
  ADMIN_SECRET: opt(z.string().min(32, { error: "Au moins 32 caractères aléatoires." })),
  ADMIN_HOST: opt(re(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Un nom de domaine seul, sans https:// ni /, ex. admin.mondomaine.fr.")),

  SUPABASE_URL: opt(re(/^https:\/\/[^\s/]+\/?$/, "L'URL du projet, ex. https://abcd.supabase.co (Project Settings > API).")),
  SUPABASE_SERVICE_ROLE_KEY: opt(z.string().min(20, { error: "Clé trop courte : copiez la clé service_role entière." })),
  SUPABASE_DB_URL: opt(re(/^postgres(ql)?:\/\/\S+$/, "Doit commencer par postgresql:// (Supabase > Connect > Session pooler).")),

  STRIPE_SECRET_KEY: opt(re(/^(sk|rk)_(test|live)_\S+$/, "Doit commencer par sk_test_ ou sk_live_.")),
  STRIPE_WEBHOOK_SECRET: opt(re(/^whsec_\S+$/, "Doit commencer par whsec_.")),

  RESEND_API_KEY: opt(re(/^re_\S+$/, "Doit commencer par re_.")),
  EMAIL_FROM_LOCAL: opt(re(/^[a-z0-9._-]+$/i, "Seulement la partie avant le @, ex. commandes.")),
  REPORT_EMAIL: opt(z.email({ error: "Adresse e-mail invalide." })),
  REPORT_FROM: opt(re(/^(.+<)?[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}>?$/i, "Format attendu : Rapports <rapport@votre-domaine.fr>.")),

  ANTHROPIC_API_KEY: opt(re(/^sk-ant-\S+$/, "Doit commencer par sk-ant-.")),
  ANTHROPIC_MODEL: opt(re(/^claude-[a-z0-9.-]+$/, "Identifiant de modèle Claude, ex. claude-sonnet-5-5.")),
  AGENT_AUTOPUBLISH: bool,

  CRON_SECRET: opt(z.string().min(16, { error: "Au moins 16 caractères aléatoires." })),
  INDEXNOW_KEY: opt(re(/^[a-zA-Z0-9-]{8,128}$/, "8 à 128 lettres, chiffres ou tirets (32 caractères hexadécimaux conseillés).")),
  ADMIN_TIMEZONE: opt(z.string().refine(validTimeZone, { error: "Fuseau horaire inconnu, ex. Europe/Paris." })),

  CJ_API_KEY: opt(z.string().min(10, { error: "Clé trop courte : copiez la clé API CJ entière." })),
  CJ_PAY_MODE: opt(z.enum(["balance", "manual"], { error: "Mettez balance ou manual." })),
  AUTO_FULFILL_MAX_CENTS: opt(re(/^\d+$/, "Un nombre entier de centimes, ex. 15000 pour 150 €.")),
  AUTO_FULFILL: bool,

  TELEGRAM_BOT_TOKEN: opt(re(/^\d+:[\w-]{20,}$/, "Format attendu : 123456789:ABC… (donné par @BotFather).")),
  TELEGRAM_CHAT_ID: opt(re(/^-?\d+$/, "Un nombre (éventuellement négatif pour un groupe).")),
  ANALYTICS_SALT: opt(z.string().min(16, { error: "Au moins 16 caractères aléatoires." })),
  DEFAULT_SITE: opt(re(/^[a-z0-9-]+$/, "L'identifiant d'une boutique, ex. bocal.")),

  VERCEL_TOKEN: opt(re(/^[A-Za-z0-9_-]{20,}$/, "Jeton trop court ou mal copié (Vercel > Account Settings > Tokens).")),
  VERCEL_PROJECT_ID: opt(re(/^prj_[A-Za-z0-9]+$/, "Doit commencer par prj_ (Vercel > projet > Settings > General > Project ID).")),
  APP_URL: opt(re(/^https?:\/\/[^\s/]+\/?$/, "L'adresse du site, sans chemin, ex. https://multiboutique.vercel.app.")),
  VERCEL_TEAM_ID: opt(re(/^team_[A-Za-z0-9]+$/, "Doit commencer par team_ (Vercel > Settings de l'équipe > General > Team ID).")),
} as const;

export type EnvKey = keyof typeof ENV_FIELDS;
export type EnvIssue = { key: EnvKey; message: string };

const has = (s: Source, k: EnvKey) => Boolean(blank(s[k]));

/** Obligations qui dépendent d'autres variables. */
function rules(s: Source): EnvIssue[] {
  const out: EnvIssue[] = [];
  const need = (key: EnvKey, message: string) => out.push({ key, message });
  const supabase = has(s, "SUPABASE_URL") || has(s, "SUPABASE_SERVICE_ROLE_KEY");

  if (has(s, "SUPABASE_URL") && !has(s, "SUPABASE_SERVICE_ROLE_KEY")) need("SUPABASE_SERVICE_ROLE_KEY", "Obligatoire avec SUPABASE_URL.");
  if (has(s, "SUPABASE_SERVICE_ROLE_KEY") && !has(s, "SUPABASE_URL")) need("SUPABASE_URL", "Obligatoire avec SUPABASE_SERVICE_ROLE_KEY.");
  if (supabase && !has(s, "ADMIN_PASSWORD")) need("ADMIN_PASSWORD", "Obligatoire dès que Supabase est configuré : sans lui, personne ne peut se connecter à l'admin.");
  if ((supabase || has(s, "ADMIN_PASSWORD")) && !has(s, "ADMIN_SECRET"))
    need("ADMIN_SECRET", "Obligatoire en production : sinon les sessions sont signées avec une clé tirée du mot de passe.");
  if (has(s, "STRIPE_SECRET_KEY") && !has(s, "STRIPE_WEBHOOK_SECRET"))
    need("STRIPE_WEBHOOK_SECRET", "Obligatoire avec STRIPE_SECRET_KEY : sans lui, les paiements ne créent pas de commande.");
  if (has(s, "TELEGRAM_BOT_TOKEN") !== has(s, "TELEGRAM_CHAT_ID"))
    need(has(s, "TELEGRAM_BOT_TOKEN") ? "TELEGRAM_CHAT_ID" : "TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID vont ensemble.");
  if (has(s, "REPORT_EMAIL") && !has(s, "REPORT_FROM")) need("REPORT_FROM", "Obligatoire avec REPORT_EMAIL (expéditeur sur un domaine vérifié dans Resend).");
  if (has(s, "VERCEL_TOKEN") && !has(s, "VERCEL_PROJECT_ID")) need("VERCEL_PROJECT_ID", "Obligatoire avec VERCEL_TOKEN : c'est le projet auquel les domaines sont ajoutés.");
  if (has(s, "VERCEL_PROJECT_ID") && !has(s, "VERCEL_TOKEN")) need("VERCEL_TOKEN", "Obligatoire avec VERCEL_PROJECT_ID pour ajouter les domaines automatiquement.");
  if (supabase && s.VERCEL && !has(s, "CRON_SECRET")) need("CRON_SECRET", "Obligatoire sur Vercel : sans lui, les tâches planifiées sont refusées.");
  return out;
}

/** Schéma complet (format + obligations). */
export const envSchema = z.looseObject(ENV_FIELDS).superRefine((env, ctx) => {
  for (const i of rules(env as Source)) ctx.addIssue({ code: "custom", path: [i.key], message: i.message });
});

/** Valeurs valides et problèmes trouvés. Ne lève jamais d'erreur. */
export function readEnv(source: Source = process.env) {
  const values: Partial<Record<EnvKey, string>> = {};
  const issues: EnvIssue[] = [];
  for (const key of Object.keys(ENV_FIELDS) as EnvKey[]) {
    const r = ENV_FIELDS[key].safeParse(source[key]);
    if (!r.success) issues.push({ key, message: r.error.issues[0]?.message ?? "Valeur invalide." });
    else if (r.data !== undefined) values[key] = r.data;
  }
  for (const i of rules(source)) if (!issues.some((x) => x.key === i.key)) issues.push(i);
  const mode: "production" | "demo" = has(source, "SUPABASE_URL") && has(source, "SUPABASE_SERVICE_ROLE_KEY") ? "production" : "demo";
  return { values, issues, mode };
}

// ---------------------------------------------------------------------------
// État des services (page Réglages > État des services)
// ---------------------------------------------------------------------------

export type ServiceState = "ok" | "absent" | "a_corriger";
export type ServiceStatus = {
  id: string;
  name: string;
  role: string;
  /** Faut-il le configurer pour vendre en production ? */
  required: boolean;
  state: ServiceState;
  /** Ce qui est en place (jamais de secret) */
  detail: string;
  /** Problèmes de format ou d'obligation */
  problems: string[];
  /** Quoi faire, étape par étape, quand ce n'est pas configuré */
  todo: string[];
  vars: EnvKey[];
};

type Def = Omit<ServiceStatus, "state" | "problems" | "required" | "detail"> & {
  /** Variables qui doivent être présentes pour dire « configuré » */
  main: EnvKey[];
  required: (mode: "production" | "demo") => boolean;
  detail: (v: Partial<Record<EnvKey, string>>, mode: "production" | "demo") => string;
};

const VERCEL_VARS = "Ajoutez-la dans Vercel > projet > Settings > Environment Variables (et dans .env.local en local), puis redéployez.";

const DEFS: Def[] = [
  {
    id: "admin",
    name: "Connexion à l'admin",
    role: "Protège l'admin par un mot de passe et signe les sessions.",
    vars: ["ADMIN_PASSWORD", "ADMIN_SECRET", "ADMIN_HOST"],
    main: ["ADMIN_PASSWORD", "ADMIN_SECRET"],
    required: (m) => m === "production",
    detail: (v, m) =>
      v.ADMIN_PASSWORD
        ? `Mot de passe défini${v.ADMIN_HOST ? `, admin réservé au domaine ${v.ADMIN_HOST}` : ""}.`
        : m === "demo"
          ? "Mode démo : le mot de passe est « demo »."
          : "Aucun mot de passe : la connexion est impossible.",
    todo: [
      "Choisissez un long mot de passe et mettez-le dans ADMIN_PASSWORD.",
      "Générez une chaîne aléatoire de 40 caractères pour ADMIN_SECRET : node -e \"console.log(require('crypto').randomBytes(24).toString('hex'))\".",
      VERCEL_VARS,
    ],
  },
  {
    id: "supabase",
    name: "Base de données (Supabase)",
    role: "Garde les boutiques, produits, commandes et statistiques.",
    vars: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL"],
    main: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    required: () => true,
    detail: (v) =>
      v.SUPABASE_URL
        ? `Projet ${new URL(v.SUPABASE_URL).hostname}.${v.SUPABASE_DB_URL ? " Migrations possibles (npm run db:migrate)." : " SUPABASE_DB_URL absente : les migrations se font à la main."}`
        : "Mode démo : données fictives dans un fichier local.",
    todo: [
      "Créez un projet sur supabase.com (région Europe).",
      "SQL Editor > New query : collez supabase/schema.sql puis Run.",
      "Project Settings > API : copiez l'URL dans SUPABASE_URL et la clé service_role dans SUPABASE_SERVICE_ROLE_KEY.",
      VERCEL_VARS,
    ],
  },
  {
    id: "stripe",
    name: "Paiement (Stripe)",
    role: "Encaisse les commandes par carte, Apple Pay et Google Pay.",
    vars: ["STRIPE_SECRET_KEY"],
    main: ["STRIPE_SECRET_KEY"],
    required: (m) => m === "production",
    detail: (v) =>
      v.STRIPE_SECRET_KEY
        ? v.STRIPE_SECRET_KEY.includes("_live_")
          ? "Clé réelle : les paiements sont encaissés."
          : "Clé de test : utilisez la carte 4242 4242 4242 4242."
        : "Pas de paiement réel : en mode démo, le paiement est simulé.",
    todo: ["Stripe > Développeurs > Clés API : copiez la clé secrète sk_test_… dans STRIPE_SECRET_KEY.", VERCEL_VARS],
  },
  {
    id: "webhook",
    name: "Retour de paiement (webhook Stripe)",
    role: "Prévient le site quand un paiement est validé ou remboursé, pour créer la commande.",
    vars: ["STRIPE_WEBHOOK_SECRET"],
    main: ["STRIPE_WEBHOOK_SECRET"],
    required: (m) => m === "production",
    detail: (v) => (v.STRIPE_WEBHOOK_SECRET ? "Secret de signature défini." : "Sans lui, un paiement réussi ne crée pas de commande."),
    todo: [
      "Stripe > Développeurs > Webhooks > Ajouter un endpoint : https://votre-adresse/api/stripe/webhook.",
      "Événements : checkout.session.completed, checkout.session.async_payment_succeeded, charge.refunded.",
      "Copiez le secret whsec_… dans STRIPE_WEBHOOK_SECRET.",
      VERCEL_VARS,
    ],
  },
  {
    id: "cj",
    name: "Commandes fournisseur (CJ Dropshipping)",
    role: "Transmet chaque commande payée au fournisseur et récupère le suivi.",
    vars: ["CJ_API_KEY", "CJ_PAY_MODE", "AUTO_FULFILL", "AUTO_FULFILL_MAX_CENTS"],
    main: ["CJ_API_KEY"],
    required: () => false,
    detail: (v) => {
      if (!v.CJ_API_KEY) return "Les commandes sont à transmettre à la main (simulées en mode démo).";
      if (v.AUTO_FULFILL === "false") return "Envoi automatique désactivé (AUTO_FULFILL=false).";
      const max = Number(v.AUTO_FULFILL_MAX_CENTS ?? 15000) / 100;
      return `Envoi automatique jusqu'à ${max} € de coût fournisseur, ${v.CJ_PAY_MODE === "manual" ? "à payer dans votre compte CJ" : "payé avec votre solde CJ"}.`;
    },
    todo: [
      "Créez un compte gratuit sur cjdropshipping.com.",
      "My CJ > Authorization > API : générez une clé et mettez-la dans CJ_API_KEY.",
      "Dans l'admin, renseignez l'identifiant de variante CJ (vid) de chaque produit.",
      VERCEL_VARS,
    ],
  },
  {
    id: "anthropic",
    name: "Agents IA (Anthropic)",
    role: "Veille, construction de boutique et guides écrits par Claude. Payant à l'usage.",
    vars: ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "AGENT_AUTOPUBLISH"],
    main: ["ANTHROPIC_API_KEY"],
    required: () => false,
    detail: (v) =>
      v.ANTHROPIC_API_KEY
        ? `Modèle ${v.ANTHROPIC_MODEL ?? "par défaut"}. Guides publiés ${v.AGENT_AUTOPUBLISH === "false" ? "après votre validation" : "automatiquement"}.`
        : "Agents en mode démo : exemples fictifs, aucun coût.",
    todo: ["console.anthropic.com > API Keys : créez une clé et mettez-la dans ANTHROPIC_API_KEY.", "Fixez une limite de dépense mensuelle dans la console Anthropic.", VERCEL_VARS],
  },
  {
    id: "resend",
    name: "E-mails (Resend)",
    role: "Confirmation de commande, numéro de suivi et rapport du matin par e-mail.",
    vars: ["RESEND_API_KEY", "EMAIL_FROM_LOCAL", "REPORT_EMAIL", "REPORT_FROM"],
    main: ["RESEND_API_KEY"],
    required: () => false,
    detail: (v) =>
      v.RESEND_API_KEY
        ? `E-mails clients envoyés depuis ${v.EMAIL_FROM_LOCAL ?? "commandes"}@domaine-de-la-boutique.${v.REPORT_EMAIL ? " Rapport du matin envoyé par e-mail." : ""}`
        : "Aucun e-mail n'est envoyé.",
    todo: [
      "Créez un compte gratuit sur resend.com et vérifiez le domaine de chaque boutique.",
      "Copiez la clé API (re_…) dans RESEND_API_KEY.",
      "Pour le rapport du matin : REPORT_EMAIL (votre adresse) et REPORT_FROM.",
      VERCEL_VARS,
    ],
  },
  {
    id: "telegram",
    name: "Rapport sur Telegram",
    role: "Envoie le rapport du matin sur votre téléphone. Gratuit.",
    vars: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
    main: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
    required: () => false,
    detail: (v) => (v.TELEGRAM_BOT_TOKEN && v.TELEGRAM_CHAT_ID ? "Le rapport part chaque matin sur Telegram." : "Le rapport reste visible dans l'admin (page Aujourd'hui)."),
    todo: [
      "Dans Telegram, écrivez /newbot à @BotFather et copiez le jeton dans TELEGRAM_BOT_TOKEN.",
      "Envoyez un message à votre bot, ouvrez https://api.telegram.org/bot<JETON>/getUpdates et copiez le nombre après \"chat\":{\"id\": dans TELEGRAM_CHAT_ID.",
      VERCEL_VARS,
    ],
  },
  {
    id: "indexnow",
    name: "IndexNow (Bing et assistants IA)",
    role: "Prévient Bing à chaque publication, pour être découvert plus vite.",
    vars: ["INDEXNOW_KEY"],
    main: ["INDEXNOW_KEY"],
    required: () => false,
    detail: (v) => (v.INDEXNOW_KEY ? "Les nouvelles pages sont signalées à Bing." : "Les moteurs découvrent les pages par le sitemap seulement."),
    todo: ["Générez une clé : node -e \"console.log(require('crypto').randomBytes(16).toString('hex'))\".", "Mettez-la dans INDEXNOW_KEY.", VERCEL_VARS],
  },
  {
    id: "domaines",
    name: "Domaines automatiques (Vercel)",
    role: "Ajoute le domaine de chaque boutique à l'hébergement et suit son état depuis l'onglet Domaine. Gratuit.",
    vars: ["VERCEL_TOKEN", "VERCEL_PROJECT_ID", "VERCEL_TEAM_ID"],
    main: ["VERCEL_TOKEN", "VERCEL_PROJECT_ID"],
    required: () => false,
    detail: (v) =>
      v.VERCEL_TOKEN && v.VERCEL_PROJECT_ID
        ? `Les domaines s'ajoutent depuis l'admin${v.VERCEL_TEAM_ID ? " (projet d'équipe)" : ""}.`
        : "Les domaines s'ajoutent à la main dans Vercel ; l'admin affiche la marche à suivre.",
    todo: [
      "Vercel > Account Settings > Tokens : créez un jeton (portée : votre compte ou l'équipe du projet) et mettez-le dans VERCEL_TOKEN.",
      "Vercel > projet > Settings > General : copiez le Project ID (prj_…) dans VERCEL_PROJECT_ID.",
      "Si le projet appartient à une équipe : copiez le Team ID (team_…) dans VERCEL_TEAM_ID.",
      VERCEL_VARS,
    ],
  },
  {
    id: "cron",
    name: "Tâches planifiées",
    role: "Veille, suivi des colis, domaines, rapport du matin et guides, lancés chaque jour par Vercel.",
    vars: ["CRON_SECRET"],
    main: ["CRON_SECRET"],
    required: (m) => m === "production",
    detail: (v) => (v.CRON_SECRET ? "Les tâches de vercel.json sont autorisées." : "Les tâches planifiées sont refusées tant que CRON_SECRET n'est pas défini."),
    todo: [
      "Générez une chaîne aléatoire : node -e \"console.log(require('crypto').randomBytes(24).toString('hex'))\".",
      "Mettez-la dans CRON_SECRET : Vercel l'envoie automatiquement à chaque tâche.",
      VERCEL_VARS,
    ],
  },
  {
    id: "audience",
    name: "Mesure d'audience",
    role: "Compte les visites sans cookie. Fonctionne toujours ; un sel dédié renforce l'anonymat.",
    vars: ["ANALYTICS_SALT", "ADMIN_TIMEZONE"],
    main: ["ANALYTICS_SALT"],
    required: () => false,
    detail: (v) => `Fuseau des statistiques : ${v.ADMIN_TIMEZONE ?? "Europe/Paris"}.${v.ANALYTICS_SALT ? "" : " Sel dérivé de ADMIN_SECRET."}`,
    todo: ["Générez une chaîne aléatoire et mettez-la dans ANALYTICS_SALT.", VERCEL_VARS],
  },
];

export function serviceStatuses(source: Source = process.env): { mode: "production" | "demo"; services: ServiceStatus[] } {
  const { values, issues, mode } = readEnv(source);
  const services = DEFS.map((d): ServiceStatus => {
    const problems = issues.filter((i) => d.vars.includes(i.key)).map((i) => `${i.key} : ${i.message}`);
    const configured = d.main.every((k) => values[k]);
    return {
      id: d.id,
      name: d.name,
      role: d.role,
      required: d.required(mode),
      state: problems.length ? "a_corriger" : configured ? "ok" : "absent",
      detail: d.detail(values, mode),
      problems,
      todo: d.todo,
      vars: d.vars,
    };
  });
  return { mode, services };
}
