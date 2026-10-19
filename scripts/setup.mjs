// Installation guidée : npm run setup
//
// 1. Vérifie Node, Git et .env.local (le crée à partir de .env.example, génère les secrets manquants).
// 2. Applique les migrations Supabase si SUPABASE_DB_URL est présent.
// 3. Si VERCEL_TOKEN est présent : retrouve ou crée le projet Vercel lié au dépôt GitHub,
//    envoie les variables d'environnement remplies, déclenche un déploiement et affiche l'adresse.
// 4. Si GITHUB_TOKEN est présent : crée les secrets GitHub Actions.
// 5. Récapitule ce qui est fait et ce qui reste.
//
// Options : --oui (répond oui à tout, sans question), --sans-deploiement.
// Routes des API vérifiées dans la documentation officielle de Vercel et GitHub le 19 octobre 2026.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import {
  GENERATED,
  generatePassword,
  linkedTo,
  nodeOk,
  parseEnv,
  productionUrl,
  repoFromRemote,
  secretsForGithub,
  setEnvValue,
  varsForVercel,
} from "./setup-lib.mjs";

const ROOT = process.cwd();
const ENV_LOCAL = path.join(ROOT, ".env.local");
const ENV_EXAMPLE = path.join(ROOT, ".env.example");
const YES = process.argv.includes("--oui") || !process.stdin.isTTY;
const NO_DEPLOY = process.argv.includes("--sans-deploiement");

const done = [];
const todo = [];
const ok = (s) => (console.log(`  ✓ ${s}`), done.push(s));
const warn = (s) => (console.log(`  ! ${s}`), todo.push(s));
const info = (s) => console.log(`    ${s}`);
const title = (s) => console.log(`\n${s}\n${"-".repeat(s.length)}`);

const rl = YES ? null : readline.createInterface({ input: process.stdin, output: process.stdout });
async function ask(question, def = "") {
  if (!rl) return def;
  const a = (await rl.question(`  ? ${question}${def ? ` (${def})` : ""} `)).trim();
  return a || def;
}
async function confirm(question) {
  if (!rl) return true;
  return /^(o|oui|y|yes)$/i.test(await ask(`${question} [O/n]`, "o"));
}

// ---------------------------------------------------------------------------
// .env.local
// ---------------------------------------------------------------------------
let envText = fs.existsSync(ENV_LOCAL) ? fs.readFileSync(ENV_LOCAL, "utf8") : null;
const env = () => ({ ...parseEnv(envText ?? ""), ...pick(process.env) });
function pick(source) {
  // Une variable passée en ligne de commande l'emporte sur .env.local
  const keys = Object.keys(parseEnv(fs.existsSync(ENV_EXAMPLE) ? fs.readFileSync(ENV_EXAMPLE, "utf8") : ""));
  return Object.fromEntries(keys.filter((k) => source[k]?.trim()).map((k) => [k, source[k].trim()]));
}
function saveEnv(key, value) {
  envText = setEnvValue(envText ?? "", key, value);
  fs.writeFileSync(ENV_LOCAL, envText);
}

