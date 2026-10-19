import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/schibsted-grotesk";
import "@fontsource/kanit/300.css";
import "@fontsource/kanit/400.css";
import "@fontsource/kanit/500.css";
import "@fontsource/kanit/700.css";
import "@fontsource/kanit/800.css";
import "@fontsource/kanit/900.css";
import "./store.css";
import "./studio.css";
import { siteFromHost, siteUrl, storeBase } from "@/lib/sites";
import { CartLink, CartProvider } from "@/components/cart";
import { StoreLink, StoreProvider } from "@/components/store";
import { PageviewTracker } from "@/components/track";
import { LEGAL_PAGES } from "./legal";

type Props = { children: ReactNode; params: Promise<{ host: string }> };

export const revalidate = 300;

function favicon(letter: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><text x="32" y="44" font-family="Georgia,serif" font-size="38" text-anchor="middle" fill="#fff">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { host } = await params;
  const site = await siteFromHost(host);
  if (!site) return { title: "Boutique introuvable", robots: { index: false } };
  return {
    // Aperçu : jamais indexé (le middleware ajoute aussi l'en-tête X-Robots-Tag).
    ...(storeBase(host) ? { robots: { index: false, follow: false } } : {}),
    metadataBase: new URL(siteUrl(site)),
    title: { default: `${site.name} — ${site.tagline}`, template: `%s | ${site.name}` },
    description: site.description,
    applicationName: site.name,
    openGraph: { siteName: site.name, locale: "fr_FR", type: "website" },
    icons: { icon: favicon(site.name.charAt(0).toUpperCase(), site.theme.primary) },
    formatDetection: { telephone: false },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const site = await siteFromHost((await params).host);
  return { themeColor: site?.theme.background ?? "#ffffff" };
}

export default async function StoreLayout({ children, params }: Props) {
  const { host } = await params;
  const site = await siteFromHost(host);
  const base = storeBase(host);

  if (!site) {
    return (
      <html lang="fr">
        <body style={{ fontFamily: "system-ui", padding: 40 }}>
          <h1>Boutique introuvable</h1>
          <p>Aucune boutique n&apos;est associée à ce nom de domaine. Ajoutez-le dans l&apos;admin, rubrique Boutiques.</p>
        </body>
      </html>
    );
  }

  const t = site.theme;
  const vars = { "--bg": t.background, "--ink": t.ink, "--primary": t.primary, "--accent": t.accent } as CSSProperties;

  return (
    <html lang="fr" data-font={t.font} data-template={t.template ?? "classique"} style={vars}>
      <body>
        {/* Sans JavaScript, les éléments animés du gabarit Studio restent visibles. */}
        <noscript>
          <style>{".fade{opacity:1!important;transform:none!important}"}</style>
        </noscript>
        <StoreProvider siteId={site.id} base={base}>
        <CartProvider siteId={site.id}>
          {/* Les visites de l'aperçu ne comptent pas dans les statistiques. */}
          {!base && <PageviewTracker />}
          {base && (
            <p className="preview-bar" role="status">
              Aperçu{site.active ? "" : " d'une boutique hors ligne"} : cette adresse n&apos;est pas indexée par les moteurs de recherche.
            </p>
          )}
          <a className="skip" href="#contenu">
            Aller au contenu
          </a>
          <header className="site-header">
            <div className="wrap">
              <StoreLink className="wordmark" href="/">
                {site.name}
              </StoreLink>
              <nav className="nav" aria-label="Navigation principale">
                <StoreLink href="/produits">Produits</StoreLink>
                {t.template === "studio" && (
                  <StoreLink href="/#a-propos" className="hide-sm">
                    À propos
                  </StoreLink>
                )}
                <StoreLink href="/guides" className="hide-sm">
                  Guides
                </StoreLink>
                <CartLink />
              </nav>
            </div>
          </header>
          <main id="contenu">{children}</main>
          <footer className="site-footer">
            <div className="wrap">
              <div>
                <strong>{site.name}</strong>
                <p>{site.description}</p>
              </div>
              <div>
                <strong>La boutique</strong>
                <ul>
                  <li>
                    <StoreLink href="/produits">Tous les produits</StoreLink>
                  </li>
                  <li>
                    <StoreLink href="/guides">Guides et conseils</StoreLink>
                  </li>
                  <li>
                    <a href={`mailto:${site.legal.email}`}>{site.legal.email}</a>
                  </li>
                </ul>
              </div>
              <div>
                <strong>Informations</strong>
                <ul>
                  {Object.entries(LEGAL_PAGES).map(([slug, page]) => (
                    <li key={slug}>
                      <StoreLink href={`/${slug}`}>{page.title}</StoreLink>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </footer>
        </CartProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
