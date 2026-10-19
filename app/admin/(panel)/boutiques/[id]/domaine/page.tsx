import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { DOMAIN_STATUS_LABEL, getDomainState, hostnames, type DomainState } from "@/lib/domains";
import { previewBase } from "@/lib/store-path";
import { addSiteDomain, checkSiteDomain, declareSiteDomain } from "../../../../domain-actions";
import { CopyButton } from "../../../CopyButton";
import { PreviewLink, SiteTabs } from "../SiteTabs";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erreur?: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  return { title: `Domaine · ${(await db.getSite((await params).id))?.name ?? "Boutique"}` };
}

const BADGE: Record<DomainState["status"], string> = {
  a_ajouter: "",
  dns: "warn",
  verification: "info",
  certificat: "info",
  en_ligne: "good",
  erreur: "bad",
};

const FLASH: Record<string, string> = {
  ajoute: "Domaine ajouté. Créez maintenant les enregistrements DNS ci-dessous.",
  verifie: "État du domaine mis à jour.",
  declare: "Noté : le domaine est déclaré dans Search Console et Merchant Center.",
};

export default async function SiteDomain({ params, searchParams }: Props) {
  const { id } = await params;
  const { ok, erreur } = await searchParams;
  const site = await db.getSite(id);
  if (!site) notFound();
  const st = await getDomainState(site);
  const realDomain = site.domain.includes(".") && !site.domain.endsWith(".localhost");
  const hosts = hostnames(site.domain);
  const h = await headers();
  const here = h.get("host") ?? "localhost:3000";
  const origin = `${h.get("x-forwarded-proto") ?? (here.startsWith("localhost") ? "http" : "https")}://${here}`;
  const steps = [
    { ok: st.checks.added, text: st.mode === "manuel" ? "Domaine ajouté dans Vercel (à faire à la main)" : `Domaine ajouté à l'hébergement (${hosts.join(" et ")})` },
    { ok: st.checks.dns, text: "Enregistrements DNS créés chez le registraire" },
    { ok: st.checks.verified, text: "Domaine vérifié par Vercel" },
    { ok: st.checks.https, text: "Certificat HTTPS actif, la boutique répond" },
  ];

  return (
    <>
      <a href="/admin/boutiques" className="back">
        ‹ Boutiques
      </a>
      <div className="page-head">
        <div>
          <h1>{site.name}</h1>
          <p className="sub">Nom de domaine : {site.domain}</p>
        </div>
        <div className="actions">
          <PreviewLink id={site.id} />
        </div>
      </div>
      <SiteTabs id={site.id} current="domaine" />
      {ok && FLASH[ok] && <p className="flash">{FLASH[ok]}</p>}
      {erreur && (
        <p className="notice" role="alert">
          {erreur}
        </p>
      )}

      {!realDomain ? (
        <p className="notice">
          « {site.domain} » n&apos;est pas un vrai nom de domaine. Achetez-en un (OVH, Gandi, Namecheap… environ 10 € par an), puis indiquez-le dans l&apos;onglet{" "}
          <a href={`/admin/boutiques/${site.id}`}>Réglages</a>.
        </p>
      ) : (
        <section className="panel" data-domain-status={st.status}>
          <div className="panel-head">
            <h2>
              {site.domain} <span className={`badge ${BADGE[st.status]}`}>{DOMAIN_STATUS_LABEL[st.status]}</span>
            </h2>
            <span className="hint">{st.checked_at ? `Vérifié le ${dateTime(st.checked_at)}` : "Pas encore vérifié"}, puis chaque matin automatiquement</span>
          </div>
          <div className="panel-body">
            <p>{st.message || (st.mode === "manuel" ? "Ajoutez le domaine à la main dans Vercel (étapes ci-dessous), puis cliquez sur « Vérifier maintenant »." : "Cliquez sur « Ajouter ce domaine » pour le rattacher à l'hébergement.")}</p>
            {st.mode === "demo" && <p className="notice info">Mode démo : l&apos;ajout et les vérifications sont simulés, une étape à chaque vérification.</p>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              {st.mode !== "manuel" && !st.checks.added && (
                <form action={addSiteDomain}>
                  <input type="hidden" name="site_id" value={site.id} />
                  <button className="btn" type="submit">
                    Ajouter ce domaine
                  </button>
                </form>
              )}
              {(st.checks.added || st.mode === "manuel" || st.status === "erreur") && (
                <form action={checkSiteDomain}>
                  <input type="hidden" name="site_id" value={site.id} />
                  <button className={`btn ${st.status === "en_ligne" ? "quiet" : ""}`} type="submit">
                    Vérifier maintenant
                  </button>
                </form>
              )}
            </div>
          </div>
          <ul className="checks" aria-label="Étapes">
            {steps.map((s) => (
              <li key={s.text}>
                <span className={`ic ${s.ok ? "good" : "info"}`} aria-hidden="true">
                  {s.ok ? "✓" : "–"}
                </span>
                <div>{s.text}</div>
                <span />
              </li>
            ))}
          </ul>
        </section>
      )}

      {realDomain && st.records.length > 0 && (
        <section className="panel gap">
          <div className="panel-head">
            <h2>Enregistrements DNS à créer chez votre registraire</h2>
            <span className="hint">Zone DNS de {site.domain.split(".").slice(-2).join(".")}. Supprimez les anciens enregistrements A ou CNAME sur les mêmes noms.</span>
          </div>
          <div className="table-wrap">
            <table aria-label="Enregistrements DNS">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Nom</th>
                  <th>Valeur</th>
                  <th>Rôle</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {st.records.map((r) => (
                  <tr key={`${r.type}-${r.host}-${r.value}`}>
                    <td>
                      <b>{r.type}</b>
                    </td>
                    <td>
                      <code>{r.name}</code> <CopyButton value={r.name} />
                    </td>
                    <td className="ellip" style={{ maxWidth: 340 }}>
                      <code>{r.value}</code> <CopyButton value={r.value} />
                    </td>
                    <td className="muted">{r.why}</td>
                    <td>
                      <span className={`badge ${r.ok ? "good" : r.ok === false ? "warn" : ""}`}>{r.ok ? "Bon" : r.ok === false ? "À créer" : "Inconnu"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-body">
            <p className="faint" style={{ fontSize: "0.86rem" }}>
              Chez certains registraires, le nom « @ » se laisse vide. La prise en compte prend de quelques minutes à 48 h ; l&apos;état se met à jour chaque matin, ou avec
              « Vérifier maintenant ».
            </p>
          </div>
        </section>
      )}

      {realDomain && st.status === "en_ligne" && (
        <section className="panel gap" data-next="declarer">
          <div className="panel-head">
            <h2>Dernière étape : déclarer le domaine à Google</h2>
            {st.declared && <span className="badge good">Fait</span>}
          </div>
          <div className="panel-body">
            <ol style={{ margin: "0 0 12px", paddingLeft: 20, lineHeight: 1.7 }}>
              <li>
                <a className="link-blue" href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">
                  Google Search Console
                </a>{" "}
                : ajoutez la propriété « Domaine » {site.domain} (vérification par un enregistrement TXT), puis déclarez le sitemap{" "}
                <code>https://{site.domain}/sitemap.xml</code>.
              </li>
              <li>
                <a className="link-blue" href="https://merchants.google.com" target="_blank" rel="noopener noreferrer">
                  Google Merchant Center
                </a>{" "}
                : ajoutez le site {site.domain} et le flux produits <code>https://{site.domain}/feed.xml</code> (gratuit : fiches produits dans Google Shopping).
              </li>
            </ol>
            <p className="faint" style={{ fontSize: "0.86rem" }}>
              Bing et les assistants IA qui s&apos;en servent ont déjà été prévenus par IndexNow{st.online_since ? ` le ${dateTime(st.online_since)}` : ""}.
            </p>
            {!st.declared && (
              <form action={declareSiteDomain} style={{ marginTop: 12 }}>
                <input type="hidden" name="site_id" value={site.id} />
                <button className="btn" type="submit">
                  C&apos;est fait
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      {realDomain && st.mode === "manuel" && (
        <section className="panel gap" data-mode="manuel">
          <div className="panel-head">
            <h2>Marche à suivre manuelle</h2>
            <span className="hint">Pour tout faire depuis ici : VERCEL_TOKEN et VERCEL_PROJECT_ID (Réglages &gt; État des services).</span>
          </div>
          <div className="panel-body">
            <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
              <li>
                Vercel &gt; projet &gt; <b>Settings &gt; Domains</b> : ajoutez <code>{site.domain}</code>
                {hosts[1] && (
                  <>
                    {" "}
                    et <code>{hosts[1]}</code> (choisissez la redirection vers {site.domain})
                  </>
                )}
                .
              </li>
              <li>Recopiez chez votre registraire les enregistrements DNS affichés par Vercel (en général un A pour le domaine et un CNAME pour www).</li>
              <li>Revenez ici et cliquez sur « Vérifier maintenant » : l&apos;état passe à « En ligne » quand la boutique répond en HTTPS.</li>
            </ol>
          </div>
        </section>
      )}

      <section className="panel gap">
        <div className="panel-head">
          <h2>Adresse d&apos;aperçu</h2>
          <span className="hint">Pour voir la boutique avant l&apos;achat du domaine. Jamais indexée par les moteurs.</span>
        </div>
        <div className="panel-body">
          <p>
            <a className="link-blue" href={previewBase(site.id)} target="_blank" rel="noopener noreferrer">
              <code>
                {origin}
                {previewBase(site.id)}
              </code>
            </a>{" "}
            <CopyButton value={`${origin}${previewBase(site.id)}`} />
          </p>
        </div>
      </section>
    </>
  );
}
