// Session admin : un cookie signé (HMAC-SHA256). Fonctionne aussi dans le middleware (Edge).
export const SESSION_COOKIE = "admin_session";
const THIRTY_DAYS = 30 * 24 * 3600 * 1000;
const enc = new TextEncoder();

/**
 * Mot de passe de l'admin.
 * - ADMIN_PASSWORD si défini
 * - "demo" en mode démo (Supabase non configuré)
 * - sinon null : connexion impossible tant que ADMIN_PASSWORD n'est pas défini
 */
export function adminPassword(): string | null {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (!process.env.SUPABASE_URL) return "demo";
  return null;
}

function secret() {
  return process.env.ADMIN_SECRET || `${adminPassword() ?? ""}-session-secret`;
}

async function sign(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string) {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function createSessionToken() {
  const exp = String(Date.now() + THIRTY_DAYS);
  return { token: `${exp}.${await sign(exp)}`, maxAge: THIRTY_DAYS / 1000 };
}

export async function verifySessionToken(token: string | undefined) {
  if (!token || !adminPassword()) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await sign(exp));
}
