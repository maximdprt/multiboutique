import "server-only";
import { db } from "./db";
import { buildDailyReport, reportText } from "./report";
import { sendOwnerReport } from "./email";

export async function generateAndSendReport(log: (s: string) => void = () => {}) {
  const r = await buildDailyReport();
  const saved = await db.saveReport(r);
  log(saved.headline);
  await sendOwnerReport(`Rapport : ${saved.headline}`, reportText(saved)).catch((e) => log(`Envoi impossible : ${(e as Error).message}`));
  return { jour: saved.day, a_faire: saved.todos.length, alertes: saved.alerts.length };
}
