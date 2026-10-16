import { db } from "@/lib/db";
import { qs, siteColors } from "@/lib/admin";
import { siteUrl } from "@/lib/sites";
import { moneyRound } from "@/lib/format";
import { period, splitOrders, totals } from "@/lib/stats";
import { launchContent } from "../../agent-actions";

// les agents lancés depuis cette page peuvent travailler jusqu'à 5 minutes
export const maxDuration = 300;

export const metadata = { title: "Boutiques" };

export default async function Shops() {
  const sites = await db.listSites();
  const colors = siteColors(sites);
  const p = period(30);
  const [products, guides, orders] = await Promise.all([db.listProducts(), db.listGuides(), db.listOrders({ since: p.fetchSince })]);
  const { cur } = splitOrders(orders, p);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Boutiques</h1>
          <p className="sub">Un seul code pour toutes les boutiques : chacune a son domaine, ses couleurs, ses produits et ses guides.</p>
        </div>
        <div className="actions">
          <a className="btn quiet" href="/admin/boutiques/nouvelle">
            Créer à la main
          </a>
          <a className="btn" href="/admin/boutiques/creer">
            Créer avec l&apos;agent
          </a>
        </div>
      </div>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Boutique</th>
                <th className="num">Ventes 30 j</th>
                <th className="num">Produits</th>
                <th className="num">Guides</th>
                <th>Gérer</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => {
                const sp = products.filter((x) => x.site_id === s.id);
                const noPhoto = sp.filter((x) => !x.images.length).length;
                return (
                  <tr key={s.id}>
                    <td>
                      <span className="cell-site">
                        <i className="dot" style={{ background: colors[s.id] }} />
                        <span>
                          <a href={`/admin/boutiques/${s.id}/apercu`} style={{ textDecoration: "none" }}>
                            <b>{s.name}</b>
                          </a>{" "}
                          {!s.active && <span className="pill">hors ligne</span>}
                          <a className="link-blue" href={siteUrl(s)} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: "0.86rem" }}>
                            {s.domain}
                          </a>
                        </span>
                      </span>
                    </td>
                    <td className="num">{moneyRound(totals(cur.filter((o) => o.site_id === s.id)).revenue)}</td>
                    <td className="num">
                      {sp.length}
                      {noPhoto > 0 && (
                        <span className="badge warn" style={{ marginLeft: 6 }} title="Produits sans photo">
                          {noPhoto} sans photo
                        </span>
                      )}
                    </td>
                    <td className="num">{guides.filter((g) => g.site_id === s.id && g.published).length}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", gap: 14 }}>
                      <a className="link-blue" href={`/admin/boutiques/${s.id}/apercu`}>
                        Analyse
                      </a>
                      <a className="link-blue" href={`/admin/produits${qs({ site: s.id })}`}>
                        Produits
                      </a>
                      <a className="link-blue" href={`/admin/guides${qs({ site: s.id })}`}>
                        Guides
                      </a>
                      <a className="link-blue" href={`/admin/boutiques/${s.id}`}>
                        Réglages
                      </a>
                      </span>
                    </td>
                    <td className="num">
                      <form action={launchContent}>
                        <input type="hidden" name="site_id" value={s.id} />
                        <button className="btn quiet small" type="submit" title="L'agent de contenu écrit et publie un nouveau guide">
                          Écrire un guide
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <p className="faint" style={{ marginTop: 12, fontSize: "0.86rem" }}>
        En local, chaque boutique s&apos;ouvre sur http://identifiant.localhost:3000 (par exemple http://{sites[0]?.id ?? "bocal"}.localhost:3000).
      </p>
    </>
  );
}
