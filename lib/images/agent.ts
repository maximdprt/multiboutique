import "server-only";
// Agent Images : récupère les images d'un produit, garde les meilleures et les range chez nous.
//
//  1. Sources autorisées seulement : le fournisseur (API CJ : photos fournies pour la revente),
//     des adresses d'images collées par le propriétaire, ses envois, et en démo les illustrations locales.
//     Jamais les photos d'une autre boutique (règle n° 1 du projet).
//  2. Chaque image est téléchargée, mesurée (résolution, netteté, cadrage, fond) et refusée si elle est
//     trop petite, floue ou en bannière ; les doublons (même photo redimensionnée) sont écartés.
//  3. La photo principale est choisie : celle de la variante vendue si elle est bonne, sinon la plus nette
//     sur fond uni ; puis les autres par qualité, 8 au plus.
//  4. Traitement (redressée, mise au carré si fond uni, agrandie à 1200 px, WebP) puis stockage chez nous
//     (Supabase Storage) : les images ne cassent plus si le fournisseur change ses adresses.
//  5. Relançable sans doublon : une image déjà importée (même empreinte) n'est pas refaite.
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { putFile, removeFile, isStored } from "../storage";
import { hasCJ, productImages as cjProductImages } from "../suppliers/cj";
import type { Media, MediaSource, Product } from "../types";
import { downloadImage } from "./fetch";
import { DUPLICATE_DISTANCE, analyzeImage, hashDistance, judge, mainCandidateBonus, processImage, type ImageInfo } from "./quality";

export const MAX_IMAGES = 8;

export type Candidate = {
  url: string;
  source: MediaSource;
  /** image de la variante vendue */
  preferred?: boolean;
  /** fichier déjà reçu (envoi depuis l'admin) : pas de téléchargement */
  data?: Buffer;
};
export type Rejected = { url: string; reason: string };
export type ImportResult = { imported: Media[]; kept: Media[]; rejected: Rejected[]; message: string };

type Scored = Candidate & { data: Buffer; info: ImageInfo; score: number };

