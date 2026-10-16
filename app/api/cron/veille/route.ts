// Tâche planifiée (Vercel Cron, voir vercel.json) : veille quotidienne des niches et produits.
import { NextResponse, type NextRequest } from "next/server";
import { runNow } from "@/lib/agents/run";
import { runVeille } from "@/lib/agents/veille";
import { cronAllowed } from "../auth";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronAllowed(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const run = await runNow("veille", "Veille quotidienne des niches", null, runVeille);
  return NextResponse.json({ status: run?.status, result: run?.result });
}
