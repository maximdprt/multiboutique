import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { siteFromHost, siteUrl } from "@/lib/sites";
import { date } from "@/lib/format";
import { StoreLink } from "@/components/store";

type Props = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await siteFromHost((await params).host);
  if (!site) return {};
  return {
    title: "Guides et conseils",
    description: `Conseils pratiques et guides d'achat par ${site.name}.`,
    alternates: { canonical: siteUrl(site, "/guides") },
  };
}

export default async function Guides({ params }: Props) {
  const site = await siteFromHost((await params).host);
  if (!site) notFound();
  const guides = await db.listGuides({ siteId: site.id, publishedOnly: true });
  return (
    <div className="wrap">
      <header className="page-title">
        <h1>Guides et conseils</h1>
        <p>Des réponses concrètes aux questions qu&apos;on nous pose le plus souvent.</p>
      </header>
      <section className="section" style={{ paddingBottom: 72 }}>
        {guides.length ? (
          <ul className="guide-list">
            {guides.map((g) => (
              <li key={g.id}>
                <StoreLink href={`/guides/${g.slug}`}>
                  <h3>{g.title}</h3>
                  <p>{g.excerpt}</p>
                  <p style={{ fontSize: "0.9rem" }}>Mis à jour le {date(g.updated_at)}</p>
                </StoreLink>
              </li>
            ))}
          </ul>
        ) : (
          <p>Les premiers guides arrivent bientôt.</p>
        )}
      </section>
    </div>
  );
}
