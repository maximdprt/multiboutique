import "server-only";
// Tâche quotidienne de l'agent Images : chaque image de chaque produit en ligne doit répondre.
//  - image encore hébergée ailleurs (ajoutée à la main) : rapatriée chez nous et contrôlée ;
//  - image chez nous qui ne répond plus : récupérée à nouveau depuis sa source, sinon retirée de la galerie ;
//  - produit sans aucune image : signalé (et l'agent tente le fournisseur s'il est connu).
import { db } from "../db";
import { isStored } from "../storage";
import { importProductImages } from "./agent";
import { removeImage } from "./gallery";

/** L'image répond-elle ? (adresses internes /medias et /demo : toujours servies par le site) */
async function alive(url: string) {
  if (url.startsWith("/")) return true;
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(10_000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function checkAllImages(log: (s: string) => void = () => {}, limit = 60) {
  const products = (await db.listProducts({ activeOnly: true })).slice(0, limit);
  let repaired = 0;
  let mirrored = 0;
  let removed = 0;
  const empty: string[] = [];
  for (const p of products) {
    const external = p.images.filter((u) => /^https?:\/\//.test(u) && !isStored(u));
    const broken: string[] = [];
    for (const u of p.images.filter(isStored)) if (!(await alive(u))) broken.push(u);

    if (broken.length) {
      const media = await db.listMedia({ productId: p.id });
      const sources = broken.map((u) => media.find((m) => m.url === u)?.source_url ?? "").filter((s) => /^https?:\/\//.test(s));
      for (const u of broken) await removeImage(p.id, u);
      removed += broken.length;
      if (sources.length) {
        const r = await importProductImages(p.id, { urls: sources });
        repaired += r.imported.length;
      }
      log(`« ${p.title} » : ${broken.length} image(s) ne répondaient plus${sources.length ? ", récupérées à nouveau" : ", retirées"}.`);
    }
    if (external.length) {
      const r = await importProductImages(p.id);
      mirrored += r.imported.length;
      if (r.imported.length) log(`« ${p.title} » : ${r.imported.length} image(s) rapatriée(s) chez nous.`);
    }
    const fresh = await db.getProduct(p.id);
    if (fresh && !fresh.images.length) {
      const r = await importProductImages(p.id).catch(() => null);
      if (!r?.imported.length) empty.push(p.title);
    }
  }
  if (empty.length) log(`${empty.length} produit(s) sans image : ${empty.slice(0, 5).join(", ")}${empty.length > 5 ? "…" : ""}`);
  return { produits_verifies: products.length, rapatriees: mirrored, reparees: repaired, retirees: removed, sans_image: empty.length };
}
