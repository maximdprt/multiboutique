// Adresse d'aperçu : https://<adresse-vercel>/apercu/<id-boutique>/… affiche la boutique avant l'achat de son domaine.
// Le middleware réécrit /apercu/bocal/produits vers /apercu~bocal/produits (dossier app/[host]) ;
// les liens de la boutique gardent le préfixe /apercu/bocal grâce à withBase().
// Utilisable côté serveur, dans le middleware (Edge) et dans le navigateur.

/** Valeur du segment [host] pour un aperçu : "apercu~<id>". */
export const PREVIEW_PREFIX = "apercu~";

const PREVIEW_PATH = /^\/apercu\/([a-z0-9-]+)(\/.*)?$/;

/** "/apercu/bocal/produits" -> { id: "bocal", rest: "/produits" } ; null si ce n'est pas une adresse d'aperçu. */
export function parsePreviewPath(path: string): { id: string; rest: string } | null {
  const m = PREVIEW_PATH.exec(path);
  return m ? { id: m[1], rest: m[2] || "/" } : null;
}

/** Identifiant de la boutique si le segment [host] désigne un aperçu, sinon null. */
export function previewIdOf(hostParam: string): string | null {
  const host = decodeURIComponent(hostParam).toLowerCase();
  return host.startsWith(PREVIEW_PREFIX) ? host.slice(PREVIEW_PREFIX.length) || null : null;
}

/** Début des adresses de la boutique : "" sur son domaine, "/apercu/<id>" en aperçu. */
export function previewBase(id: string) {
  return `/apercu/${id}`;
}

/** Préfixe un lien interne ("/produits") par la base de l'aperçu. Les liens externes, ancres et mailto ne changent pas. */
export function withBase(base: string, href: string) {
  if (!base || !href.startsWith("/") || href.startsWith("//")) return href;
  if (href === "/") return base;
  return href.startsWith("/?") || href.startsWith("/#") ? base + href.slice(1) : base + href;
}
