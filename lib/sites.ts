import "server-only";
import { cache } from "react";
import { db } from "./db";
import { previewBase, previewIdOf } from "./store-path";
import type { Site } from "./types";

/** Base des liens de la boutique pour ce segment [host] : "" sur son domaine, "/apercu/<id>" en aperçu. */
export function storeBase(hostParam: string) {
  const id = previewIdOf(hostParam);
  return id ? previewBase(id) : "";
}

export function normalizeHost(host: string) {
  return decodeURIComponent(host)
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
}

/**
 * Retrouve la boutique correspondant au nom de domaine visité.
 *  - "bocal-et-cie.fr" ou "www.bocal-et-cie.fr" -> la boutique dont le domaine correspond
 *  - "bocal.localhost" (en local) -> la boutique dont l'identifiant est "bocal"
 *  - "localhost" ou un domaine inconnu -> DEFAULT_SITE (ou la première boutique en local)
 */
export const siteFromHost = cache(async (hostParam: string): Promise<Site | null> => {
  // Aperçu (/apercu/<id>/…) : la boutique s'affiche même hors ligne, pour la vérifier avant de l'ouvrir.
  const previewId = previewIdOf(hostParam);
  if (previewId) return db.getSite(previewId);

  const host = normalizeHost(hostParam);
  const sites = (await db.listSites()).filter((s) => s.active);
  const exact = sites.find((s) => s.domain === host);
  if (exact) return exact;

  if (host.endsWith(".localhost")) {
    const id = host.slice(0, -".localhost".length);
    return sites.find((s) => s.id === id) ?? null;
  }

  const fallback = process.env.DEFAULT_SITE;
  if (fallback) return sites.find((s) => s.id === fallback) ?? null;
  if (host === "localhost" || host === "127.0.0.1") return sites[0] ?? null;
  return null;
});

/** URL publique de la boutique (pour les balises canoniques, le sitemap, les données structurées). */
export function siteUrl(site: Site, path = "/") {
  return `https://${site.domain}${path.startsWith("/") ? path : `/${path}`}`;
}
