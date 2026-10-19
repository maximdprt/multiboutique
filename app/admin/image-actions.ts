"use server";
// Actions de la section Images de la fiche produit.
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { runNow } from "@/lib/agents/run";
import { importProductImages } from "@/lib/images/agent";
import { moveImage, removeImage, setImageAlt, setMainImage } from "@/lib/images/gallery";

const back = (id: string, msg: string) => redirect(`/admin/produits/${id}?images=${encodeURIComponent(msg)}#images`);
const pid = (f: FormData) => String(f.get("product_id") ?? "");

async function runImport(id: string, title: string, opts: Parameters<typeof importProductImages>[1]) {
  let message = "";
  const run = await runNow("images", title, null, async (ctx) => {
    const r = await importProductImages(id, { ...opts, log: ctx.log });
    message = r.message;
    return { importees: r.imported.length, ecartees: r.rejected.length };
  });
  return run?.status === "echec" ? `Échec : ${String(run.result?.error ?? "erreur inconnue")}` : message;
}

/** « Récupérer les images » : fournisseur (CJ), images externes à rapatrier, illustrations de démo. */
export async function fetchProductImages(f: FormData) {
  await requireAdmin();
  const id = pid(f);
  back(id, await runImport(id, "Récupération des images", { replace: f.get("replace") === "on" }));
}

/** Adresses d'images collées par le propriétaire (fabricant, photos d'un shooting…). */
export async function addImageUrls(f: FormData) {
  await requireAdmin();
  const id = pid(f);
  const urls = String(f.get("urls") ?? "")
    .split(/\s+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u))
    .slice(0, 20);
  if (!urls.length) back(id, "Collez au moins une adresse d'image commençant par https://");
  back(id, await runImport(id, "Ajout d'images par adresse", { urls }));
}

/** Photos envoyées depuis l'ordinateur. */
export async function uploadImages(f: FormData) {
  await requireAdmin();
  const id = pid(f);
  const files = f
    .getAll("files")
    .filter((x): x is File => typeof x === "object" && "arrayBuffer" in x && x.size > 0)
    .slice(0, 12);
  if (!files.length) back(id, "Choisissez au moins une photo.");
  if (files.some((x) => x.size > 20 * 1024 * 1024)) back(id, "Une photo dépasse 20 Mo : réduisez-la avant de l'envoyer.");
  const data = await Promise.all(files.map(async (x) => ({ name: x.name, data: Buffer.from(await x.arrayBuffer()) })));
  back(id, await runImport(id, "Envoi de photos", { files: data }));
}

export async function moveProductImage(f: FormData) {
  await requireAdmin();
  const id = pid(f);
  await moveImage(id, String(f.get("url")), f.get("dir") === "-1" ? -1 : 1);
  back(id, "Ordre mis à jour.");
}

export async function setMainProductImage(f: FormData) {
  await requireAdmin();
  const id = pid(f);
  await setMainImage(id, String(f.get("url")));
  back(id, "Photo principale changée.");
}

export async function removeProductImage(f: FormData) {
  await requireAdmin();
  const id = pid(f);
  await removeImage(id, String(f.get("url")));
  back(id, "Image retirée.");
}

export async function saveImageAlt(f: FormData) {
  await requireAdmin();
  const id = pid(f);
  await setImageAlt(id, String(f.get("url")), String(f.get("alt") ?? ""));
  back(id, "Texte alternatif enregistré.");
}
