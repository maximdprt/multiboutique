import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { euros } from "@/lib/format";
import { saveSite } from "../../../actions";
import { PreviewLink, SiteTabs } from "./SiteTabs";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  if (id === "nouvelle") return { title: "Nouvelle boutique" };
  return { title: (await db.getSite(id))?.name ?? "Boutique" };
}

export default async function ShopEdit({ params, searchParams }: Props) {
  const { id } = await params;
  const { ok } = await searchParams;
  const isNew = id === "nouvelle";
  const s = isNew ? null : await db.getSite(id);
  if (!isNew && !s) notFound();
  const products = s ? await db.listProducts({ siteId: s.id }) : [];

  return (
    <>
      <a href="/admin/boutiques" className="back">
        ‹ Boutiques et domaines
      </a>
      <div className="page-head">
        <div>
          <h1>{s ? s.name : "Nouvelle boutique"}</h1>
          {s && <p>{s.domain}</p>}
        </div>
        {s && (
          <div className="actions">
            <PreviewLink id={s.id} />
          </div>
        )}
      </div>
      {s && <SiteTabs id={s.id} current="reglages" />}
      {ok && <p className="flash">Boutique enregistrée. Les pages sont à jour.</p>}

      <form action={saveSite} className="panel">
        <input type="hidden" name="is_new" value={isNew ? "1" : "0"} />
        <div className="form-section">
          <h2>Identité</h2>
          <p>Le nom de domaine doit pointer vers votre hébergement (voir le README).</p>
          <div className="form-grid">
            <label className="field">
              <span>Identifiant</span>
              {s ? (
                <>
                  <input value={s.id} disabled />
                  <input type="hidden" name="id" value={s.id} />
                </>
              ) : (
                <input name="id" required pattern="[a-z0-9]+" placeholder="Ex. yoga" />
              )}
              <small>Lettres minuscules et chiffres, sans espace. Ne peut plus changer ensuite.</small>
            </label>
            <label className="field">
              <span>Nom de domaine</span>
              <input name="domain" defaultValue={s?.domain} required placeholder="ma-boutique.fr" />
            </label>
            <label className="field">
              <span>Nom de la boutique</span>
              <input name="name" defaultValue={s?.name} required />
            </label>
            <label className="field">
              <span>Accroche</span>
              <input name="tagline" defaultValue={s?.tagline} placeholder="Ce que vous vendez, en une ligne" />
            </label>
            <label className="field span-2">
              <span>Description</span>
              <textarea name="description" rows={3} defaultValue={s?.description} />
              <small>Qui vous êtes, ce que vous vendez, à qui, où vous livrez. Reprise par Google et les assistants IA.</small>
            </label>
            <label className="check">
              <input type="checkbox" name="active" defaultChecked={s?.active ?? true} />
              Boutique en ligne
            </label>
          </div>
        </div>

        <div className="form-section">
          <h2>Page d&apos;accueil</h2>
          <p>Le grand titre et le produit mis en avant en haut de la page.</p>
          <div className="form-grid">
            <label className="field span-2">
              <span>Grand titre</span>
              <input name="hero_title" defaultValue={s?.hero_title} />
            </label>
            <label className="field span-2">
              <span>Texte d&apos;introduction</span>
              <textarea name="hero_text" rows={2} defaultValue={s?.hero_text} />
            </label>
            <label className="field">
              <span>Produit mis en avant</span>
              <select name="hero_product_id" defaultValue={s?.hero_product_id ?? ""}>
                <option value="">Le premier produit</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="form-section">
          <h2>Apparence</h2>
          <p>Choisissez des couleurs bien contrastées : texte foncé sur fond clair (Classique) ou texte clair sur fond très sombre (Studio).</p>
          <div className="form-grid three">
            <label className="field">
              <span>Gabarit</span>
              <select name="template" defaultValue={s ? (s.theme.template ?? "classique") : "studio"}>
                <option value="studio">Studio : sombre, nom en très grand, animations au défilement</option>
                <option value="classique">Classique : clair et sobre</option>
              </select>
              <small>Studio : le bouton principal est un dégradé de la couleur principale vers la couleur d&apos;accent.</small>
            </label>
            <label className="field">
              <span>Fond</span>
              <input type="color" name="bg" defaultValue={s?.theme.background ?? "#0c0c0c"} />
            </label>
            <label className="field">
              <span>Texte</span>
              <input type="color" name="ink" defaultValue={s?.theme.ink ?? "#d7e2ea"} />
            </label>
            <label className="field">
              <span>Couleur principale</span>
              <input type="color" name="primary" defaultValue={s?.theme.primary ?? "#7621b0"} />
            </label>
            <label className="field">
              <span>Couleur d&apos;accent</span>
              <input type="color" name="accent" defaultValue={s?.theme.accent ?? "#be4c00"} />
            </label>
            <label className="field">
              <span>Police des titres</span>
              <select name="font" defaultValue={s?.theme.font ?? "kanit"}>
                <option value="serif">Serif (Newsreader), plutôt maison et artisanal</option>
                <option value="grotesk">Sans serif (Schibsted Grotesk), plutôt moderne</option>
                <option value="kanit">Kanit, géométrique et affirmée (gabarit Studio)</option>
              </select>
            </label>
          </div>
        </div>

        <div className="form-section">
          <h2>Livraison et retours</h2>
          <p>Utilisés sur les fiches produits, au paiement, dans les pages légales et les données lues par Google.</p>
          <div className="form-grid three">
            <label className="field">
              <span>Frais de port (€)</span>
              <input name="flat" inputMode="decimal" defaultValue={euros(s?.shipping.flat_cents ?? 490)} />
            </label>
            <label className="field">
              <span>Offerte dès (€)</span>
              <input name="free_from" inputMode="decimal" defaultValue={euros(s?.shipping.free_from_cents ?? 4900)} />
              <small>0 = jamais offerte</small>
            </label>
            <label className="field">
              <span>Délai de livraison</span>
              <input name="delay" defaultValue={s?.shipping.delay ?? "5 à 8 jours ouvrés"} />
            </label>
            <label className="field">
              <span>Pays livrés</span>
              <input name="countries" defaultValue={(s?.shipping.countries ?? ["FR", "BE", "LU"]).join(", ")} />
              <small>Codes à 2 lettres : FR, BE, CH, LU…</small>
            </label>
            <label className="field">
              <span>Délai de retour (jours)</span>
              <input name="return_days" type="number" min={14} defaultValue={s?.return_days ?? 14} />
              <small>14 jours minimum (obligation légale)</small>
            </label>
          </div>
        </div>

        <div className="form-section">
          <h2>Informations légales</h2>
          <p>Elles remplissent automatiquement les mentions légales, les CGV et la page confidentialité.</p>
          <div className="form-grid">
            <label className="field">
              <span>Raison sociale ou nom</span>
              <input name="company" defaultValue={s?.legal.company} placeholder="Prénom Nom — Entrepreneur individuel" />
            </label>
            <label className="field">
              <span>SIRET</span>
              <input name="siret" defaultValue={s?.legal.siret} />
            </label>
            <label className="field span-2">
              <span>Adresse</span>
              <input name="address" defaultValue={s?.legal.address} />
            </label>
            <label className="field">
              <span>E-mail de contact</span>
              <input name="email" type="email" defaultValue={s?.legal.email} required />
            </label>
            <label className="field">
              <span>Téléphone</span>
              <input name="phone" defaultValue={s?.legal.phone} placeholder="Facultatif" />
            </label>
            <label className="field">
              <span>N° de TVA intracommunautaire</span>
              <input name="vat" defaultValue={s?.legal.vat} />
              <small>Vide = « TVA non applicable, art. 293 B du CGI » (franchise en base)</small>
            </label>
            <label className="field">
              <span>Médiateur de la consommation</span>
              <input name="mediator" defaultValue={s?.legal.mediator} placeholder="Nom et site du médiateur" />
              <small>Obligatoire pour vendre à des particuliers.</small>
            </label>
            <label className="field span-2">
              <span>Hébergeur</span>
              <input
                name="host"
                defaultValue={s?.legal.host ?? "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis"}
              />
            </label>
          </div>
        </div>

        <div className="form-section">
          <h2>Questions fréquentes</h2>
          <p>Affichées en bas de l&apos;accueil. Question sur la 1re ligne, réponse dessous, une ligne vide entre chaque.</p>
          <label className="field">
            <span>FAQ de la boutique</span>
            <textarea name="faq" rows={8} defaultValue={s?.faq.map((f) => `${f.q}\n${f.a}`).join("\n\n")} />
          </label>
        </div>

        <div className="form-section form-actions">
          <button className="btn" type="submit">
            {s ? "Enregistrer" : "Créer la boutique"}
          </button>
        </div>
      </form>
    </>
  );
}
