import "server-only";
// Stockage des fichiers (images) : Supabase Storage, bucket public « medias », dès que Supabase est configuré ;
// sinon (mode démo) le dossier local .data/medias, servi par la route /medias/….
// Les images sont donc chez nous : elles ne disparaissent pas si le fournisseur change ses adresses.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./db";

export const BUCKET = "medias";

const LOCAL_DIR = process.env.DEMO_MEDIA_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), "medias") : path.join(process.cwd(), ".data", "medias"));

let client: SupabaseClient | null = null;
let bucketReady: Promise<void> | null = null;
function sb() {
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Crée le bucket public la première fois (sans effet s'il existe déjà). */
function ensureBucket() {
  bucketReady ??= (async () => {
    const { data } = await sb().storage.getBucket(BUCKET);
    if (data) return;
    const { error } = await sb().storage.createBucket(BUCKET, { public: true, fileSizeLimit: 20 * 1024 * 1024 });
    if (error && !/already exists/i.test(error.message)) throw new Error(`Stockage : ${error.message}`);
  })().catch((e) => {
    bucketReady = null;
    throw e;
  });
  return bucketReady;
}

/** "sites/bocal/produits/x/ab12.webp" : lettres, chiffres, tirets, points et barres seulement. */
export function safePath(p: string) {
  const clean = p
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/._-]+/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");
  if (!clean || clean.split("/").some((s) => s === ".." || s === ".")) throw new Error("Chemin de fichier invalide");
  return clean;
}

/** Enregistre un fichier et renvoie son adresse publique. Réécrit le fichier s'il existe. */
export async function putFile(p: string, data: Buffer, contentType: string): Promise<{ url: string; path: string }> {
  const key = safePath(p);
  if (isSupabaseConfigured) {
    await ensureBucket();
    const { error } = await sb().storage.from(BUCKET).upload(key, data, { contentType, upsert: true, cacheControl: "31536000" });
    if (error) throw new Error(`Stockage : ${error.message}`);
    return { url: sb().storage.from(BUCKET).getPublicUrl(key).data.publicUrl, path: key };
  }
  const file = path.join(LOCAL_DIR, ...key.split("/"));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
  return { url: `/medias/${key}`, path: key };
}

export async function removeFile(p: string) {
  if (!p) return;
  const key = safePath(p);
  if (isSupabaseConfigured) {
    await sb().storage.from(BUCKET).remove([key]);
    return;
  }
  await fs.rm(path.join(LOCAL_DIR, ...key.split("/")), { force: true });
}

/** Mode démo : lit un fichier du dossier local (route /medias/…). */
export async function readLocalFile(p: string) {
  return fs.readFile(path.join(LOCAL_DIR, ...safePath(p).split("/")));
}

/** L'adresse désigne-t-elle un fichier de notre stockage ? */
export function isStored(url: string) {
  if (url.startsWith("/medias/")) return true;
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  return Boolean(base && url.startsWith(`${base}/storage/v1/object/public/${BUCKET}/`));
}
