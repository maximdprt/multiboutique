import { db } from "@/lib/db";
import { hasClaude } from "@/lib/agents/claude";
import { Wizard } from "./Wizard";

// les agents lancés depuis cette page peuvent travailler jusqu'à 5 minutes
export const maxDuration = 300;

export const metadata = { title: "Créer une boutique" };

type Props = { searchParams: Promise<{ opportunite?: string }> };

export default async function Create({ searchParams }: Props) {
  const { opportunite } = await searchParams;
  const [chosen, list, sites] = await Promise.all([
    opportunite ? db.getOpportunity(opportunite) : null,
    db.listOpportunities({ limit: 40 }),
    db.listSites(),
  ]);
  const ideas = list.filter((o) => o.status === "nouvelle" || o.status === "retenue").slice(0, 6);
  const ref = sites[0];
  return (
    <>
      <a href="/admin/boutiques" className="back">
        ‹ Boutiques
      </a>
      <div className="page-head">
        <div>
          <h1>Créer une boutique</h1>
          <p className="sub">Vous répondez à quelques questions, l&apos;agent s&apos;occupe du reste.</p>
        </div>
      </div>
      <Wizard
        demo={!hasClaude()}
        initial={chosen ? { id: chosen.id, niche: chosen.niche, product: chosen.product, notes: chosen.summary } : null}
        ideas={ideas.map((o) => ({ id: o.id, niche: o.niche, product: o.product, score: o.score, notes: o.summary }))}
        defaults={{
          countries: (ref?.shipping.countries ?? ["FR", "BE", "LU"]).join(", "),
          flat: ref ? (ref.shipping.flat_cents / 100).toFixed(2).replace(".", ",") : "4,90",
          free: ref ? (ref.shipping.free_from_cents / 100).toFixed(2).replace(".", ",") : "49,00",
          delay: ref?.shipping.delay ?? "5 à 8 jours ouvrés",
          returnDays: ref?.return_days ?? 14,
        }}
      />
    </>
  );
}
