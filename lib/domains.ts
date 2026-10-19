import "server-only";
// Agent Domaines : rattache le domaine d'une boutique au projet Vercel, affiche les enregistrements DNS
// à créer chez le registraire, puis suit l'état (DNS, vérification, certificat HTTPS) jusqu'à « En ligne ».
//  - avec VERCEL_TOKEN + VERCEL_PROJECT_ID : tout passe par l'API Vercel ;
//  - en mode démo : simulation, une étape franchie à chaque vérification ;
//  - sinon (mode manuel) : marche à suivre à la main, et seule la réponse HTTPS du domaine est vérifiée.
// L'état est gardé dans les réglages (clé "domaine:<id>"), il suit donc la base (Supabase ou démo).
import { db } from "./db";
import { pingIndexNow } from "./indexnow";
import { sitemapEntries } from "./sitemap";
import { addProjectDomain, bestCNAME, bestIPv4, getDomainConfig, getProjectDomain, vercelConfig, verifyProjectDomain, type VercelConfig } from "./vercel";
import type { ReportTodo, Site } from "./types";

export type DomainMode = "vercel" | "demo" | "manuel";
export type DomainStatus = "a_ajouter" | "dns" | "verification" | "certificat" | "en_ligne" | "erreur";

export const DOMAIN_STATUS_LABEL: Record<DomainStatus, string> = {
  a_ajouter: "À ajouter",
  dns: "En attente des DNS",
  verification: "Vérification en cours",
  certificat: "Certificat HTTPS en cours",
  en_ligne: "En ligne",
  erreur: "Erreur",
};

export type DnsRecord = {
  type: "A" | "CNAME" | "TXT";
  /** Nom à saisir chez le registraire, relatif au domaine (@ = le domaine lui-même) */
  name: string;
  value: string;
  /** Adresse complète concernée (ex. www.ma-boutique.fr) */
  host: string;
  /** Vercel le voit-il correctement configuré ? null = inconnu */
  ok: boolean | null;
  why: string;
};

export type DomainState = {
  site_id: string;
  domain: string;
  mode: DomainMode;
  status: DomainStatus;
  message: string;
  records: DnsRecord[];
  checks: { added: boolean; dns: boolean; verified: boolean; https: boolean };
  added_at: string | null;
  checked_at: string | null;
  /** Première fois que tout était bon */
  online_since: string | null;
  /** Le propriétaire a déclaré le domaine dans Search Console et Merchant Center */
  declared: boolean;
  /** Mode démo : étape simulée (0 à 3) */
  demo_step?: number;
};

const key = (siteId: string) => `domaine:${siteId}`;

export function domainMode(): DomainMode {
  if (vercelConfig()) return "vercel";
  return db.kind === "demo" ? "demo" : "manuel";
}

/** "ma-boutique.fr" est un domaine nu (on ajoute aussi www) ; "shop.ma-marque.fr" est un sous-domaine. */
export function isApex(domain: string) {
  return domain.split(".").length === 2;
}

/** Adresses à rattacher : le domaine, et sa variante www pour un domaine nu. */
export function hostnames(domain: string) {
  return isApex(domain) ? [domain, `www.${domain}`] : [domain];
}

/** Nom relatif à saisir chez le registraire : "@" pour le domaine nu, "www" pour www.ma-boutique.fr. */
export function recordName(host: string, apex: string) {
  if (host === apex) return "@";
  return host.endsWith(`.${apex}`) ? host.slice(0, -apex.length - 1) : host;
}

function apexOf(domain: string) {
  return domain.split(".").slice(-2).join(".");
}

function fresh(site: Site): DomainState {
  return {
    site_id: site.id,
    domain: site.domain,
    mode: domainMode(),
    status: "a_ajouter",
    message: "",
    records: [],
    checks: { added: false, dns: false, verified: false, https: false },
    added_at: null,
    checked_at: null,
    online_since: null,
    declared: false,
  };
}

/** État enregistré du domaine actuel de la boutique (repart de zéro si le domaine a changé). */
export async function getDomainState(site: Site): Promise<DomainState> {
  const saved = await db.getSetting<DomainState>(key(site.id));
  if (!saved || saved.domain !== site.domain) return fresh(site);
  return { ...saved, mode: domainMode() };
}

async function save(state: DomainState) {
  await db.setSetting(key(state.site_id), state);
  return state;
}

/** Statut à partir des vérifications, dans l'ordre où le propriétaire doit agir. */
export function statusOf(c: DomainState["checks"]): DomainStatus {
  if (!c.added) return "a_ajouter";
  if (!c.dns) return "dns";
  if (!c.verified) return "verification";
  if (!c.https) return "certificat";
  return "en_ligne";
}

