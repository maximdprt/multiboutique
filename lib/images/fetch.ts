import "server-only";
// Téléchargement d'une image : délai limité, taille limitée, type vérifié, nouvel essai en cas d'échec réseau.
// Refuse les adresses internes (réseau local, serveur lui-même) : une adresse collée dans l'admin
// ne doit pas permettre de lire autre chose qu'une image publique.
import dns from "node:dns/promises";
import net from "node:net";
import fs from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 20 * 1024 * 1024;
const UA = "MultiboutiqueImages/1.0 (+import d'images produits)";

export function isPrivateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
}

async function assertPublic(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("adresse non prise en charge (http ou https seulement)");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) throw new Error("adresse interne refusée");
  const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((a) => a.address);
  if (!ips.length || ips.some(isPrivateIp)) throw new Error("adresse interne refusée");
}

export type Downloaded = { data: Buffer; contentType: string; url: string };

/** Télécharge une image publique (2 nouveaux essais espacés en cas d'erreur réseau ou serveur). */
export async function downloadImage(src: string, attempts = 3): Promise<Downloaded> {
  // Images de démonstration (public/demo) : lues directement sur le disque
  if (src.startsWith("/demo/")) {
    const file = path.join(process.cwd(), "public", ...src.split("/").filter((s) => s && s !== ".."));
    return { data: await fs.readFile(file), contentType: src.endsWith(".svg") ? "image/svg+xml" : "image/*", url: src };
  }
  let url = new URL(src);
  let lastError: Error = new Error("échec");
  for (let i = 0; i < attempts; i++) {
    try {
      // On suit les redirections à la main pour vérifier chaque étape
      for (let hop = 0; hop < 5; hop++) {
        await assertPublic(url);
        const res = await fetch(url, { redirect: "manual", headers: { "User-Agent": UA, Accept: "image/avif,image/webp,image/*;q=0.9" }, signal: AbortSignal.timeout(20_000) });
        if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
          url = new URL(res.headers.get("location")!, url);
          continue;
        }
        if (res.status >= 500) throw new Error(`serveur indisponible (${res.status})`);
        if (!res.ok) throw Object.assign(new Error(`image introuvable (${res.status})`), { final: true });
        const type = res.headers.get("content-type") ?? "";
        if (!type.startsWith("image/")) throw Object.assign(new Error(`ce n'est pas une image (${type || "type inconnu"})`), { final: true });
        const length = Number(res.headers.get("content-length") ?? 0);
        if (length > MAX_BYTES) throw Object.assign(new Error("image trop lourde (plus de 20 Mo)"), { final: true });
        const data = Buffer.from(await res.arrayBuffer());
        if (data.length > MAX_BYTES) throw Object.assign(new Error("image trop lourde (plus de 20 Mo)"), { final: true });
        return { data, contentType: type, url: url.toString() };
      }
      throw Object.assign(new Error("trop de redirections"), { final: true });
    } catch (e) {
      lastError = e as Error;
      if ((e as { final?: boolean }).final || /refusée|non prise en charge/.test(lastError.message)) break;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastError;
}
