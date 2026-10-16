import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { qs, siteColors } from "@/lib/admin";
import { siteUrl } from "@/lib/sites";
import { change, dailySeries, dayLabel, isCounted, period, splitOrders, topProducts, totals } from "@/lib/stats";
import { AI_SOURCES, aiSessions, groupSources, sumDays, topEntries } from "@/lib/analytics";
import { money, moneyRound, number, percent } from "@/lib/format";
import type { Order } from "@/lib/types";
import { BarChart } from "../../../BarChart";
import { Delta, HBars, Metric, PERIOD_LABEL, PeriodSeg, parseDays } from "../../../bits";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ jours?: string }> };

export async function generateMetadata({ params }: Props) {
  return { title: (await db.getSite((await params).id))?.name ?? "Boutique" };
}

function profit(orders: Order[]) {
  return orders.filter(isCounted).reduce((s, o) => {
    const cost = o.items.reduce((x, i) => x + (i.unit_cost_cents ?? 0) * i.quantity, 0);
    return s + o.total_cents - cost - Math.round(o.total_cents * 0.015 + 25);
  }, 0);
}

const GROUP_COLORS: Record<string, string> = {
  "Assistants IA": "var(--series-7)",
  "Moteurs de recherche": "var(--series-1)",
  "Réseaux sociaux": "var(--series-2)",
  "Accès direct": "var(--series-3)",
  "Autres sites": "#8a8a8a",
};

