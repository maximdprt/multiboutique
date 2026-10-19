import "server-only";
// Galerie d'un produit : ordre, photo principale, retrait, textes alternatifs.
// L'ordre de product.images fait foi ; les lignes media suivent (position).
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { removeFile, isStored } from "../storage";
import type { Media, Product } from "../types";

async function load(productId: string) {
  const p = await db.getProduct(productId);
  if (!p) throw new Error("Produit introuvable");
  return p;
}

async function saveOrder(p: Product, images: string[]) {
  await db.saveProduct({ id: p.id, site_id: p.site_id, images });
  const media = await db.listMedia({ productId: p.id });
  for (const m of media) {
    const position = images.indexOf(m.url);
    if (position >= 0 && position !== m.position) await db.saveMedia({ id: m.id, site_id: m.site_id, url: m.url, position });
  }
  revalidatePath("/", "layout");
}

/** Déplace une image d'un cran (-1 = vers le début). */
export async function moveImage(productId: string, url: string, delta: -1 | 1) {
  const p = await load(productId);
  const i = p.images.indexOf(url);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= p.images.length) return;
  const images = [...p.images];
  [images[i], images[j]] = [images[j], images[i]];
  await saveOrder(p, images);
}

/** Met l'image en premier : c'est la photo des grilles, de Google Shopping et des partages. */
export async function setMainImage(productId: string, url: string) {
  const p = await load(productId);
  if (!p.images.includes(url)) return;
  await saveOrder(p, [url, ...p.images.filter((u) => u !== url)]);
}

/** Retire l'image de la galerie ; le fichier est supprimé s'il est chez nous et ne sert plus ailleurs. */
export async function removeImage(productId: string, url: string) {
  const p = await load(productId);
  await saveOrder(
    p,
    p.images.filter((u) => u !== url),
  );
  const media = (await db.listMedia({ productId })).filter((m) => m.url === url);
  for (const m of media) {
    if (isStored(m.url)) await removeFile(m.path).catch(() => {});
    await db.deleteMedia(m.id);
  }
}

/** Texte alternatif (lu par Google Images et les lecteurs d'écran). */
export async function setImageAlt(productId: string, url: string, alt: string) {
  const p = await load(productId);
  const m = (await db.listMedia({ productId })).find((x) => x.url === url);
  const clean = alt.trim().slice(0, 160);
  if (m) await db.saveMedia({ id: m.id, site_id: m.site_id, url: m.url, alt: clean });
  else await db.saveMedia({ site_id: p.site_id, product_id: p.id, url, alt: clean, source: "url", source_url: url, position: p.images.indexOf(url) });
  revalidatePath("/", "layout");
}

/** Images de la galerie avec leurs informations (qualité, source, texte alternatif). */
export async function galleryOf(p: Product): Promise<(Pick<Media, "url" | "alt"> & Partial<Media>)[]> {
  const media = await db.listMedia({ productId: p.id });
  return p.images.map((url, i) => media.find((m) => m.url === url) ?? { url, alt: i === 0 ? p.title : `${p.title}, vue ${i + 1}` });
}
