// Tâche planifiée : récupère les numéros de suivi chez le fournisseur et prévient les clients.
import { NextResponse, type NextRequest } from "next/server";
import { runNow } from "@/lib/agents/run";
import { syncTracking } from "@/lib/fulfillment";
import { cronAllowed } from "../auth";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronAllowed(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const run = await runNow("commandes", "Suivi des colis", null, (ctx) => syncTracking(ctx.log));
  return NextResponse.json({ status: run?.status, result: run?.result });
}
