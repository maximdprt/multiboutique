import { db } from "@/lib/db";
import { adminContext, qs } from "@/lib/admin";
import { SiteFilter } from "../bits";
import { date } from "@/lib/format";

export const metadata = { title: "Guides" };

type Props = { searchParams: Promise<{ site?: string }> };

export default async function Guides({ searchParams }: Props) {
  const sp = await searchParams;
  const { sites, colors, current, siteId } = await adminContext(sp.site);
  const guides = await db.listGuides({ siteId });
  const siteName = Object.fromEntries(sites.map((s) => [s.id, s.name]));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Guides</h1>
          <p>Les articles de conseil font venir des visiteurs depuis Google et donnent aux IA de quoi citer votre boutique.</p>
        </div>
        <a className="btn" href={`/admin/guides/nouveau${qs({ site: siteId })}`}>
          Écrire un guide
        </a>
      </div>
      <SiteFilter sites={sites} colors={colors} current={siteId} base="/admin/guides" />
      <section className="panel">
        {guides.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Titre</th>
                  {!current && <th>Boutique</th>}
                  <th>Produits cités</th>
                  <th>Mis à jour</th>
                </tr>
              </thead>
              <tbody>
                {guides.map((g) => (
                  <tr key={g.id} className="link">
                    <td>
                      <a href={`/admin/guides/${g.id}`}>
                        <b>{g.title}</b>
                      </a>
                      {!g.published && (
                        <>
                          {" "}
                          <span className="pill">brouillon</span>
                        </>
                      )}
                    </td>
                    {!current && (
                      <td>
                        <span className="cell-site">
                          <i className="dot" style={{ background: colors[g.site_id] }} />
                          {siteName[g.site_id] ?? g.site_id}
                        </span>
                      </td>
                    )}
                    <td className="muted">{g.product_ids.length}</td>
                    <td className="faint">{date(g.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-row">Aucun guide. Commencez par la question que vos clients posent le plus souvent.</p>
        )}
      </section>
    </>
  );
}
