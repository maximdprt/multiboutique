import "server-only";
// API REST de Vercel (https://vercel.com/docs/rest-api), limitée à ce dont l'agent Domaines a besoin.
// Routes vérifiées dans la documentation officielle le 19 octobre 2026 (voir docs/DECISIONS.md).
// Jeton : Vercel > Account Settings > Tokens. Projet : Vercel > projet > Settings > General > Project ID.

const API = "https://api.vercel.com";

export type VercelConfig = { token: string; projectId: string; teamId?: string };

export function vercelConfig(source: Record<string, string | undefined> = process.env): VercelConfig | null {
  const token = source.VERCEL_TOKEN?.trim();
  const projectId = source.VERCEL_PROJECT_ID?.trim();
  if (!token || !projectId) return null;
  return { token, projectId, teamId: source.VERCEL_TEAM_ID?.trim() || undefined };
}

export class VercelError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

async function call<T>(cfg: VercelConfig, method: string, path: string, body?: unknown, query: Record<string, string> = {}): Promise<T> {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  if (cfg.teamId) url.searchParams.set("teamId", cfg.teamId);
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${cfg.token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } } & T;
  if (!res.ok) {
    const code = data.error?.code ?? String(res.status);
    const reason =
      res.status === 401 || res.status === 403
        ? "jeton refusé : vérifiez VERCEL_TOKEN (et VERCEL_TEAM_ID si le projet appartient à une équipe)"
        : res.status === 404
          ? "introuvable : vérifiez VERCEL_PROJECT_ID"
          : (data.error?.message ?? `erreur ${res.status}`);
    throw new VercelError(`Vercel : ${reason}`, res.status, code);
  }
  return data;
}

export type ProjectDomain = {
  name: string;
  apexName: string;
  redirect?: string | null;
  redirectStatusCode?: number | null;
  verified: boolean;
  verification?: { type: string; domain: string; value: string; reason: string }[];
};

export type DomainConfig = {
  misconfigured: boolean;
  configuredBy?: "A" | "CNAME" | "http" | "dns-01" | null;
  recommendedIPv4?: { rank: number; value: string[] }[];
  recommendedCNAME?: { rank: number; value: string }[];
};

/** Domaine rattaché au projet, ou null s'il ne l'est pas. */
export async function getProjectDomain(cfg: VercelConfig, domain: string): Promise<ProjectDomain | null> {
  try {
    return await call<ProjectDomain>(cfg, "GET", `/v9/projects/${encodeURIComponent(cfg.projectId)}/domains/${encodeURIComponent(domain)}`);
  } catch (e) {
    // Domaine absent du projet (un mauvais VERCEL_PROJECT_ID ressortira à l'ajout)
    if (e instanceof VercelError && e.status === 404) return null;
    throw e;
  }
}

/** Rattache un domaine au projet (avec redirection éventuelle, ex. www -> domaine nu en 308). */
export function addProjectDomain(cfg: VercelConfig, domain: string, redirect?: string) {
  return call<ProjectDomain>(
    cfg,
    "POST",
    `/v10/projects/${encodeURIComponent(cfg.projectId)}/domains`,
    redirect ? { name: domain, redirect, redirectStatusCode: 308 } : { name: domain },
  );
}

/** Demande à Vercel de revérifier la propriété du domaine (enregistrement TXT). Renvoie null si toujours pas vérifié. */
export async function verifyProjectDomain(cfg: VercelConfig, domain: string): Promise<ProjectDomain | null> {
  try {
    return await call<ProjectDomain>(cfg, "POST", `/v9/projects/${encodeURIComponent(cfg.projectId)}/domains/${encodeURIComponent(domain)}/verify`);
  } catch (e) {
    if (e instanceof VercelError && e.status === 400) return null;
    throw e;
  }
}

/** Configuration DNS vue par Vercel, avec les valeurs recommandées pour ce projet. */
export function getDomainConfig(cfg: VercelConfig, domain: string) {
  return call<DomainConfig>(cfg, "GET", `/v6/domains/${encodeURIComponent(domain)}/config`, undefined, { projectIdOrName: cfg.projectId });
}

/** Valeur recommandée de rang 1 (la préférée). */
export function bestIPv4(c: DomainConfig) {
  return [...(c.recommendedIPv4 ?? [])].sort((a, b) => a.rank - b.rank)[0]?.value[0] ?? null;
}
export function bestCNAME(c: DomainConfig) {
  return ([...(c.recommendedCNAME ?? [])].sort((a, b) => a.rank - b.rank)[0]?.value ?? "").replace(/\.$/, "") || null;
}
