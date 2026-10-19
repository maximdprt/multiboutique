// Tâche planifiée : revérifie chaque domaine (DNS, vérification, certificat HTTPS) et note ceux qui passent en ligne.
import { NextResponse, type NextRequest } from "next/server";
import { runNow } from "@/lib/agents/run";
import { checkAllDomains } from "@/lib/domains";
import { cronAllowed } from "../auth";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronAllowed(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const run = await runNow("domaines", "Vérification des domaines", null, (ctx) => checkAllDomains(ctx.log));
  return NextResponse.json({ status: run?.status, result: run?.result });
}
