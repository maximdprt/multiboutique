import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { siteColors } from "@/lib/admin";
import { dateTime, money } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/types";
import { refundOrder, updateOrder } from "../../../actions";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> };

export async function generateMetadata({ params }: Props) {
  const o = await db.getOrder((await params).id);
  return { title: o ? `Commande ${o.number}` : "Commande" };
}

export default async function OrderPage({ params, searchParams }: Props) {
  const o = await db.getOrder((await params).id);
  if (!o) notFound();
  const { ok } = await searchParams;
  const sites = await db.listSites();
  const site = sites.find((s) => s.id === o.site_id);
  const color = siteColors(sites)[o.site_id];
  const cost = o.items.reduce((s, i) => s + (i.unit_cost_cents ?? 0) * i.quantity, 0);
  const a = o.shipping_address;

  return (
    <>
      <a href="/admin/commandes" className="back">
        ‹ Commandes
      </a>
      <div className="page-head">
        <div>
          <h1>Commande #{o.number}</h1>
          <p className="sub" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span className="cell-site">
              <i className="dot" style={{ background: color }} />
              {site?.name ?? o.site_id}
            </span>
            , le {dateTime(o.created_at)} <span className={`status ${o.status}`} style={{ marginLeft: 12 }}>{ORDER_STATUS_LABEL[o.status]}</span>
          </p>
        </div>
      </div>
      {ok && <p className="flash">{ok === "rembourse" ? "Commande remboursée." : "Commande mise à jour."}</p>}

      <div className="order-grid">
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Articles</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th className="num">Qté</th>
                    <th className="num">Prix</th>
                    <th className="num">Achat fournisseur</th>
                    <th>Fournisseur</th>
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i.product_id + i.title}>
                      <td>{i.title}</td>
                      <td className="num">{i.quantity}</td>
                      <td className="num">{money(i.unit_price_cents * i.quantity)}</td>
                      <td className="num muted">{i.unit_cost_cents != null ? money(i.unit_cost_cents * i.quantity) : "—"}</td>
                      <td>
                        {i.supplier_url ? (
                          <a href={i.supplier_url} target="_blank" rel="noopener noreferrer">
                            Commander
                          </a>
                        ) : (
                          <span className="faint">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel-body" style={{ paddingTop: 12 }}>
              <dl className="kv">
                <div>
                  <dt>Sous-total</dt>
                  <dd>{money(o.subtotal_cents)}</dd>
                </div>
                <div>
                  <dt>Livraison facturée</dt>
                  <dd>{o.shipping_cents ? money(o.shipping_cents) : "Offerte"}</dd>
                </div>
                <div>
                  <dt>
                    <b>Total payé</b>
                  </dt>
                  <dd>
                    <b>{money(o.total_cents)}</b>
                  </dd>
                </div>
                <div>
                  <dt>Marge brute estimée</dt>
                  <dd>{cost ? money(o.subtotal_cents - cost) : "—"}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="panel">
            <form action={updateOrder} className="form-section form">
              <input type="hidden" name="id" value={o.id} />
              <h2>Suivi</h2>
              <div className="form-grid">
                <label className="field">
                  <span>Statut</span>
                  <select name="status" defaultValue={o.status}>
                    {Object.entries(ORDER_STATUS_LABEL)
                      .filter(([k]) => k !== "refunded")
                      .map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    {o.status === "refunded" && <option value="refunded">Remboursée</option>}
                  </select>
                </label>
                <label className="field">
                  <span>Numéro de suivi</span>
                  <input name="tracking_number" defaultValue={o.tracking_number} />
                </label>
                <label className="field span-2">
                  <span>Lien de suivi</span>
                  <input name="tracking_url" type="url" defaultValue={o.tracking_url} placeholder="https://" />
                </label>
                <label className="field span-2">
                  <span>Notes internes</span>
                  <textarea name="notes" rows={3} defaultValue={o.notes} placeholder="N° de commande fournisseur, remarques…" />
                </label>
              </div>
              <label className="check">
                <input type="checkbox" name="notify" defaultChecked />
                Envoyer le numéro de suivi au client quand je passe la commande en « Expédiée »
              </label>
              <div>
                <button className="btn" type="submit">
                  Enregistrer
                </button>
              </div>
            </form>
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Client</h2>
            </div>
            <div className="panel-body address">
              <p>
                <b>{o.name}</b>
              </p>
              <p>
                <a href={`mailto:${o.email}`}>{o.email}</a>
              </p>
              {o.phone && <p>{o.phone}</p>}
              {a && (
                <p style={{ marginTop: 10 }}>
                  {a.line1}
                  {a.line2 && (
                    <>
                      <br />
                      {a.line2}
                    </>
                  )}
                  <br />
                  {a.postal_code} {a.city}
                  <br />
                  {a.country}
                </p>
              )}
              <p style={{ marginTop: 12 }}>
                <a href={`/admin/commandes?q=${encodeURIComponent(o.email)}`}>Voir toutes ses commandes</a>
              </p>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>Paiement</h2>
            </div>
            <div className="panel-body">
              <dl className="kv">
                <div>
                  <dt>Mode</dt>
                  <dd>{o.mode === "live" ? "Réel" : o.mode === "test" ? "Stripe test" : "Démo"}</dd>
                </div>
                {o.stripe_payment_intent && (
                  <div>
                    <dt>Stripe</dt>
                    <dd>
                      <a
                        href={`https://dashboard.stripe.com/${o.mode === "test" ? "test/" : ""}payments/${o.stripe_payment_intent}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Voir le paiement
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
              {o.status !== "refunded" && (
                <form action={refundOrder} style={{ marginTop: 14 }}>
                  <input type="hidden" name="id" value={o.id} />
                  <label className="check" style={{ marginBottom: 10 }}>
                    <input type="checkbox" required />
                    Je confirme le remboursement total de {money(o.total_cents)}
                  </label>
                  <button className="btn danger small" type="submit">
                    Rembourser la commande
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
