import { db } from "@/lib/db";
import { hasClaude, MODEL } from "@/lib/agents/claude";
import { dateTime } from "@/lib/format";
import { indexNowKey } from "@/lib/indexnow";
import { launchContent, launchVeille } from "../../agent-actions";
import { AutoRefresh } from "./AutoRefresh";

// les agents lancés depuis cette page peuvent travailler jusqu'à 5 minutes
export const maxDuration = 300;

export const metadata = { title: "Agents" };

const KIND = { veille: "Veille", construction: "Construction", contenu: "Contenu", commandes: "Commandes", rapport: "Rapport" } as const;
const STATUS = { en_cours: ["info", "En cours"], termine: ["good", "Terminé"], echec: ["bad", "Échec"] } as const;

function duration(a: string, b: string | null) {
  if (!b) return "";
  const s = Math.round((Date.parse(b) - Date.parse(a)) / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

export default async function Agents() {
  const runs = await db.listRuns(40);
  const running = runs.some((r) => r.status === "en_cours");
  const cron = Boolean(process.env.CRON_SECRET);

  const agents = [
    {
      name: "Veille",
      what: "Cherche chaque jour des niches et produits porteurs, et les boutiques qui les vendent déjà.",
      when: "Tous les jours vers 7 h",
      action: launchVeille,
    },
    {
      name: "Construction",
      what: "Monte une boutique complète (textes, fiches produits, guides, FAQ) à partir de vos réponses.",
      when: "À la demande, depuis « Créer une boutique »",
      action: null,
    },
    {
      name: "Contenu",
      what: "Écrit et publie un nouveau guide par boutique, sur une question que les gens posent et que vous ne couvrez pas encore.",
      when: "Chaque lundi vers 8 h",
      action: launchContent,
    },
  ];

  return (
    <>
      <AutoRefresh active={running} />
      <div className="page-head">
        <div>
          <h1>Agents</h1>
          <p className="sub">Ce qui tourne tout seul, et le journal de chaque exécution.</p>
        </div>
      </div>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Rôle</th>
                <th>Quand</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.name}>
                  <td>
                    <b>{a.name}</b>
                  </td>
                  <td className="muted">{a.what}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{a.when}</td>
                  <td className="num">
                    {a.action ? (
                      <form action={a.action}>
                        <button className="btn quiet small" type="submit">
                          Lancer maintenant
                        </button>
                      </form>
                    ) : (
                      <a className="btn quiet small" href="/admin/boutiques/creer">
                        Créer une boutique
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel-body" style={{ paddingTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className={`badge ${hasClaude() ? "good" : "warn"}`}>{hasClaude() ? `Claude connecté (${MODEL})` : "Clé ANTHROPIC_API_KEY manquante : mode démo"}</span>
          <span className={`badge ${cron ? "good" : "warn"}`}>{cron ? "Tâches planifiées actives" : "CRON_SECRET manquant : pas d'exécution automatique"}</span>
          <span className={`badge ${indexNowKey() ? "good" : ""}`}>{indexNowKey() ? "IndexNow actif" : "IndexNow désactivé (INDEXNOW_KEY)"}</span>
        </div>
      </section>

      <section className="panel gap">
        <div className="panel-head">
          <h2>Journal</h2>
        </div>
        {runs.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Début</th>
                  <th>Agent</th>
                  <th>Tâche</th>
                  <th>État</th>
                  <th>Détail</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const [cls, label] = STATUS[r.status];
                  return (
                    <tr key={r.id} style={{ verticalAlign: "top" }}>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>
                        {dateTime(r.created_at)}
                      </td>
                      <td>{KIND[r.kind]}</td>
                      <td>
                        {r.title}
                        {r.site_id && (
                          <a className="link-blue" href={`/admin/produits?site=${r.site_id}`} style={{ marginLeft: 8 }}>
                            ouvrir
                          </a>
                        )}
                        {r.kind === "construction" && r.status === "termine" && typeof r.result?.site_id === "string" && (
                          <a className="link-blue" href={`/admin/produits?site=${r.result.site_id}`} style={{ marginLeft: 8 }}>
                            Voir la boutique
                          </a>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span className={`badge ${cls}`}>
                          {r.status === "en_cours" && <span className="spinner" aria-hidden="true" />} {label}
                        </span>{" "}
                        <span className="faint">{duration(r.created_at, r.finished_at)}</span>
                      </td>
                      <td style={{ minWidth: 280 }}>
                        <details open={r.status === "en_cours"}>
                          <summary className="muted" style={{ cursor: "pointer" }}>
                            {r.log.length} étape{r.log.length > 1 ? "s" : ""}
                          </summary>
                          <div className="log" style={{ marginTop: 6 }}>
                            {r.log.join("\n") || "Démarrage…"}
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-row">Aucune exécution pour l&apos;instant.</p>
        )}
      </section>
    </>
  );
}
