// Mesure d'audience sans cookie : chaque page vue envoie un petit signal ici.
// Ni adresse IP ni identifiant conservés : seulement une empreinte anonyme du jour
// (hachée avec un sel qui change chaque jour) pour compter les visiteurs uniques.
import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { normalizeHost, siteFromHost } from "@/lib/sites";
import { classifySource, deviceOf, isBot } from "@/lib/analytics";
import { dayKeyOf } from "@/lib/dates";

const TYPES = new Set(["pageview", "add_to_cart", "checkout"]);
const ok = () => new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  if (isBot(ua) || req.headers.get("purpose") === "prefetch") return ok();
  const host = req.headers.get("host") ?? "";
  const site = await siteFromHost(host);
  if (!site) return ok();

  let body: { t?: string; p?: string; r?: string; u?: string };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return ok();
  }
  const type = String(body.t ?? "");
  if (!TYPES.has(type)) return ok();

  let refHost = "";
  try {
    refHost = body.r ? normalizeHost(new URL(body.r).hostname) : "";
  } catch {}
  const internal = refHost === normalizeHost(host) || refHost === site.domain;
  const source = classifySource(body.u || (internal ? "" : refHost));
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
  const day = dayKeyOf(Date.now());
  const salt = process.env.ANALYTICS_SALT || process.env.ADMIN_SECRET || "sel-par-defaut";
  const visitor = crypto.createHash("sha256").update(`${salt}|${day}|${site.id}|${ip}|${ua}`).digest("hex").slice(0, 24);

  try {
    await db.trackEvent({
      site_id: site.id,
      day,
      type: type as "pageview",
      path: String(body.p ?? "/").split(/[?#]/)[0].slice(0, 200) || "/",
      source,
      device: deviceOf(ua),
      country: (req.headers.get("x-vercel-ip-country") || "?").toUpperCase().slice(0, 2),
      visitor,
      entry: !internal,
    });
  } catch (e) {
    console.error("Mesure d'audience :", (e as Error).message);
  }
  return ok();
}
