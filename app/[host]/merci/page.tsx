import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { siteFromHost } from "@/lib/sites";
import { ClearCart } from "@/components/cart";

type Props = { params: Promise<{ host: string }>; searchParams: Promise<{ session_id?: string; commande?: string }> };

export const metadata: Metadata = { title: "Merci pour votre commande", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Merci({ params, searchParams }: Props) {
  const site = await siteFromHost((await params).host);
  if (!site) notFound();
  const { session_id } = await searchParams;
  // Le webhook Stripe arrive en général en moins d'une seconde, mais il peut avoir un léger retard.
  const order = session_id ? await db.getOrderBySession(session_id) : null;
  const number = order?.number ?? (await searchParams).commande;

  return (
    <div className="wrap">
      <ClearCart />
      <section className="page-title" style={{ paddingBottom: 96 }}>
        <h1>Merci, votre commande est confirmée.</h1>
        <p>
          {number ? `Commande n° ${number}. ` : ""}Vous allez recevoir un e-mail de confirmation, puis un second avec le numéro de suivi
          dès l&apos;expédition (délai indicatif : {site.shipping.delay}).
        </p>
        <p>
          Une question ? Écrivez-nous à <a href={`mailto:${site.legal.email}`}>{site.legal.email}</a>.
        </p>
        <p style={{ marginTop: 28 }}>
          <a className="btn btn-quiet" href="/">
            Retour à la boutique
          </a>
        </p>
      </section>
    </div>
  );
}
