// Tâche planifiée : rapport du matin (calculé sans IA), enregistré et envoyé.
import { NextResponse, type NextRequest } from "next/server";
import { runNow } from "@/lib/agents/run";
import { generateAndSendReport } from "@/lib/report-run";
import { cronAllowed } from "../auth";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronAllowed(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const run = await runNow("rapport", "Rapport du matin", null, (ctx) => generateAndSendReport(ctx.log));
  return NextResponse.json({ status: run?.status, result: run?.result });
}
