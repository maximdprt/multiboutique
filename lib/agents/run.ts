import "server-only";
// Exécution d'un agent : crée une entrée dans le journal, enregistre chaque étape, gère les erreurs.
import { after } from "next/server";
import { db } from "../db";
import type { AgentKind, AgentRun } from "../types";

export type Ctx = { runId: string; log: (line: string) => void };
type Job = (ctx: Ctx) => Promise<Record<string, unknown>>;

async function execute(run: AgentRun, job: Job) {
  const lines: string[] = [];
  let pending: Promise<void> = Promise.resolve();
  const log = (line: string) => {
    lines.push(`${new Date().toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })}  ${line}`);
    const snapshot = [...lines];
    pending = pending.then(() => db.updateRun(run.id, { log: snapshot })).catch(() => {});
  };
  try {
    const result = await job({ runId: run.id, log });
    log("Terminé.");
    await pending;
    await db.updateRun(run.id, { status: "termine", result, finished_at: new Date().toISOString(), log: lines });
  } catch (e) {
    const msg = (e as Error).message || "Erreur inconnue";
    lines.push(`Échec : ${msg}`);
    await pending;
    await db.updateRun(run.id, { status: "echec", result: { error: msg }, finished_at: new Date().toISOString(), log: lines });
  }
}

/** Lance l'agent en arrière-plan (la page répond tout de suite, le travail continue). */
export async function startInBackground(kind: AgentKind, title: string, siteId: string | null, job: Job) {
  const run = await db.createRun({ kind, title, site_id: siteId });
  after(() => execute(run, job));
  return run;
}

/** Lance l'agent et attend la fin (utilisé par les tâches planifiées). */
export async function runNow(kind: AgentKind, title: string, siteId: string | null, job: Job) {
  const run = await db.createRun({ kind, title, site_id: siteId });
  await execute(run, job);
  return db.getRun(run.id);
}
