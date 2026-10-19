// Aiguillage par nom de domaine :
//   bocal-et-cie.fr/produits/x  ->  /bocal-et-cie.fr/produits/x  (app/[host]/...)
//   n'importe-quel-domaine/admin -> l'admin (protégé par mot de passe)
//   ADMIN_HOST (ex. admin.mondomaine.fr) -> uniquement l'admin
//   n'importe-quel-domaine/apercu/bocal/x -> aperçu de la boutique "bocal" (/apercu~bocal/x), jamais indexé
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/auth";
import { PREVIEW_PREFIX, parsePreviewPath } from "./lib/store-path";

const SITE_FILES = new Set(["/sitemap.xml", "/robots.txt", "/llms.txt", "/feed.xml"]);

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;
  const host = (req.headers.get("host") ?? "localhost").toLowerCase().replace(/:\d+$/, "");
  const adminHost = process.env.ADMIN_HOST?.toLowerCase();

  if (path.startsWith("/api/")) return NextResponse.next();

  if (path === "/admin" || path.startsWith("/admin/")) {
    if (path === "/admin/login") return NextResponse.next();
    const ok = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
    if (!ok) {
      const login = new URL("/admin/login", req.url);
      if (path !== "/admin") login.searchParams.set("next", path + url.search);
      return NextResponse.redirect(login);
    }
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  // Adresse d'aperçu d'une boutique (avant l'achat du domaine) : jamais indexée par les moteurs.
  const preview = parsePreviewPath(path);
  if (preview) {
    const res = NextResponse.rewrite(new URL(`/${encodeURIComponent(PREVIEW_PREFIX + preview.id)}${preview.rest}${url.search}`, req.url));
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  // Le domaine d'administration ne sert pas de boutique.
  if (adminHost && host === adminHost) {
    if (path === "/robots.txt") return new NextResponse("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain" } });
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  // Fichier de vérification IndexNow (https://domaine/CLE.txt)
  const indexNow = process.env.INDEXNOW_KEY;
  if (indexNow && path === `/${indexNow}.txt`) return new NextResponse(indexNow, { headers: { "content-type": "text/plain" } });

  // Fichiers du dossier public (images, favicon…) : on ne touche à rien.
  if (/\.[a-z0-9]+$/i.test(path) && !SITE_FILES.has(path)) return NextResponse.next();

  // Redirection www -> domaine nu (une seule adresse par page = meilleur SEO).
  if (host.startsWith("www.")) {
    const target = new URL(req.url);
    target.hostname = host.slice(4);
    target.port = "";
    return NextResponse.redirect(target, 308);
  }

  return NextResponse.rewrite(new URL(`/${encodeURIComponent(host)}${path}${url.search}`, req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
