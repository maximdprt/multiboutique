import { db } from "@/lib/db";
import { adminContext, qs } from "@/lib/admin";
import { bySite, change, dailySeries, isCounted, period, splitOrders, totals } from "@/lib/stats";
import { dateTime, money, moneyRound, number } from "@/lib/format";
import { ORDER_STATUS_LABEL, type Order } from "@/lib/types";
import { BarChart } from "./BarChart";
import { Delta, Metric, PERIOD_LABEL, PeriodSeg, SiteFilter, parseDays } from "./bits";

export const metadata = { title: "Ventes" };

type Props = { searchParams: Promise<{ jours?: string; site?: string }> };

/** Bénéfice estimé = ventes − prix d'achat fournisseur − frais Stripe (1,5 % + 0,25 € par paiement). */
function profit(orders: Order[]) {
  let p = 0;
  for (const o of orders) {
    if (!isCounted(o)) continue;
    const cost = o.items.reduce((s, i) => s + (i.unit_cost_cents ?? 0) * i.quantity, 0);
    p += o.total_cents - cost - Math.round(o.total_cents * 0.015 + 25);
  }
  return p;
}

export default async function Sales({ searchParams }: Props) {
  const sp = await searchParams;
  const days = parseDays(sp.jours, [1, 7, 30, 90, 365], 30);
  const { sites, colors, current, siteId } = await adminContext(sp.site);
  const p = period(days);
  const orders = await db.listOrders({ siteId, since: p.fetchSince });
  const { cur, prev } = splitOrders(orders, p);
  const t = totals(cur);
  const tp = totals(prev);
  const gain = profit(cur);
  const gainPrev = profit(prev);
  const shown = current ? [current] : sites;
  const points = dailySeries(cur, p, shown.map((s) => s.id));
  const perSite = bySite(cur, prev, sites).sort((a, b) => b.revenue - a.revenue);
  const siteName = Object.fromEntries(sites.map((s) => [s.id, s.name]));
  const vs = days === 1 ? "hier" : "la période précédente";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ventes</h1>
          <p className="sub">
            {PERIOD_LABEL[days]}, comparé à {vs}
          </p>
        </div>
        <PeriodSeg days={days} base={`/admin${qs({ site: siteId })}`} />
      </div>
      <SiteFilter sites={sites} colors={colors} current={siteId} base="/admin" keep={{ jours: days }} />

      <section className="panel">
        <div className="money">
          <Metric label="Chiffre d'affaires" value={moneyRound(t.revenue)} delta={<Delta v={change(t.revenue, tp.revenue)} />} />
          <Metric
            label="Bénéfice estimé"
            hint="Ventes moins prix d'achat fournisseur et frais Stripe"
            value={moneyRound(gain)}
            delta={<Delta v={change(gain, gainPrev)} />}
          />
          <Metric label="Commandes" value={number(t.orders)} delta={<Delta v={change(t.orders, tp.orders)} />} />
          <Metric label="Panier moyen" value={money(t.aov)} delta={<Delta v={change(t.aov, tp.aov)} />} />
        </div>
      </section>

      <section className="panel gap">
        <div className="panel-head">
          <h2>Chiffre d&apos;affaires par jour</h2>
          {shown.length > 1 && (
            <div className="legend" aria-label="Légende">
              {shown.map((s) => (
                <span key={s.id}>
                  <i className="dot" style={{ background: colors[s.id] }} />
                  {s.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="panel-body">
          <BarChart points={points} series={shown.map((s) => ({ id: s.id, name: s.name, color: colors[s.id] }))} label="Chiffre d'affaires par jour" />
        </div>
      </section>

      {!current && sites.length > 1 && (
        <section className="panel gap">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Boutique</th>
                  <th className="num">Chiffre d&apos;affaires</th>
                  <th className="num">Bénéfice estimé</th>
                  <th className="num">Commandes</th>
                  <th className="num">Évolution</th>
                </tr>
              </thead>
              <tbody>
                {perSite.map((r) => (
                  <tr key={r.site.id} className="link">
                    <td>
                      <a className="cell-site" href={`/admin${qs({ site: r.site.id, jours: days })}`}>
                        <i className="dot" style={{ background: colors[r.site.id] }} />
                        <b>{r.site.name}</b> <span className="faint">{r.site.domain}</span>
                      </a>
                    </td>
                    <td className="num">{moneyRound(r.revenue)}</td>
                    <td className="num">{moneyRound(profit(cur.filter((o) => o.site_id === r.site.id)))}</td>
                    <td className="num">{r.orders}</td>
                    <td className="num">
                      <Delta v={r.revenueChange} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel gap">
        <div className="panel-head">
          <h2>Dernières commandes</h2>
          <a href={`/admin/commandes${qs({ site: siteId })}`}>Toutes les commandes</a>
        </div>
        {cur.length ? (
          <div className="table-wrap">
            <table>
              <tbody>
                {cur.slice(0, 8).map((o) => (
                  <tr key={o.id} className="link">
                    <td>
                      <a href={`/admin/commandes/${o.id}`}>
                        <b>#{o.number}</b>
                      </a>
                    </td>
                    <td>{o.name}</td>
                    {!current && (
                      <td>
                        <span className="cell-site">
                          <i className="dot" style={{ background: colors[o.site_id] }} />
                          {siteName[o.site_id]}
                        </span>
                      </td>
                    )}
                    <td className="faint">{dateTime(o.created_at)}</td>
                    <td>
                      <span className={`status ${o.status}`}>{ORDER_STATUS_LABEL[o.status]}</span>
                    </td>
                    <td className="num">{money(o.total_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-row">Aucune commande sur la période.</p>
        )}
      </section>
      <p className="faint" style={{ marginTop: 12, fontSize: "0.84rem" }}>
        Montants livraison comprise, hors commandes remboursées ou annulées. Le bénéfice est une estimation : renseignez le prix d&apos;achat de
        chaque produit pour qu&apos;il soit juste.
      </p>
    </>
  );
}
