import { db } from "@/lib/db";
import { hasClaude } from "@/lib/agents/claude";
import { date } from "@/lib/format";
import { qs } from "@/lib/admin";
import type { Opportunity } from "@/lib/types";
import { launchVeille, setOpportunityStatus } from "../../agent-actions";
import { CardStack } from "./CardStack";

// les agents lancés depuis cette page peuvent travailler jusqu'à 5 minutes
export const maxDuration = 300;

export const metadata = { title: "Veille" };

type Props = { searchParams: Promise<{ vue?: string; liste?: string }> };

const VIEWS = [
  { id: "", name: "Nouvelles", test: (o: Opportunity) => o.status === "nouvelle" },
  { id: "retenues", name: "Retenues", test: (o: Opportunity) => o.status === "retenue" },
  { id: "lancees", name: "Lancées", test: (o: Opportunity) => o.status === "lancee" },
  { id: "ecartees", name: "Écartées", test: (o: Opportunity) => o.status === "ecartee" },
];

const COMP = { faible: "good", moyenne: "warn", forte: "bad" } as const;

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default async function Veille({ searchParams }: Props) {
  const sp = await searchParams;
  const vue = sp.vue ?? "";
  const asCards = vue === "" && !sp.liste;
  const view = VIEWS.find((v) => v.id === vue) ?? VIEWS[0];
  const [all, runs] = await Promise.all([db.listOpportunities(), db.listRuns(50)]);
  const list = all.filter(view.test).sort((a, b) => b.created_at.slice(0, 10).localeCompare(a.created_at.slice(0, 10)) || b.score - a.score);
  const last = runs.find((r) => r.kind === "veille");
  const running = runs.some((r) => r.kind === "veille" && r.status === "en_cours");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Veille</h1>
          <p className="sub">
            Chaque matin, l&apos;agent cherche des niches et des produits porteurs, et les boutiques qui les vendent déjà.
            {last ? ` Dernière veille le ${date(last.created_at)}.` : ""}
          </p>
        </div>
        <form action={launchVeille} className="actions">
          <button className="btn" type="submit" disabled={running}>
            {running ? "Veille en cours…" : "Lancer une veille maintenant"}
          </button>
        </form>
      </div>
      {!hasClaude() && (
        <p className="notice info">
          Exemples de démonstration. Avec une clé ANTHROPIC_API_KEY, l&apos;agent fait de vraies recherches sur le web, cite ses sources et nomme de vraies
          boutiques.
        </p>
      )}

      <section className="panel" style={{ marginBottom: 14 }}>
        <nav className="tabs" aria-label="Filtrer">
          {VIEWS.map((v) => (
            <a key={v.id} href={`/admin/veille${qs({ vue: v.id })}`} aria-current={v.id === view.id ? "page" : undefined}>
              {v.name}
              <span className="n">{all.filter(v.test).length}</span>
            </a>
          ))}
        </nav>
      </section>

      {asCards && list.length > 0 && (
        <>
          <CardStack
            cards={list.map((o) => ({
              id: o.id,
              product: o.product,
              niche: o.niche,
              score: o.score,
              summary: o.summary,
              why_now: o.why_now,
              competition: o.competition,
              price_range: o.price_range,
              margin_hint: o.margin_hint,
              queries: o.queries,
              links: [
                ...o.examples.map((e) => ({ label: e.name, url: e.url, note: e.note })),
                ...o.sources.map((u) => ({ label: host(u), url: u })),
              ],
            }))}
          />
          <p style={{ textAlign: "center", marginTop: 12 }}>
            <a className="link-blue" href="/admin/veille?liste=1">
              Voir toutes les idées en liste
            </a>
          </p>
        </>
      )}
      {asCards && list.length > 0 ? null : list.length ? (
        <div className="opps">
          {list.map((o) => (
            <article key={o.id} className="panel opp">
              <div className="opp-head">
                <div>
                  <h3>{o.product}</h3>
                  <p className="niche">
                    {o.niche}, repéré le {date(o.created_at)}
                  </p>
                </div>
                <div className="score" title="Potentiel × facilité à se classer vite">
                  <b>{o.score}</b>
                  <small>sur 100</small>
                </div>
              </div>
              <p>{o.summary}</p>
              <p className="muted">
                <b>Pourquoi maintenant :</b> {o.why_now}
              </p>
              <div className="facts">
                <span>
                  Concurrence Google <span className={`badge ${COMP[o.competition] ?? ""}`}>{o.competition}</span>
                </span>
                <span>
                  Prix de vente <b>{o.price_range}</b>
                </span>
                <span>
                  Coût et marge <b>{o.margin_hint}</b>
                </span>
              </div>
              {o.queries.length > 0 && (
                <div className="qchips" aria-label="Recherches visées">
                  {o.queries.map((q) => (
                    <span key={q}>{q}</span>
                  ))}
                </div>
              )}
              {(o.examples.length > 0 || o.sources.length > 0) && (
                <div className="links">
                  {o.examples.length > 0 && (
                    <div>
                      Ils vendent déjà :{" "}
                      {o.examples.map((e) => (
                        <a key={e.url} href={e.url} target="_blank" rel="noopener noreferrer" title={e.note}>
                          {e.name}
                        </a>
                      ))}
                    </div>
                  )}
                  {o.sources.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      Sources :{" "}
                      {o.sources.map((u) => (
                        <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                          {host(u)}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="opp-actions">
                {o.status === "lancee" && o.site_id ? (
                  <a className="btn quiet" href={`/admin/produits?site=${o.site_id}`}>
                    Voir la boutique créée
                  </a>
                ) : (
                  <a className="btn" href={`/admin/boutiques/creer?opportunite=${o.id}`}>
                    Créer la boutique
                  </a>
                )}
                {o.status === "nouvelle" && (
                  <form action={setOpportunityStatus}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="status" value="retenue" />
                    <button className="btn quiet" type="submit">
                      Garder pour plus tard
                    </button>
                  </form>
                )}
                {o.status !== "ecartee" && o.status !== "lancee" && (
                  <form action={setOpportunityStatus}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="status" value="ecartee" />
                    <button className="btn quiet" type="submit">
                      Écarter
                    </button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel">
          <p className="empty-row">Rien dans cette liste. La prochaine veille tourne demain matin, ou lancez-en une maintenant.</p>
        </section>
      )}
    </>
  );
}
