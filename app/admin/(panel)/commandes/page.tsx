import { db } from "@/lib/db";
import { adminContext, qs } from "@/lib/admin";
import { dateTime, money } from "@/lib/format";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/types";
import { SiteFilter } from "../bits";

export const metadata = { title: "Commandes" };

type Props = { searchParams: Promise<{ onglet?: string; q?: string; page?: string; site?: string }> };
const PER_PAGE = 50;

const TABS: { id: string; name: string; status?: OrderStatus }[] = [
  { id: "", name: "Toutes" },
  { id: "a-transmettre", name: "À transmettre", status: "paid" },
  { id: "a-expedier", name: "En attente de suivi", status: "sent_to_supplier" },
  { id: "expediees", name: "Expédiées", status: "shipped" },
  { id: "livrees", name: "Livrées", status: "delivered" },
  { id: "remboursees", name: "Remboursées", status: "refunded" },
];

export default async function Orders({ searchParams }: Props) {
  const sp = await searchParams;
  const { sites, colors, current, siteId } = await adminContext(sp.site);
  const tab = TABS.find((t) => t.id === (sp.onglet ?? "")) ?? TABS[0];
  const page = Math.max(1, Number(sp.page) || 1);
  const everything = await db.listOrders({ siteId, search: sp.q?.trim() || undefined });
  const count = (s?: OrderStatus) => (s ? everything.filter((o) => o.status === s).length : everything.length);
  const all = tab.status ? everything.filter((o) => o.status === tab.status) : everything;
  const orders = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const pages = Math.ceil(all.length / PER_PAGE);
  const siteName = Object.fromEntries(sites.map((s) => [s.id, s.name]));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Commandes</h1>
          <p className="sub">
            {everything.length} commande{everything.length > 1 ? "s" : ""}
            {sp.q ? ` pour « ${sp.q} »` : ""}
          </p>
        </div>
      </div>
      <SiteFilter sites={sites} colors={colors} current={siteId} base="/admin/commandes" keep={{ onglet: tab.id, q: sp.q }} />
      <section className="panel">
        <nav className="tabs" aria-label="Filtrer par état">
          {TABS.map((t) => (
            <a key={t.id} href={`/admin/commandes${qs({ onglet: t.id, q: sp.q, site: siteId })}`} aria-current={t.id === tab.id ? "page" : undefined}>
              {t.name}
              <span className="n">{count(t.status)}</span>
            </a>
          ))}
        </nav>
        <form className="toolbar" method="get">
          {tab.id && <input type="hidden" name="onglet" value={tab.id} />}
          {siteId && <input type="hidden" name="site" value={siteId} />}
          <input type="search" name="q" placeholder="Rechercher par nom, e-mail ou n° de commande" defaultValue={sp.q ?? ""} aria-label="Rechercher" />
          <button className="btn quiet small" type="submit">
            Rechercher
          </button>
          {sp.q && (
            <a className="btn quiet small" href={`/admin/commandes${qs({ onglet: tab.id, site: siteId })}`}>
              Effacer
            </a>
          )}
        </form>
        {orders.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Commande</th>
                  <th>Date</th>
                  <th>Client</th>
                  {!current && <th>Boutique</th>}
                  <th className="num">Total</th>
                  <th>État</th>
                  <th className="num">Articles</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="link">
                    <td>
                      <a href={`/admin/commandes/${o.id}`}>
                        <b>#{o.number}</b>
                      </a>
                      {o.mode !== "live" && (
                        <>
                          {" "}
                          <span className="pill">{o.mode === "demo" ? "démo" : "test"}</span>
                        </>
                      )}
                    </td>
                    <td className="muted">{dateTime(o.created_at)}</td>
                    <td>
                      <a href={`/admin/commandes/${o.id}`}>{o.name || o.email}</a>
                    </td>
                    {!current && (
                      <td>
                        <span className="cell-site">
                          <i className="dot" style={{ background: colors[o.site_id] }} />
                          {siteName[o.site_id] ?? o.site_id}
                        </span>
                      </td>
                    )}
                    <td className="num">{money(o.total_cents)}</td>
                    <td>
                      <span className={`status ${o.status}`}>{ORDER_STATUS_LABEL[o.status]}</span>
                    </td>
                    <td className="num muted">{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-row">{tab.status ? `Aucune commande « ${tab.name.toLowerCase()} ».` : "Aucune commande ne correspond."}</p>
        )}
        {pages > 1 && (
          <div className="pager">
            {page > 1 && (
              <a className="btn quiet small" href={`/admin/commandes${qs({ onglet: tab.id, q: sp.q, site: siteId, page: page - 1 })}`}>
                ‹ Précédent
              </a>
            )}
            <span className="muted">
              Page {page} sur {pages}
            </span>
            {page < pages && (
              <a className="btn quiet small" href={`/admin/commandes${qs({ onglet: tab.id, q: sp.q, site: siteId, page: page + 1 })}`}>
                Suivant ›
              </a>
            )}
          </div>
        )}
      </section>
    </>
  );
}
