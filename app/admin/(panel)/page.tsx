import { db } from "@/lib/db";
import { siteColors } from "@/lib/admin";
import { buildDailyReport } from "@/lib/report";
import { dayKeyOf } from "@/lib/dates";
import { moneyRound } from "@/lib/format";
import { period, splitOrders, totals } from "@/lib/stats";
import { regenerateReport } from "../actions";
import { Delta } from "./bits";

export const metadata = { title: "Aujourd'hui" };

export default async function Today() {
  const yesterday = dayKeyOf(Date.now() - 86_400_000);
  const [reports, sites, todayOrders] = await Promise.all([db.listReports(14), db.listSites(), db.listOrders({ since: new Date(Date.now() - 2 * 86_400_000).toISOString() })]);
  // Si la tâche du matin n'est pas encore passée, on calcule le rapport à la volée.
  const report = reports.find((r) => r.day === yesterday) ?? { ...(await buildDailyReport()), id: "live", created_at: new Date().toISOString() };
  const colors = siteColors(sites);
  const p = period(1);
  const today = totals(splitOrders(todayOrders, p).cur);
  const greeting = new Date().toLocaleTimeString("fr-FR", { hour: "numeric", timeZone: "Europe/Paris" });
  const hour = Number(greeting.replace(/\D/g, ""));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir"}</h1>
          <p className="sub">{report.headline}</p>
        </div>
        <div className="actions">
          <form action={regenerateReport}>
            <button className="btn quiet small" type="submit">
              Recalculer le rapport
            </button>
          </form>
        </div>
      </div>

      <section className="panel">
        <div className="money">
          <div className="metric">
            <span className="label">CA d&apos;hier</span>
            <div className="row">
              <span className="value">{moneyRound(report.revenue_cents)}</span>
            </div>
          </div>
          <div className="metric">
            <span className="label">Bénéfice estimé d&apos;hier</span>
            <div className="row">
              <span className="value">{moneyRound(report.profit_cents)}</span>
            </div>
          </div>
          <div className="metric">
            <span className="label">Commandes d&apos;hier</span>
            <div className="row">
              <span className="value">{report.orders}</span>
            </div>
          </div>
          <div className="metric">
            <span className="label">Aujourd&apos;hui pour l&apos;instant</span>
            <div className="row">
              <span className="value">{moneyRound(today.revenue)}</span>
              <span className="delta">{today.orders} cmd</span>
            </div>
          </div>
        </div>
      </section>

      <div className="cols">
        <section className="panel">
          <div className="panel-head">
            <h2>À faire</h2>
            <span className="hint">{report.todos.length ? `${report.todos.length} point(s)` : "Rien d'urgent"}</span>
          </div>
          {report.todos.length ? (
            <ul className="todo">
              {report.todos.map((t) => (
                <li key={t.label}>
                  <a href={t.href}>
                    <span className={`badge ${t.level === "urgent" ? "bad" : t.level === "normal" ? "warn" : "info"}`}>
                      {t.level === "urgent" ? "Urgent" : t.level === "normal" ? "À faire" : "Idée"}
                    </span>
                    <span>{t.label}</span>
                    <span className="arrow">›</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-row">Tout est à jour. Les agents continuent leur travail.</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Hier, par boutique</h2>
            <a href="/admin/ventes">Ventes</a>
          </div>
          <div className="table-wrap">
            <table>
              <tbody>
                {report.sites.map((s) => (
                  <tr key={s.site_id} className="link">
                    <td>
                      <a className="cell-site" href={`/admin/boutiques/${s.site_id}/apercu`}>
                        <i className="dot" style={{ background: colors[s.site_id] }} />
                        <b>{s.name}</b>
                      </a>
                    </td>
                    <td className="num">{moneyRound(s.revenue_cents)}</td>
                    <td className="num muted">{s.orders} cmd</td>
                    <td className="num muted">{s.sessions} visites</td>
                    <td className="num">
                      <Delta v={s.trend} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {(report.alerts.length > 0 || report.ideas.length > 0) && (
        <div className="cols">
          <section className="panel">
            <div className="panel-head">
              <h2>Alertes</h2>
            </div>
            {report.alerts.length ? (
              <ul className="checks">
                {report.alerts.map((a) => (
                  <li key={a}>
                    <span className="ic bad" aria-hidden="true">
                      !
                    </span>
                    <div>{a}</div>
                    <span />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-row">Aucune alerte.</p>
            )}
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>Idées pour gagner plus</h2>
            </div>
            {report.ideas.length ? (
              <ul className="checks">
                {report.ideas.map((a) => (
                  <li key={a}>
                    <span className="ic info" aria-hidden="true">
                      i
                    </span>
                    <div>{a}</div>
                    <span />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-row">Pas d&apos;idée particulière aujourd&apos;hui.</p>
            )}
          </section>
        </div>
      )}

      {report.agents.length > 0 && (
        <section className="panel gap">
          <div className="panel-head">
            <h2>Ce que les agents ont fait</h2>
            <a href="/admin/agents">Journal</a>
          </div>
          <ul className="checks">
            {report.agents.map((a) => (
              <li key={a}>
                <span className="ic good" aria-hidden="true">
                  ✓
                </span>
                <div>{a}</div>
                <span />
              </li>
            ))}
          </ul>
        </section>
      )}

      {reports.length > 1 && (
        <section className="panel gap">
          <div className="panel-head">
            <h2>Rapports précédents</h2>
          </div>
          <div className="table-wrap">
            <table>
              <tbody>
                {reports
                  .filter((r) => r.day !== report.day)
                  .slice(0, 10)
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{r.headline}</td>
                      <td className="num muted">{r.todos.length} à faire</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
