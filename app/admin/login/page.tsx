import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminPassword, createSessionToken, safeEqual, SESSION_COOKIE } from "@/lib/auth";

export const metadata = { title: "Connexion" };

async function login(formData: FormData) {
  "use server";
  const expected = adminPassword();
  const given = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  if (!expected || !safeEqual(given, expected)) {
    await new Promise((r) => setTimeout(r, 600)); // ralentit les essais en série
    redirect(`/admin/login?erreur=1&next=${encodeURIComponent(next)}`);
  }
  const { token, maxAge } = await createSessionToken();
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ erreur?: string; next?: string }> }) {
  const { erreur, next } = await searchParams;
  const configured = adminPassword() !== null;
  const demo = !process.env.SUPABASE_URL && !process.env.ADMIN_PASSWORD;
  return (
    <main className="login">
      <form action={login} className="panel" style={{ padding: 24 }}>
        <h1>Mes boutiques</h1>
        {!configured ? (
          <p className="err">Définissez la variable ADMIN_PASSWORD sur votre hébergement pour activer la connexion.</p>
        ) : (
          <>
            <label className="field">
              <span>Mot de passe</span>
              <input type="password" name="password" autoComplete="current-password" required autoFocus />
            </label>
            <input type="hidden" name="next" value={next ?? "/admin"} />
            {erreur && <p className="err">Mot de passe incorrect.</p>}
            {demo && <p className="faint">Mode démo : le mot de passe est « demo ».</p>}
            <button className="btn" type="submit">
              Se connecter
            </button>
          </>
        )}
      </form>
    </main>
  );
}
