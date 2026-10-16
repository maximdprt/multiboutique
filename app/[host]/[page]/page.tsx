import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { siteFromHost, siteUrl } from "@/lib/sites";
import { RichText } from "@/lib/richtext";
import { LEGAL_PAGES } from "../legal";

type Props = { params: Promise<{ host: string; page: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { host, page } = await params;
  const site = await siteFromHost(host);
  const def = LEGAL_PAGES[page];
  if (!site || !def) return {};
  return { title: def.title, description: def.description(site), alternates: { canonical: siteUrl(site, `/${page}`) } };
}

export default async function LegalPage({ params }: Props) {
  const { host, page } = await params;
  const site = await siteFromHost(host);
  const def = LEGAL_PAGES[page];
  if (!site || !def) notFound();
  return (
    <div className="wrap">
      <article className="article">
        <header>
          <h1>{def.title}</h1>
        </header>
        <RichText source={def.body(site)} className="prose" />
      </article>
    </div>
  );
}