export default async function SiteOverview({ params, searchParams }: Props) {
  const { id } = await params;
  const days = parseDays((await searchParams).jours, [7, 30, 90, 365], 30);
  const [site, sites] = await Promise.all([db.getSite(id), db.listSites()]);
  if (!site) notFound();
  const color = siteColors(sites)[site.id];
  const p = period(days);
  const [orders, analytics, products, guides] = await Promise.all([
    db.listOrders({ siteId: id, since: p.fetchSince }),
    db.analyticsDays({ siteId: id, since: p.prevStart, until: p.end }),
    db.listProducts({ siteId: id }),
    db.listGuides({ siteId: id }),
  ]);
  const { cur, prev } = splitOrders(orders, p);
  const t = totals(cur);
  const tp = totals(prev);
  const a = sumDays(analytics.filter((d) => d.day >= p.start));
  const ap = sumDays(analytics.filter((d) => d.day < p.start));
  const conv = a.sessions ? t.orders / a.sessions : 0;
  const convPrev = ap.sessions ? tp.orders / ap.sessions : 0;
  const series = [{ id: site.id, name: site.name, color }];
  const salesPoints = dailySeries(cur, p, [site.id]);
  const visitPoints = p.keys.map((key) => {
    const v = analytics.find((d) => d.day === key)?.sessions ?? 0;
    return { key, label: dayLabel(key), bySite: { [site.id]: v }, total: v, orders: 0 };
  });
  const steps = [
    { name: "Visites", value: a.sessions },
    { name: "Ajouts au panier", value: a.add_to_cart },
    { name: "Paiements commencés", value: a.checkouts },
    { name: "Commandes", value: t.orders },
  ];
  const top = topProducts(cur, 6);
  const noPhoto = products.filter((x) => x.active && (!x.images.length || x.images.every((i) => i.startsWith("/demo/")))).length;

  return (
    <>
      <a href="/admin/boutiques" className="back">
        ‹ Boutiques
      </a>
      <div className="page-head">
        <div>
          <h1 className="cell-site" style={{ gap: 10 }}>
            <i className="dot" style={{ background: color, width: 12, height: 12 }} />
            {site.name}
          </h1>
          <p className="sub">
            <a className="link-blue" href={siteUrl(site)} target="_blank" rel="noopener noreferrer">
              {site.domain}
            </a>
            , {PERIOD_LABEL[days]} comparés à la période précédente
          </p>
        </div>
        <div className="actions">
          <a className="btn quiet small" href={`/admin/produits${qs({ site: id })}`}>
            Produits
          </a>
          <a className="btn quiet small" href={`/admin/guides${qs({ site: id })}`}>
            Guides
          </a>
          <a className="btn quiet small" href={`/admin/boutiques/${id}`}>
            Réglages
          </a>
          <PeriodSeg days={days} base={`/admin/boutiques/${id}/apercu`} options={[7, 30, 90, 365]} />
        </div>
      </div>

      <section className="panel">
        <div className="metrics" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <Metric label="Chiffre d'affaires" value={moneyRound(t.revenue)} delta={<Delta v={change(t.revenue, tp.revenue)} />} />
          <Metric label="Bénéfice estimé" value={moneyRound(profit(cur))} delta={<Delta v={change(profit(cur), profit(prev))} />} />
          <Metric label="Commandes" value={number(t.orders)} delta={<Delta v={change(t.orders, tp.orders)} />} />
          <Metric label="Visites" value={number(a.sessions)} delta={<Delta v={change(a.sessions, ap.sessions)} />} />
          <Metric label="Taux de conversion" value={percent(conv, 2)} delta={<Delta v={change(conv, convPrev)} />} />
          <Metric
            label="Visites venues des IA"
            hint="ChatGPT, Perplexity, Claude, Gemini, Copilot…"
            value={number(aiSessions(a.sources))}
            delta={<Delta v={change(aiSessions(a.sources), aiSessions(ap.sources))} />}
          />
        </div>
      </section>

      <section className="panel gap">
          <div className="panel-head">
            <h2>Chiffre d&apos;affaires par jour</h2>
            <span className="hint">panier moyen {money(t.aov)}</span>
          </div>
          <div className="panel-body">
            <BarChart points={salesPoints} series={series} label="Chiffre d'affaires par jour" />
          </div>
      </section>
      <section className="panel gap">
          <div className="panel-head">
            <h2>Visites par jour</h2>
          </div>
          <div className="panel-body">
            <BarChart points={visitPoints} series={series} unit="count" label="Visites par jour" />
          </div>
      </section>

      <section className="panel gap">
        <div className="panel-head">
          <h2>Parcours d&apos;achat</h2>
          <span className="hint">Part des visites à chaque étape</span>
        </div>
        <div className="funnel">
          {steps.map((s, i) => (
            <div className="step" key={s.name}>
              <div className="name">{s.name}</div>
              <div className="value">{number(s.value)}</div>
              <div className="col" aria-hidden="true">
                <div style={{ height: `${Math.max(2, (s.value / Math.max(a.sessions, 1)) * 100)}%` }} />
              </div>
              <div className="rate">
                {i === 0 ? "100 %" : `${percent(s.value / Math.max(a.sessions, 1), 1)} des visites`}
                {i > 0 && steps[i - 1].value > 0 && (
                  <>
                    <br />
                    {percent(s.value / steps[i - 1].value, 0)} de l&apos;étape précédente
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="cols">
        <section className="panel">
          <div className="panel-head">
            <h2>D&apos;où viennent les visiteurs</h2>
          </div>
          <HBars
            rows={Object.entries(groupSources(a.sources))
              .sort((x, y) => y[1] - x[1])
              .map(([k, v]) => ({ key: k, value: v, color: GROUP_COLORS[k], label: <span>{k}</span> }))}
          />
          <div className="panel-body" style={{ paddingTop: 0 }}>
            <p className="muted" style={{ fontSize: "0.86rem" }}>
              Détail :{" "}
              {topEntries(a.sources, 8)
                .map(([k, v]) => `${k}${AI_SOURCES.includes(k) ? " (IA)" : ""} ${number(v)}`)
                .join(", ")}
            </p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Meilleures ventes</h2>
          </div>
          {top.length ? (
            <div className="table-wrap">
              <table>
                <tbody>
                  {top.map((pr) => (
                    <tr key={pr.id} className="link">
                      <td>
                        <a href={`/admin/produits/${pr.id}`}>{pr.title}</a>
                      </td>
                      <td className="num muted">{pr.units} vendus</td>
                      <td className="num">{moneyRound(pr.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-row">Aucune vente sur la période.</p>
          )}
        </section>
      </div>

      <div className="cols">
        <section className="panel">
          <div className="panel-head">
            <h2>Pages les plus vues</h2>
          </div>
          <div className="table-wrap">
            <table>
              <tbody>
                {topEntries(a.pages, 10).map(([k, v]) => (
                  <tr key={k}>
                    <td className="ellip">
                      <a className="link-blue" href={siteUrl(site, k)} target="_blank" rel="noopener noreferrer">
                        {k}
                      </a>
                    </td>
                    <td className="num">{number(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>État de la boutique</h2>
          </div>
          <ul className="checks">
            {[
              { ok: products.filter((x) => x.active).length >= 6, text: `${products.filter((x) => x.active).length} produits en ligne` },
              { ok: noPhoto === 0, text: noPhoto ? `${noPhoto} produit(s) sans vraie photo` : "Toutes les photos sont en place" },
              { ok: guides.filter((g) => g.published).length >= 3, text: `${guides.filter((g) => g.published).length} guides publiés` },
              { ok: site.faq.length >= 3, text: `${site.faq.length} questions dans la FAQ` },
              { ok: Boolean(site.legal.mediator), text: site.legal.mediator ? "Médiateur de la consommation renseigné" : "Médiateur de la consommation manquant" },
            ].map((c) => (
              <li key={c.text}>
                <span className={`ic ${c.ok ? "good" : "warn"}`} aria-hidden="true">
                  {c.ok ? "✓" : "!"}
                </span>
                <div>{c.text}</div>
                <span />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
