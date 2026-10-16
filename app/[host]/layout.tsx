import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/schibsted-grotesk";
import "./store.css";
import { siteFromHost, siteUrl } from "@/lib/sites";
import { CartLink, CartProvider } from "@/components/cart";
import { PageviewTracker } from "@/components/track";
import { LEGAL_PAGES } from "./legal";

type Props = { children: ReactNode; params: Promise<{ host: string }> };

export const revalidate = 300;

function favicon(letter: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><text x="32" y="44" font-family="Georgia,serif" font-size="38" text-anchor="middle" fill="#fff">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await siteFromHost((await params).host);
  if (!site) return { title: "Boutique introuvable", robots: { index: false } };
  return {
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
  const site = await siteFromHost((await params).host);

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
    <html lang="fr" data-font={t.font} style={vars}>
      <body>
        <CartProvider siteId={site.id}>
          <PageviewTracker />
          <a className="skip" href="#contenu">
            Aller au contenu
          </a>
          <header className="site-header">
            <div className="wrap">
              <a className="wordmark" href="/">
                {site.name}
              </a>
              <nav className="nav" aria-label="Navigation principale">
                <a href="/produits">Produits</a>
                <a href="/guides" className="hide-sm">
                  Guides
                </a>
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
                    <a href="/produits">Tous les produits</a>
                  </li>
                  <li>
                    <a href="/guides">Guides et conseils</a>
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
                      <a href={`/${slug}`}>{page.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
