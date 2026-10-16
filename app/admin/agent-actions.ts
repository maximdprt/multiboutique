"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { startInBackground } from "@/lib/agents/run";
import { runVeille } from "@/lib/agents/veille";
import { runContent } from "@/lib/agents/content";
import { buildSite, proposeBrand, type BuildInput, type Proposal } from "@/lib/agents/builder";
import type { AgentRun, Opportunity } from "@/lib/types";

export async function launchVeille() {
  await requireAdmin();
  await startInBackground("veille", "Veille lancée à la main", null, runVeille);
  redirect("/admin/agents");
}

export async function launchContent(f: FormData) {
  await requireAdmin();
  const siteId = String(f.get("site_id") ?? "") || undefined;
  await startInBackground("contenu", siteId ? `Nouveau guide (${siteId})` : "Nouveaux guides, toutes les boutiques", siteId ?? null, (ctx) =>
    runContent(ctx, siteId),
  );
  redirect("/admin/agents");
}

export async function setOpportunityStatus(f: FormData) {
  await requireAdmin();
  await db.updateOpportunity(String(f.get("id")), { status: String(f.get("status")) as Opportunity["status"] });
  revalidatePath("/admin/veille");
}

/** Étape « questions » de l'assistant : l'agent propose noms, couleurs, produits et guides. */
export async function proposeAction(input: { niche: string; product: string; notes: string }): Promise<{ ok: true; proposal: Proposal } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    return { ok: true, proposal: await proposeBrand(input) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Lance la construction en arrière-plan et renvoie l'identifiant du suivi. */
export async function buildAction(input: BuildInput): Promise<{ runId: string }> {
  await requireAdmin();
  const run = await startInBackground("construction", `Construction de ${input.name}`, null, (ctx) => buildSite(ctx, input));
  return { runId: run.id };
}

export async function runStatus(id: string): Promise<AgentRun | null> {
  await requireAdmin();
  return db.getRun(id);
}

/** Instantané pour la ville 3D (rafraîchi régulièrement par la page). */
export async function qgSnapshot() {
  await requireAdmin();
  const { qgSnapshotData } = await import("@/lib/qg");
  return qgSnapshotData();
}
