import { db, isSupabaseConfigured } from "@/lib/db";
import { serviceStatuses, type ServiceStatus } from "@/lib/env";
import { dateTime } from "@/lib/format";
import { TZ } from "@/lib/dates";
import type { AgentKind, AgentRun } from "@/lib/types";
import vercel from "@/vercel.json";

export const metadata = { title: "État des services" };
export const dynamic = "force-dynamic";

// Tâche planifiée de vercel.json -> type d'exécution enregistré dans le journal des agents
const CRON_KIND: Record<string, { kind: AgentKind; name: string }> = {
  "/api/cron/veille": { kind: "veille", name: "Veille" },
  "/api/cron/suivi": { kind: "commandes", name: "Suivi des colis" },
  "/api/cron/rapport": { kind: "rapport", name: "Rapport du matin" },
  "/api/cron/contenu": { kind: "contenu", name: "Nouveaux guides" },
};
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** "0 4 * * 1" (UTC) -> "chaque lundi vers 6 h" (heure locale de l'admin, aujourd'hui) */
function when(schedule: string) {
  const [min, hour, , , dow] = schedule.split(" ");
  const d = new Date();
  d.setUTCHours(Number(hour), Number(min), 0, 0);
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).formatToParts(d);
  const local = Number(parts.find((p) => p.type === "hour")?.value);
  return `${dow === "*" ? "chaque jour" : `chaque ${DAYS[Number(dow)] ?? dow}`} vers ${local} h`;
}

const BADGE: Record<ServiceStatus["state"], [string, string]> = {
  ok: ["good", "Configuré"],
  a_corriger: ["bad", "À corriger"],
  absent: ["", "Non configuré"],
};

async function liveChecks() {
  const extra: Record<string, { problems: string[]; notes: string[] }> = {};
  const add = (id: string, kind: "problems" | "notes", text: string) => {
    extra[id] ??= { problems: [], notes: [] };
    extra[id][kind].push(text);
  };
  let runs: AgentRun[] = [];
  try {
    const t = Date.now();
    runs = await db.listRuns(200);
    if (isSupabaseConfigured) add("supabase", "notes", `Base joignable (réponse en ${Date.now() - t} ms).`);
  } catch (e) {
    add("supabase", "problems", `Base injoignable : ${(e as Error).message}. Vérifiez l'URL, la clé et que le schéma est installé.`);
  }
  try {
    const last = (await db.listOrders({ limit: 200 })).find((o) => o.stripe_session_id);
    if (last) add("webhook", "notes", `Dernière commande reçue de Stripe : n° ${last.number}, le ${dateTime(last.created_at)}.`);
  } catch {
    // déjà signalé ci-dessus
  }
  const crons = vercel.crons.map((c) => {
    const k = CRON_KIND[c.path];
    const last = runs.find((r) => r.kind === k?.kind);
    return { path: c.path, name: k?.name ?? c.path, when: when(c.schedule), last };
  });
  return { extra, crons };
}

export default async function Services() {
  const { mode, services } = serviceStatuses();
  const { extra, crons } = await liveChecks();
  const rows = services.map((s) => {
    const x = extra[s.id];
    return x?.problems.length ? { ...s, state: "a_corriger" as const, problems: [...s.problems, ...x.problems], notes: x.notes } : { ...s, notes: x?.notes ?? [] };
  });
  const blocking = rows.filter((s) => s.state === "a_corriger" || (s.required && s.state !== "ok"));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Réglages</h1>
          <p className="sub">Ce qui est branché, ce qui manque, et comment le faire. Aucun secret n&apos;est affiché ici.</p>
        </div>
      </div>
      <section className="panel" style={{ marginBottom: 14 }}>
        <nav className="tabs" aria-label="Réglages">
          <a href="/admin/reglages/services" aria-current="page">
            État des services
          </a>
        </nav>
      </section>

      {mode === "demo" ? (
        <p className="notice info">
          Mode démo : sans Supabase, le site utilise des données fictives. Configurez au moins Supabase, la connexion à l&apos;admin, Stripe et les tâches
          planifiées pour vendre pour de vrai.
        </p>
      ) : blocking.length ? (
        <p className="notice">
          {blocking.length} point{blocking.length > 1 ? "s" : ""} à régler avant de vendre : {blocking.map((s) => s.name).join(", ")}.
        </p>
      ) : (
        <p className="flash">Tous les services indispensables sont configurés.</p>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>Services</h2>
          <span className="hint">Les variables se règlent dans Vercel &gt; Settings &gt; Environment Variables, et dans .env.local en local.</span>
        </div>
        <ul className="checks" aria-label="État des services">
          {rows.map((s) => {
            const [cls, label] = s.state === "absent" && s.required ? ["bad", "À configurer"] : BADGE[s.state];
            const icon = s.state === "ok" ? "good" : s.state === "a_corriger" || s.required ? "bad" : "info";
            return (
              <li key={s.id} data-service={s.id}>
                <span className={`ic ${icon}`} aria-hidden="true">
                  {s.state === "ok" ? "✓" : s.state === "absent" && !s.required ? "–" : "!"}
                </span>
                <div>
                  <div className="what">{s.name}</div>
                  <div className="why">
                    {s.role} {s.detail}
                  </div>
                  {s.notes.length > 0 && (
                    <ul className="items">
                      {s.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  )}
                  {s.problems.length > 0 && (
                    <ul className="items err">
                      {s.problems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  )}
                  {s.state !== "ok" && (
                    <details className="howto">
                      <summary>Que faire ?</summary>
                      <ol>
                        {s.todo.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ol>
                      <p className="faint">Variables : {s.vars.join(", ")}</p>
                    </details>
                  )}
                </div>
                <span className={`badge ${cls}`}>{label}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel gap">
        <div className="panel-head">
          <h2>Tâches planifiées</h2>
          <span className="hint">Déclarées dans vercel.json, lancées par Vercel une fois par jour (à l&apos;heure près sur l&apos;offre gratuite).</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tâche</th>
                <th>Quand</th>
                <th>Dernière exécution</th>
              </tr>
            </thead>
            <tbody>
              {crons.map((c) => (
                <tr key={c.path}>
                  <td>{c.name}</td>
                  <td className="muted">{c.when}</td>
                  <td>
                    {c.last ? (
                      <>
                        {dateTime(c.last.created_at)}{" "}
                        <span className={`badge ${c.last.status === "termine" ? "good" : c.last.status === "echec" ? "bad" : ""}`}>
                          {c.last.status === "termine" ? "Terminée" : c.last.status === "echec" ? "Échec" : "En cours"}
                        </span>
                      </>
                    ) : (
                      <span className="faint">Jamais</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
