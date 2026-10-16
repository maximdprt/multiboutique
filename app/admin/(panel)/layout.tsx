import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, isSupabaseConfigured } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";
import { hasClaude } from "@/lib/agents/claude";
import { Sidebar } from "./Sidebar";
import { Icon } from "./icons";

export const dynamic = "force-dynamic";

async function logout() {
  "use server";
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const [paid, runs] = await Promise.all([db.listOrders({ status: "paid" }), db.listRuns(20)]);
  const running = runs.filter((r) => r.status === "en_cours").length;
  return (
    <>
      <header className="topbar">
        <a className="logo" href="/admin">
          <b>M</b>
          <span>Mes boutiques</span>
        </a>
        <div />
        <div className="top-right">
          <a className="top-btn primary" href="/admin/boutiques/creer">
            <Icon name="plus" size={16} />
            <span className="lbl">Créer une boutique</span>
          </a>
          <form action={logout}>
            <button className="top-btn" type="submit" title="Se déconnecter">
              <Icon name="logout" size={16} />
            </button>
          </form>
        </div>
      </header>
      <div className="shell">
        <Sidebar toHandle={paid.length} running={running} />
        <main className="main">
          {(!isSupabaseConfigured || !hasClaude()) && (
            <p className="notice">
              {!isSupabaseConfigured ? "Mode démo : données fictives. " : ""}
              {!hasClaude() ? "Agents en mode démo : ajoutez ANTHROPIC_API_KEY pour qu'ils travaillent vraiment (voir le README)." : ""}
            </p>
          )}
          {children}
        </main>
      </div>
    </>
  );
}
