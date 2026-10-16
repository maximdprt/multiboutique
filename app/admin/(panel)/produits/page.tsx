import { db } from "@/lib/db";
import { adminContext, qs } from "@/lib/admin";
import { money, percent } from "@/lib/format";
import { isCounted } from "@/lib/stats";
import type { Product } from "@/lib/types";
import { SiteFilter } from "../bits";

export const metadata = { title: "Produits" };

type Props = { searchParams: Promise<{ onglet?: string; q?: string; site?: string }> };

const TABS: { id: string; name: string; test: (p: Product) => boolean }[] = [
  { id: "", name: "Tous", test: () => true },
  { id: "actifs", name: "En ligne", test: (p) => p.active },
  { id: "masques", name: "Masqués", test: (p) => !p.active },
  { id: "stock-faible", name: "Stock faible", test: (p) => p.stock !== null && p.stock <= 5 },
];

export default async function Products({ searchParams }: Props) {
  const sp = await searchParams;
  const { sites, colors, current, siteId } = await adminContext(sp.site);
  const tab = TABS.find((t) => t.id === (sp.onglet ?? "")) ?? TABS[0];
  const needle = sp.q?.trim().toLowerCase();
  const [allProducts, orders] = await Promise.all([db.listProducts({ siteId }), db.listOrders({ siteId, since: new Date(Date.now() - 30 * 86400000).toISOString() })]);
  const base = allProducts.filter((p) => !needle || p.title.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle));
  const products = base.filter(tab.test);
  const siteName = Object.fromEntries(sites.map((s) => [s.id, s.name]));
  const sold: Record<string, number> = {};
  for (const o of orders) if (isCounted(o)) for (const i of o.items) sold[i.product_id] = (sold[i.product_id] ?? 0) + i.quantity;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Produits</h1>
          <p className="sub">{allProducts.length} produit(s)</p>
        </div>
        <div className="actions">
          <a className="btn" href={`/admin/produits/nouveau${qs({ site: siteId })}`}>
            Ajouter un produit
          </a>
        </div>
      </div>
      <SiteFilter sites={sites} colors={colors} current={siteId} base="/admin/produits" keep={{ onglet: tab.id }} />
      <section className="panel">
        <nav className="tabs" aria-label="Filtrer">
          {TABS.map((t) => (
            <a key={t.id} href={`/admin/produits${qs({ onglet: t.id, q: sp.q, site: siteId })}`} aria-current={t.id === tab.id ? "page" : undefined}>
              {t.name}
              <span className="n">{base.filter(t.test).length}</span>
            </a>
          ))}
        </nav>
        <form className="toolbar" method="get">
          {tab.id && <input type="hidden" name="onglet" value={tab.id} />}
          {siteId && <input type="hidden" name="site" value={siteId} />}
          <input type="search" name="q" placeholder="Rechercher un produit ou une référence" defaultValue={sp.q ?? ""} aria-label="Rechercher" />
          <button className="btn quiet small" type="submit">
            Rechercher
          </button>
        </form>
        {products.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 56 }} aria-label="Photo" />
                  <th>Produit</th>
                  <th>État</th>
                  {!current && <th>Boutique</th>}
                  <th className="num">Stock</th>
                  <th className="num">Vendus (30 j)</th>
                  <th className="num">Prix</th>
                  <th className="num">Marge</th>
                  <th>Fournisseur</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const margin = p.cost_cents != null && p.price_cents ? (p.price_cents - p.cost_cents) / p.price_cents : null;
                  return (
                    <tr key={p.id} className="link">
                      <td>
                        {p.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="thumb" src={p.images[0]} alt="" />
                        ) : (
                          <span className="thumb" />
                        )}
                      </td>
                      <td>
                        <a href={`/admin/produits/${p.id}`}>
                          <b>{p.title}</b>
                        </a>
                        <div className="faint" style={{ fontSize: "0.84rem" }}>
                          {p.category || "Sans catégorie"}
                        </div>
                      </td>
                      <td>{p.active ? <span className="badge good">En ligne</span> : <span className="badge">Masqué</span>}</td>
                      {!current && (
                        <td>
                          <span className="cell-site">
                            <i className="dot" style={{ background: colors[p.site_id] }} />
                            {siteName[p.site_id] ?? p.site_id}
                          </span>
                        </td>
                      )}
                      <td className="num">
                        {p.stock === null ? (
                          <span className="faint">Non suivi</span>
                        ) : p.stock <= 5 ? (
                          <span className={`badge ${p.stock === 0 ? "bad" : "warn"}`}>{p.stock === 0 ? "Épuisé" : `${p.stock} en stock`}</span>
                        ) : (
                          `${p.stock} en stock`
                        )}
                      </td>
                      <td className="num">{sold[p.id] ?? 0}</td>
                      <td className="num">{money(p.price_cents)}</td>
                      <td className="num">{margin === null ? <span className="faint">—</span> : percent(margin)}</td>
                      <td className="muted">{p.supplier || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-row">
            {allProducts.length ? "Aucun produit dans cet onglet." : "Aucun produit pour l'instant. Ajoutez le premier pour qu'il apparaisse sur la boutique."}
          </p>
        )}
      </section>
    </>
  );
}