async function stepLocal() {
  title("1. Votre ordinateur");
  if (nodeOk(process.versions.node)) ok(`Node ${process.versions.node}`);
  else {
    warn(`Node ${process.versions.node} est trop ancien : installez la version LTS (22.12 ou plus) sur https://nodejs.org`);
    process.exit(1);
  }
  try {
    ok(execFileSync("git", ["--version"], { encoding: "utf8" }).trim());
  } catch {
    warn("Git est introuvable : installez-le depuis https://git-scm.com");
  }

  if (envText === null) {
    if (!(await confirm(".env.local n'existe pas. Le créer à partir de .env.example ?"))) {
      warn("Pas de .env.local : le site tourne en mode démo.");
      return false;
    }
    envText = fs.readFileSync(ENV_EXAMPLE, "utf8");
    fs.writeFileSync(ENV_LOCAL, envText);
    ok(".env.local créé à partir de .env.example (il n'est jamais envoyé sur GitHub)");
  } else ok(".env.local présent");

  // Valeurs d'exemple de .env.example à ne pas garder telles quelles
  const placeholders = { ADMIN_PASSWORD: "choisissez-un-long-mot-de-passe", REPORT_EMAIL: "vous@exemple.fr", REPORT_FROM: "Rapports <rapport@votre-domaine.fr>" };
  for (const [k, v] of Object.entries(placeholders)) if (parseEnv(envText)[k] === v) saveEnv(k, "");

  if (!env().ADMIN_PASSWORD) {
    const chosen = await ask("Mot de passe de l'admin (Entrée pour en générer un) :");
    const pwd = chosen || generatePassword();
    saveEnv("ADMIN_PASSWORD", pwd);
    ok(chosen ? "Mot de passe de l'admin enregistré" : `Mot de passe de l'admin généré : ${pwd} (notez-le, il est aussi dans .env.local)`);
  }
  const generated = Object.keys(GENERATED).filter((k) => !env()[k]);
  for (const k of generated) saveEnv(k, GENERATED[k]());
  if (generated.length) ok(`Générés : ${generated.join(", ")}`);
  else ok("Secrets déjà présents (ADMIN_SECRET, CRON_SECRET, ANALYTICS_SALT, INDEXNOW_KEY)");

  if (!env().GITHUB_REPO) {
    try {
      const repo = repoFromRemote(execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }));
      if (repo) {
        saveEnv("GITHUB_REPO", repo);
        ok(`Dépôt GitHub : ${repo}`);
      }
    } catch {
      // pas de dépôt git : GITHUB_REPO reste à remplir
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------
function stepSupabase() {
  title("2. Base de données (Supabase)");
  const e = env();
  if (!e.SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY)
    warn("Supabase n'est pas configuré (mode démo). Créez un projet sur supabase.com, puis remplissez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local.");
  else ok("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY présents");
  if (!e.SUPABASE_DB_URL) {
    warn("SUPABASE_DB_URL absent : migrations non appliquées (Supabase > Connect > Session pooler, puis npm run db:migrate).");
    return;
  }
  info("Application des migrations…");
  const r = spawnSync(process.execPath, [path.join("scripts", "db-migrate.mjs")], { stdio: "inherit", env: { ...process.env, ...e } });
  if (r.status === 0) ok("Migrations Supabase appliquées");
  else warn("Les migrations ont échoué (voir le message ci-dessus), relancez npm run db:migrate après correction.");
}

// ---------------------------------------------------------------------------
// Vercel
// ---------------------------------------------------------------------------
async function vercel(method, p, body, query = {}) {
  const e = env();
  const url = new URL(`https://api.vercel.com${p}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  if (e.VERCEL_TEAM_ID) url.searchParams.set("teamId", e.VERCEL_TEAM_ID);
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${e.VERCEL_TOKEN}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message ?? `erreur ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function findProject(repo) {
  const e = env();
  if (e.VERCEL_PROJECT_ID) {
    try {
      return await vercel("GET", `/v9/projects/${encodeURIComponent(e.VERCEL_PROJECT_ID)}`);
    } catch (err) {
      if (err.status !== 404) throw err;
      warn(`Le projet ${e.VERCEL_PROJECT_ID} (VERCEL_PROJECT_ID) est introuvable : recherche par dépôt.`);
    }
  }
  if (!repo) return null;
  const list = await vercel("GET", "/v10/projects", undefined, { repoUrl: `https://github.com/${repo}`, limit: "100" });
  const projects = Array.isArray(list) ? list : (list.projects ?? []);
  return projects.find((p) => linkedTo(p, repo)) ?? null;
}

async function waitReady(id) {
  const start = Date.now();
  let last = "";
  while (Date.now() - start < 10 * 60_000) {
    const d = await vercel("GET", `/v13/deployments/${encodeURIComponent(id)}`);
    if (d.readyState !== last) info(`Déploiement : ${(last = d.readyState)}`);
    if (d.readyState === "READY") return d;
    if (d.readyState === "ERROR" || d.readyState === "CANCELED") throw new Error(`le déploiement a échoué (${d.readyState}) : voir ${d.inspectorUrl ?? "Vercel > Deployments"}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("le déploiement prend plus de 10 minutes : suivez-le dans Vercel > Deployments");
}

async function stepVercel() {
  title("3. Hébergement (Vercel)");
  const e = env();
  if (!e.VERCEL_TOKEN) {
    warn("VERCEL_TOKEN absent : mise en ligne à faire à la main (README, « Mettre en ligne »), ou créez un jeton dans Vercel > Account Settings > Tokens, mettez-le dans .env.local et relancez npm run setup.");
    return null;
  }
  const repo = e.GITHUB_REPO;
  try {
    let project = await findProject(repo);
    if (project) ok(`Projet Vercel trouvé : ${project.name}${linkedTo(project, repo ?? "") ? ` (lié à ${repo})` : ""}`);
    else {
      if (!repo) {
        warn("Impossible de créer le projet : GITHUB_REPO est vide (propriétaire/nom du dépôt).");
        return null;
      }
      const name = repo.split("/")[1].toLowerCase();
      if (!(await confirm(`Aucun projet Vercel lié à ${repo}. Créer le projet « ${name} » ?`))) {
        warn("Projet Vercel non créé.");
        return null;
      }
      try {
        project = await vercel("POST", "/v11/projects", { name, framework: "nextjs", gitRepository: { type: "github", repo } });
      } catch (err) {
        if (err.status === 400 || err.status === 403 || err.status === 404)
          throw new Error(
            `${err.message}. Vérifiez que l'application Vercel a accès au dépôt : Vercel > Account Settings > Git > GitHub > Configure, puis ajoutez ${repo}.`,
          );
        throw err;
      }
      ok(`Projet Vercel « ${project.name} » créé et lié à ${repo}`);
    }
    if (env().VERCEL_PROJECT_ID !== project.id) {
      saveEnv("VERCEL_PROJECT_ID", project.id);
      ok(`VERCEL_PROJECT_ID enregistré dans .env.local (${project.id})`);
    }

    // Variables d'environnement (les vides et celles réservées à l'ordinateur ne partent pas)
    // Adresse connue seulement si le projet a déjà été déployé (sinon, après le déploiement ci-dessous)
    const url = project.targets?.production ? productionUrl(project) : null;
    if (url && !env().APP_URL) saveEnv("APP_URL", url);
    const vars = varsForVercel(env());
    if (await confirm(`Envoyer ${vars.length} variables remplies vers Vercel (${vars.map((v) => v.key).join(", ")}) ?`)) {
      const r = await vercel("POST", `/v10/projects/${encodeURIComponent(project.id)}/env`, vars, { upsert: "true" });
      const failed = r.failed ?? [];
      if (failed.length) warn(`Variables refusées par Vercel : ${failed.map((f) => `${f.error?.key ?? "?"} (${f.error?.message ?? "erreur"})`).join(", ")}`);
      ok(`${vars.length - failed.length} variables envoyées à Vercel (production et préversions)`);
      if (!env().DEFAULT_SITE) info("DEFAULT_SITE est vide : l'adresse .vercel.app affichera « Boutique introuvable », mais les aperçus /apercu/<id> fonctionnent.");
    } else warn("Variables non envoyées à Vercel.");

    if (NO_DEPLOY || !(await confirm("Déclencher un déploiement de production maintenant ?"))) {
      warn("Déploiement non lancé : il se fera au prochain git push sur la branche de production.");
      return url;
    }
    const branch = project.link?.productionBranch || "main";
    const gitSource = project.link?.repoId ? { type: "github", ref: branch, repoId: project.link.repoId } : { type: "github", ref: branch, org: repo.split("/")[0], repo: repo.split("/")[1] };
    const d = await vercel("POST", "/v13/deployments", { name: project.name, project: project.id, target: "production", gitSource }, { skipAutoDetectionConfirmation: "1" });
    info(`Déploiement lancé depuis la branche ${branch} : ${d.inspectorUrl ?? d.url}`);
    await waitReady(d.id);
    const fresh = await vercel("GET", `/v9/projects/${encodeURIComponent(project.id)}`);
    const live = productionUrl(fresh) ?? `https://${d.url}`;
    saveEnv("APP_URL", live);
    ok(`Site en ligne : ${live}  (admin : ${live}/admin, aperçu d'une boutique : ${live}/apercu/<identifiant>)`);
    return live;
  } catch (err) {
    warn(`Vercel : ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// GitHub Actions
// ---------------------------------------------------------------------------
async function github(method, p, body) {
  const res = await fetch(`https://api.github.com${p}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env().GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "multiboutique-setup",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      res.status === 401 || res.status === 403 || res.status === 404
        ? `accès refusé (${res.status}) : le jeton doit avoir accès au dépôt ${env().GITHUB_REPO} avec la permission « Secrets » en écriture`
        : (data.message ?? `erreur ${res.status}`),
    );
  }
  return res.status === 204 || res.status === 201 ? null : res.json();
}

async function stepGithub() {
  title("4. Secrets GitHub Actions");
  const e = env();
  if (!e.GITHUB_TOKEN) {
    warn("GITHUB_TOKEN absent : secrets GitHub à créer à la main (GitHub > dépôt > Settings > Secrets and variables > Actions) quand une phase les demandera.");
    return;
  }
  if (!e.GITHUB_REPO) {
    warn("GITHUB_REPO est vide (propriétaire/nom du dépôt).");
    return;
  }
  const secrets = secretsForGithub(e);
  if (!secrets.length) {
    info("Aucun secret à créer pour l'instant (Supabase, clé Anthropic et adresse du site absents).");
    return;
  }
  if (!(await confirm(`Créer ou mettre à jour ${secrets.length} secrets dans ${e.GITHUB_REPO} (${secrets.map((s) => s.name).join(", ")}) ?`))) {
    warn("Secrets GitHub non créés.");
    return;
  }
  try {
    const { default: sodium } = await import("libsodium-wrappers");
    await sodium.ready;
    const { key, key_id } = await github("GET", `/repos/${e.GITHUB_REPO}/actions/secrets/public-key`);
    const pub = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
    for (const s of secrets) {
      const encrypted_value = sodium.to_base64(sodium.crypto_box_seal(sodium.from_string(s.value), pub), sodium.base64_variants.ORIGINAL);
      await github("PUT", `/repos/${e.GITHUB_REPO}/actions/secrets/${s.name}`, { encrypted_value, key_id });
    }
    ok(`Secrets GitHub Actions à jour : ${secrets.map((s) => s.name).join(", ")}`);
  } catch (err) {
    warn(`GitHub : ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
console.log("Multiboutique : installation guidée");
try {
  if (await stepLocal()) {
    stepSupabase();
    await stepVercel();
    await stepGithub();
  }
} finally {
  rl?.close();
}

title("Récapitulatif");
console.log(done.length ? `Fait :\n${done.map((d) => `  ✓ ${d}`).join("\n")}` : "Rien n'a été fait.");
console.log(todo.length ? `\nReste à faire :\n${todo.map((t) => `  • ${t}`).join("\n")}` : "\nTout est en place.");
console.log("\nVérifiez à tout moment dans l'admin : Réglages > État des services.");
