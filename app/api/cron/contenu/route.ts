// Tâche planifiée (Vercel Cron, voir vercel.json) : un nouveau guide par boutique.
import { NextResponse, type NextRequest } from "next/server";
import { runNow } from "@/lib/agents/run";
import { runContent } from "@/lib/agents/content";
import { cronAllowed } from "../auth";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronAllowed(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const run = await runNow("contenu", "Nouveaux guides (hebdomadaire)", null, (ctx) => runContent(ctx));
  return NextResponse.json({ status: run?.status, result: run?.result });
}
