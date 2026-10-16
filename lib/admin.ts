import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "./auth";
import { db } from "./db";
import type { Site } from "./types";

/** Vérifie la session dans chaque action serveur (en plus du middleware). */
export async function requireAdmin() {
  const ok = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!ok) redirect("/admin/login");
}

/** Numéro de couleur fixe par boutique (suit la boutique, pas son rang). */
export function siteSlots(sites: Site[]) {
  const sorted = [...sites].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  return Object.fromEntries(sorted.map((s, i) => [s.id, (i % 8) + 1])) as Record<string, number>;
}

export function siteColors(sites: Site[]) {
  const slots = siteSlots(sites);
  return Object.fromEntries(Object.entries(slots).map(([id, n]) => [id, `var(--series-${n})`])) as Record<string, string>;
}

/** Les couleurs claires (jaune, rose) prennent une lettre foncée pour rester lisibles. */
export const darkText = (slot: number) => slot === 4 || slot === 5;

/** Boutique filtrée via ?site=… (absente = toutes les boutiques). */
export async function adminContext(siteParam?: string) {
  const sites = await db.listSites();
  const colors = siteColors(sites);
  const slots = siteSlots(sites);
  const current = sites.find((s) => s.id === siteParam) ?? null;
  return { sites, colors, slots, current, siteId: current?.id };
}

export function qs(params: Record<string, string | number | undefined | null>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
}
