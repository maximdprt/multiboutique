import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { siteFromHost } from "@/lib/sites";
import { CartView } from "@/components/CartView";

type Props = { params: Promise<{ host: string }> };

export const metadata: Metadata = { title: "Panier", robots: { index: false } };

export default async function Panier({ params }: Props) {
  const site = await siteFromHost((await params).host);
  if (!site) notFound();
  return (
    <div className="wrap">
      <header className="page-title">
        <h1>Votre panier</h1>
      </header>
      <CartView flat={site.shipping.flat_cents} freeFrom={site.shipping.free_from_cents} />
    </div>
  );
}