/** Où chercher les images de ce produit. */
export async function findCandidates(p: Product, extraUrls: string[] = [], log: (s: string) => void = () => {}): Promise<Candidate[]> {
  const out: Candidate[] = extraUrls.filter(Boolean).map((url) => ({ url: url.trim(), source: "url" as const }));
  if (hasCJ() && (p.supplier_variant_id || /cjdropshipping\.com/i.test(p.supplier_url))) {
    try {
      const cj = await cjProductImages({ vid: p.supplier_variant_id, url: p.supplier_url });
      log(`CJ : ${cj.images.length} image(s) trouvée(s) pour « ${cj.name || p.title} ».`);
      out.push(...cj.images.map((url) => ({ url, source: "cj" as const, preferred: url === cj.variantImage })));
    } catch (e) {
      log(`CJ : ${(e as Error).message}`);
    }
  }
  // Démo : les illustrations fournies avec les boutiques d'exemple
  for (const url of p.images.filter((u) => u.startsWith("/demo/"))) out.push({ url, source: "demo" });
  // Images encore hébergées ailleurs (ajoutées à la main avant l'agent) : on les rapatrie
  for (const url of p.images.filter((u) => /^https?:\/\//.test(u) && !isStored(u))) out.push({ url, source: "url" });
  const seen = new Set<string>();
  return out.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
}

/** Télécharge et note les candidates ; écarte les mauvaises et les doublons. */
export async function scoreCandidates(cands: Candidate[], known: Pick<Media, "hash">[] = []) {
  const rejected: Rejected[] = [];
  const scored: Scored[] = [];
  // 4 téléchargements à la fois
  for (let i = 0; i < cands.length; i += 4) {
    await Promise.all(
      cands.slice(i, i + 4).map(async (c) => {
        try {
          const data = c.data ?? (await downloadImage(c.url)).data;
          const info = await analyzeImage(data);
          const v = judge(info);
          if (!v.ok) return rejected.push({ url: c.url, reason: v.reasons.join(", ") });
          scored.push({ ...c, data, info, score: v.score });
        } catch (e) {
          rejected.push({ url: c.url, reason: (e as Error).message });
        }
      }),
    );
  }
  // Doublons : on garde la meilleure version de chaque photo
  const unique: Scored[] = [];
  for (const s of [...scored].sort((a, b) => b.score - a.score || Number(Boolean(b.preferred)) - Number(Boolean(a.preferred)))) {
    if (known.some((k) => hashDistance(k.hash, s.info.hash) <= DUPLICATE_DISTANCE)) {
      rejected.push({ url: s.url, reason: "déjà dans les images du produit" });
      continue;
    }
    const twin = unique.find((u) => hashDistance(u.info.hash, s.info.hash) <= DUPLICATE_DISTANCE);
    if (twin) {
      twin.preferred ||= s.preferred;
      rejected.push({ url: s.url, reason: "doublon d'une meilleure version" });
      continue;
    }
    unique.push(s);
  }
  return { scored: unique, rejected };
}

/** Ordre de la galerie : la photo de la variante vendue si elle est bonne, sinon la meilleure sur fond uni. */
export function orderGallery<T extends { score: number; preferred?: boolean; info: Pick<ImageInfo, "borderUniformity" | "lightBorder"> }>(items: T[]) {
  const mainScore = (s: T) => s.score + mainCandidateBonus(s.info as ImageInfo) + (s.preferred && s.score >= 60 ? 30 : 0);
  const main = [...items].sort((a, b) => mainScore(b) - mainScore(a))[0];
  return main ? [main, ...items.filter((s) => s !== main).sort((a, b) => b.score - a.score)] : [];
}

const altFor = (p: Product, i: number) => (i === 0 ? p.title : `${p.title}, vue ${i + 1}`);

/**
 * Importe les images du produit.
 *  - `urls` : adresses d'images à ajouter (collées dans l'admin) ;
 *  - `replace` : remplace la galerie par le résultat (sinon ajoute à la suite des images déjà rangées chez nous).
 */
export async function importProductImages(
  productId: string,
  opts: { urls?: string[]; files?: { name: string; data: Buffer }[]; replace?: boolean; log?: (s: string) => void } = {},
): Promise<ImportResult> {
  const log = opts.log ?? (() => {});
  const p = await db.getProduct(productId);
  if (!p) throw new Error("Produit introuvable");
  const existing = (await db.listMedia({ productId: p.id })).filter((m) => p.images.includes(m.url));
  const keep = opts.replace ? [] : existing;

  // Photos envoyées depuis l'admin : seules sources de cet import (on ne va pas chercher ailleurs en même temps)
  const cands = opts.files?.length
    ? opts.files.map((f) => ({ url: `envoi:${f.name}`, source: "upload" as const, data: f.data }))
    : await findCandidates(p, opts.urls, log);
  if (!cands.length) {
    const message = hasCJ()
      ? "Aucune image à récupérer : renseignez l'identifiant de variante CJ (vid) ou l'adresse du produit chez CJ, ou collez des adresses d'images."
      : "Aucune image à récupérer : collez des adresses d'images ou envoyez vos photos (la récupération chez CJ demande CJ_API_KEY).";
    return { imported: [], kept: keep, rejected: [], message };
  }
  log(`${cands.length} image(s) candidate(s) : téléchargement et contrôle de qualité…`);
  const { scored, rejected } = await scoreCandidates(cands, keep);
  const room = Math.max(0, MAX_IMAGES - keep.length);
  const chosen = (keep.length ? [...scored].sort((a, b) => b.score - a.score) : orderGallery(scored)).slice(0, room);

  const imported: Media[] = [];
  for (const [i, s] of chosen.entries()) {
    const out = await processImage(s.data, s.info);
    const { url, path } = await putFile(`sites/${p.site_id}/produits/${p.slug}/${s.info.hash}.webp`, out.data, "image/webp");
    const position = keep.length + i;
    imported.push(
      await db.saveMedia({
        site_id: p.site_id,
        product_id: p.id,
        url,
        path,
        width: out.width,
        height: out.height,
        bytes: out.data.length,
        alt: altFor(p, position),
        source: s.source,
        source_url: s.source === "upload" ? "" : s.url,
        score: s.score,
        hash: s.info.hash,
        notes: out.notes,
        position,
      }),
    );
    log(`Image ${position + 1} : qualité ${s.score}/100${out.notes.length ? ` (${out.notes.join(", ")})` : ""}.`);
  }
  for (const r of rejected) log(`Écartée : ${r.reason}`);

  if (imported.length || opts.replace) {
    const gallery = [...keep, ...imported];
    // Les illustrations de démonstration et adresses externes sont remplacées par les images rangées chez nous
    await db.saveProduct({ id: p.id, site_id: p.site_id, images: gallery.map((m) => m.url) });
    if (opts.replace) for (const m of existing.filter((m) => !gallery.includes(m))) await removeMedia(m);
    revalidatePath("/", "layout");
  }
  const message = imported.length
    ? `${imported.length} image(s) importée(s)${rejected.length ? `, ${rejected.length} écartée(s)` : ""}.`
    : `Aucune nouvelle image retenue${rejected.length ? ` (${rejected.length} écartée(s) : ${[...new Set(rejected.map((r) => r.reason))].slice(0, 2).join(" ; ")})` : ""}.`;
  return { imported, kept: keep, rejected, message };
}

/** Supprime une image : fichier et ligne. */
export async function removeMedia(m: Media) {
  await removeFile(m.path).catch(() => {});
  await db.deleteMedia(m.id);
}
