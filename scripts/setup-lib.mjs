// Fonctions de "npm run setup" sans effet de bord (testées dans tests/unit/setup.test.ts).
import crypto from "node:crypto";

/** Lit le contenu d'un fichier .env : { CLE: "valeur" } (les lignes vides et commentaires sont ignorés). */
export function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

/** Remplace (ou ajoute à la fin) CLE=valeur, en gardant les commentaires et l'ordre du fichier (toutes les lignes CLE= si elle est en double). */
export function setEnvValue(text, key, value) {
  const safe = /[\s#"']/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
  const re = new RegExp(`^(\\s*${key}\\s*=).*$`, "gm");
  if (re.test(text)) return text.replace(re, () => `${key}=${safe}`);
  return `${text.replace(/\s*$/, "")}\n${key}=${safe}\n`;
}

/** Secrets générés quand ils manquent. */
export const GENERATED = {
  ADMIN_SECRET: () => crypto.randomBytes(24).toString("hex"), // 48 caractères
  CRON_SECRET: () => crypto.randomBytes(24).toString("hex"),
  ANALYTICS_SALT: () => crypto.randomBytes(16).toString("hex"),
  INDEXNOW_KEY: () => crypto.randomBytes(16).toString("hex"), // 32 caractères hexadécimaux
};

/** Mot de passe lisible pour l'admin, quand le propriétaire n'en choisit pas. */
export function generatePassword() {
  return crypto.randomBytes(12).toString("base64url");
}

/** Variables qui restent sur l'ordinateur (jamais envoyées à Vercel). */
export const LOCAL_ONLY = new Set(["GITHUB_TOKEN", "GITHUB_REPO", "SUPABASE_DB_URL", "DEMO_DB_PATH"]);

/** Variables à envoyer à Vercel : toutes celles remplies, sauf celles réservées à l'ordinateur. */
export function varsForVercel(values) {
  return Object.entries(values)
    .filter(([k, v]) => v && v.trim() && !LOCAL_ONLY.has(k))
    .map(([key, value]) => ({ key, value, type: "encrypted", target: ["production", "preview"] }));
}

/** Secrets GitHub Actions nécessaires aux workflows (seulement ceux qui ont une valeur). */
export const GITHUB_SECRETS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL", "ANTHROPIC_API_KEY", "APP_URL", "CRON_SECRET"];

export function secretsForGithub(values) {
  return GITHUB_SECRETS.filter((k) => values[k]?.trim()).map((k) => ({ name: k, value: values[k].trim() }));
}

/** "https://github.com/maximdprt/multiboutique.git" ou "git@github.com:maximdprt/multiboutique.git" -> "maximdprt/multiboutique" */
export function repoFromRemote(remote) {
  const m = String(remote).trim().match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Le projet Vercel est-il lié à ce dépôt GitHub ? */
export function linkedTo(project, repo) {
  const l = project?.link;
  return Boolean(l && String(l.type).startsWith("github") && `${l.org}/${l.repo}`.toLowerCase() === repo.toLowerCase());
}

/** Adresse de production stable d'un projet Vercel (https://…), d'après GET /v9/projects/{id}. */
export function productionUrl(project) {
  const prod = project?.targets?.production;
  const aliases = [
    ...(prod?.alias ?? []),
    ...(project?.alias ?? []).filter((a) => a.target === "PRODUCTION" || a.environment === "production").map((a) => a.domain),
  ].filter(Boolean);
  const pick = aliases.find((a) => a.endsWith(".vercel.app") && !a.includes("-git-")) ?? aliases.find((a) => a.endsWith(".vercel.app")) ?? aliases[0];
  if (pick) return `https://${pick}`;
  return project?.name ? `https://${project.name}.vercel.app` : null;
}

/** Version de Node suffisante ? ("22.12.0" >= "22.12") */
export function nodeOk(version, min = "22.12") {
  const [a, b] = version.replace(/^v/, "").split(".").map(Number);
  const [x, y] = min.split(".").map(Number);
  return a > x || (a === x && b >= y);
}
