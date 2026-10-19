// Tâche planifiée : vérifie que toutes les images produits répondent, rapatrie et répare au besoin.
import { NextResponse, type NextRequest } from "next/server";
import { runNow } from "@/lib/agents/run";
import { checkAllImages } from "@/lib/images/health";
import { cronAllowed } from "../auth";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronAllowed(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const run = await runNow("images", "Vérification des images", null, (ctx) => checkAllImages(ctx.log));
  return NextResponse.json({ status: run?.status, result: run?.result });
}
