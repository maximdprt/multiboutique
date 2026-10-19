"use server";
// Actions de l'onglet Domaine (fiche boutique) : ajout, vérification, déclaration Search Console faite.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { runNow } from "@/lib/agents/run";
import { addDomain, checkDomain, markDeclared } from "@/lib/domains";

async function siteOf(f: FormData) {
  await requireAdmin();
  const site = await db.getSite(String(f.get("site_id") ?? ""));
  if (!site) redirect("/admin/boutiques");
  return site;
}

const page = (id: string, q: string) => `/admin/boutiques/${id}/domaine?${q}`;

export async function addSiteDomain(f: FormData) {
  const site = await siteOf(f);
  const run = await runNow("domaines", `Ajout du domaine ${site.domain}`, site.id, async (ctx) => {
    const s = await addDomain(site, ctx.log);
    return { domaine: s.domain, etat: s.status };
  });
  revalidatePath(`/admin/boutiques/${site.id}/domaine`);
  if (run?.status === "echec") redirect(page(site.id, `erreur=${encodeURIComponent(String(run.result?.error ?? "Échec"))}`));
  redirect(page(site.id, "ok=ajoute"));
}

export async function checkSiteDomain(f: FormData) {
  const site = await siteOf(f);
  await checkDomain(site);
  revalidatePath(`/admin/boutiques/${site.id}/domaine`);
  redirect(page(site.id, "ok=verifie"));
}

export async function declareSiteDomain(f: FormData) {
  const site = await siteOf(f);
  await markDeclared(site);
  revalidatePath(`/admin/boutiques/${site.id}/domaine`);
  redirect(page(site.id, "ok=declare"));
}
