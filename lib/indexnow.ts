import "server-only";
// IndexNow : prévient Bing (et les moteurs partenaires) dès qu'une page est publiée ou modifiée.
// Bing alimente aussi la recherche de plusieurs assistants IA : c'est le moyen le plus rapide d'être découvert.
// Google n'utilise pas IndexNow : pour lui, le sitemap déclaré dans la Search Console fait le travail.
import type { Site } from "./types";

export const indexNowKey = () => process.env.INDEXNOW_KEY || "";

export async function pingIndexNow(site: Site, urls: string[]) {
  const key = indexNowKey();
  if (!key || !urls.length || site.domain.endsWith(".localhost") || !site.domain.includes(".")) return;
  await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: site.domain, key, keyLocation: `https://${site.domain}/${key}.txt`, urlList: urls.slice(0, 1000) }),
  });
}