const MESSAGES: Record<DomainStatus, string> = {
  a_ajouter: "Cliquez sur « Ajouter ce domaine » pour le rattacher à l'hébergement.",
  dns: "Créez chez votre registraire les enregistrements ci-dessous. La prise en compte prend de quelques minutes à 48 h.",
  verification: "Les DNS sont bons ; Vercel vérifie que le domaine vous appartient (enregistrement TXT ci-dessous).",
  certificat: "Tout est configuré : le certificat HTTPS est en cours de création (quelques minutes en général).",
  en_ligne: "La boutique répond sur son domaine, en HTTPS.",
  erreur: "",
};

/**
 * La boutique répond-elle en HTTPS sur ce domaine ? La requête n'aboutit qu'avec un certificat valide,
 * et le robots.txt doit être le nôtre (il annonce le sitemap du domaine), pas une page de parking.
 */
export async function servesStore(domain: string) {
  try {
    const res = await fetch(`https://${domain}/robots.txt`, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(10_000) });
    return res.ok && (await res.text()).includes(`Sitemap: https://${domain}/sitemap.xml`);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Vercel
// ---------------------------------------------------------------------------

async function inspectVercel(cfg: VercelConfig, domain: string) {
  const apex = isApex(domain) ? domain : apexOf(domain);
  const records: DnsRecord[] = [];
  const checks = { added: true, dns: true, verified: true, https: false };
  for (const host of hostnames(domain)) {
    let pd = await getProjectDomain(cfg, host);
    if (!pd) {
      checks.added = false;
      continue;
    }
    if (!pd.verified) pd = (await verifyProjectDomain(cfg, host)) ?? pd;
    const conf = await getDomainConfig(cfg, host);
    const dnsOk = !conf.misconfigured;
    if (!dnsOk) checks.dns = false;
    if (host === apex) {
      const ip = bestIPv4(conf);
      if (ip) records.push({ type: "A", name: "@", value: ip, host, ok: dnsOk, why: "Fait pointer le domaine vers l'hébergement." });
    } else {
      const cname = bestCNAME(conf);
      if (cname)
        records.push({
          type: "CNAME",
          name: recordName(host, apex),
          value: cname,
          host,
          ok: dnsOk,
          why: host === `www.${domain}` ? "Fait pointer www vers l'hébergement (Vercel redirige ensuite vers le domaine sans www)." : "Fait pointer ce sous-domaine vers l'hébergement.",
        });
    }
    if (!pd.verified) {
      checks.verified = false;
      for (const v of pd.verification ?? [])
        records.push({ type: v.type as DnsRecord["type"], name: recordName(v.domain, apex), value: v.value, host: v.domain, ok: false, why: "Prouve que le domaine vous appartient." });
    }
  }
  if (checks.added && checks.dns && checks.verified) checks.https = await servesStore(domain);
  return { records, checks };
}

async function addVercel(cfg: VercelConfig, domain: string, log: (s: string) => void) {
  const [main, www] = hostnames(domain);
  if (!(await getProjectDomain(cfg, main))) {
    await addProjectDomain(cfg, main);
    log(`${main} ajouté au projet Vercel.`);
  } else log(`${main} était déjà rattaché au projet.`);
  if (www) {
    if (!(await getProjectDomain(cfg, www))) {
      await addProjectDomain(cfg, www, main);
      log(`${www} ajouté, redirigé vers ${main} (308).`);
    } else log(`${www} était déjà rattaché au projet.`);
  }
}

// ---------------------------------------------------------------------------
// Démo : mêmes étapes, simulées
// ---------------------------------------------------------------------------

function demoRecords(domain: string, step: number): DnsRecord[] {
  const out: DnsRecord[] = [{ type: "A", name: "@", value: "76.76.21.21", host: domain, ok: step >= 1, why: "Fait pointer le domaine vers l'hébergement." }];
  if (isApex(domain))
    out.push({ type: "CNAME", name: "www", value: "cname.vercel-dns.com", host: `www.${domain}`, ok: step >= 1, why: "Fait pointer www vers l'hébergement (redirigé ensuite vers le domaine sans www)." });
  if (step < 2) out.push({ type: "TXT", name: "_vercel", value: `vc-domain-verify=${domain},demo0000`, host: `_vercel.${apexOf(domain)}`, ok: step >= 2, why: "Prouve que le domaine vous appartient." });
  return out;
}

function demoChecks(step: number) {
  return { added: true, dns: step >= 1, verified: step >= 2, https: step >= 3 };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function finish(site: Site, prev: DomainState, next: DomainState, log: (s: string) => void) {
  next.checked_at = new Date().toISOString();
  if (!next.message) next.message = MESSAGES[next.status];
  if (next.status === "en_ligne" && prev.status !== "en_ligne") {
    next.online_since ??= next.checked_at;
    log(`${site.domain} est en ligne.`);
    // Prévenir Bing (et les assistants IA qui s'en servent) de toutes les pages du sitemap.
    if (next.mode !== "demo") {
      const urls = (await sitemapEntries(site)).map((e) => e.loc);
      await pingIndexNow(site, urls)
        .then(() => log(`${urls.length} adresses du sitemap signalées à IndexNow.`))
        .catch((e) => log(`IndexNow : ${(e as Error).message}`));
    }
  }
  return save(next);
}

/** Bouton « Ajouter ce domaine ». */
export async function addDomain(site: Site, log: (s: string) => void = () => {}) {
  const prev = await getDomainState(site);
  const next: DomainState = { ...prev, message: "", added_at: prev.added_at ?? new Date().toISOString() };
  if (next.mode === "manuel") throw new Error("Ajout automatique impossible sans VERCEL_TOKEN et VERCEL_PROJECT_ID : suivez la marche à suivre manuelle.");
  if (next.mode === "demo") {
    log(`Simulation : ${hostnames(site.domain).join(" et ")} ajoutés.`);
    next.demo_step = 0;
    next.records = demoRecords(site.domain, 0);
    next.checks = demoChecks(0);
    next.status = statusOf(next.checks);
    return finish(site, prev, next, log);
  }
  await addVercel(vercelConfig()!, site.domain, log);
  await save(next);
  return checkDomain(site, log);
}

/** Bouton « Vérifier maintenant » et tâche planifiée quotidienne. */
export async function checkDomain(site: Site, log: (s: string) => void = () => {}): Promise<DomainState> {
  const prev = await getDomainState(site);
  const next: DomainState = { ...prev, message: "" };
  try {
    if (next.mode === "demo") {
      if (!prev.added_at) return prev;
      next.demo_step = Math.min(3, (prev.demo_step ?? 0) + 1);
      next.records = demoRecords(site.domain, next.demo_step);
      next.checks = demoChecks(next.demo_step);
    } else if (next.mode === "vercel") {
      const r = await inspectVercel(vercelConfig()!, site.domain);
      next.records = r.records;
      next.checks = r.checks;
    } else {
      // Manuel : on ne voit pas la configuration Vercel, seulement si le domaine répond.
      const https = await servesStore(site.domain);
      next.records = [];
      next.checks = { added: true, dns: https, verified: https, https };
    }
    next.status = statusOf(next.checks);
    if (next.mode === "manuel" && next.status !== "en_ligne") {
      next.status = "dns";
      next.message = `${site.domain} n'affiche pas encore la boutique en HTTPS. Vérifiez qu'il est ajouté dans Vercel > Settings > Domains et que les DNS sont créés.`;
    }
    log(`${site.domain} : ${DOMAIN_STATUS_LABEL[next.status]}.`);
  } catch (e) {
    next.status = "erreur";
    next.message = (e as Error).message;
    log(`${site.domain} : ${next.message}`);
  }
  return finish(site, prev, next, log);
}

/** Tâche planifiée : revérifie chaque domaine déjà ajouté (et repère ceux qui ne répondent plus). */
export async function checkAllDomains(log: (s: string) => void = () => {}) {
  const sites = (await db.listSites()).filter((s) => s.active && s.domain.includes(".") && !s.domain.endsWith(".localhost"));
  let checked = 0;
  let online = 0;
  for (const site of sites) {
    const state = await getDomainState(site);
    // En démo, seuls les domaines « ajoutés » ; ailleurs tous (un domaine ajouté à la main dans Vercel est repéré aussi).
    if (state.mode === "demo" && !state.added_at) continue;
    const next = await checkDomain(site, log);
    checked++;
    if (next.status === "en_ligne") online++;
  }
  return { domaines_verifies: checked, en_ligne: online };
}

/** Bouton « C'est fait » : le domaine est déclaré dans Search Console et Merchant Center. */
export async function markDeclared(site: Site) {
  const state = await getDomainState(site);
  return save({ ...state, declared: true });
}

// ---------------------------------------------------------------------------
// Rapport du matin
// ---------------------------------------------------------------------------

export async function loadDomainStates(sites: Site[]) {
  const states = await Promise.all(sites.map((s) => db.getSetting<DomainState>(key(s.id))));
  return states.filter((s): s is DomainState => Boolean(s));
}

/** Lignes du rapport : déclarations à faire, domaines qui ne répondent plus. */
export function domainReport(sites: Site[], states: DomainState[]) {
  const todos: ReportTodo[] = [];
  const alerts: string[] = [];
  for (const s of sites.filter((x) => x.active)) {
    const st = states.find((x) => x.site_id === s.id && x.domain === s.domain);
    if (!st) continue;
    const href = `/admin/boutiques/${s.id}/domaine`;
    if (st.status === "en_ligne" && !st.declared)
      todos.push({ level: "normal", label: `Déclarer le domaine ${s.domain} dans Google Search Console et Merchant Center`, href });
    if (st.online_since && st.status !== "en_ligne")
      alerts.push(`${s.domain} ne répond plus correctement (${DOMAIN_STATUS_LABEL[st.status].toLowerCase()}) : voir l'onglet Domaine de ${s.name}.`);
  }
  return { todos, alerts };
}
