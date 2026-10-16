import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { adminContext } from "@/lib/admin";
import { siteUrl } from "@/lib/sites";
import { deleteGuide, saveGuide } from "../../../actions";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; site?: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  if (id === "nouveau") return { title: "Nouveau guide" };
  return { title: (await db.getGuide(id))?.title ?? "Guide" };
}

export default async function GuideEdit({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "nouveau";
  const g = isNew ? null : await db.getGuide(id);
  if (!isNew && !g) notFound();
  const { sites, siteId: selected } = await adminContext(sp.site);
  const siteId = g?.site_id ?? sp.site ?? selected ?? sites[0]?.id;
  const site = sites.find((s) => s.id === siteId);
  const products = await db.listProducts({ siteId });

  return (
    <>
      <a href="/admin/guides" className="back">
        ‹ Guides
      </a>
      <div className="page-head">
        <div>
          <h1>{g ? g.title : "Nouveau guide"}</h1>
          {g && site && g.published && (
            <p>
              <a href={siteUrl(site, `/guides/${g.slug}`)} target="_blank" rel="noopener noreferrer">
                Voir sur {site.domain}
              </a>
            </p>
          )}
        </div>
      </div>
      {sp.ok && <p className="flash">Guide enregistré.</p>}

      <form action={saveGuide} className="panel">
        {g && <input type="hidden" name="id" value={g.id} />}
        <div className="form-section form">
          <div className="form-grid">
            <label className="field">
              <span>Boutique</span>
              {g ? (
                <>
                  <input value={site?.name ?? siteId} disabled />
                  <input type="hidden" name="site_id" value={siteId} />
                </>
              ) : (
                <select name="site_id" defaultValue={siteId} required>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label className="check" style={{ alignSelf: "end", paddingBottom: 8 }}>
              <input type="checkbox" name="published" defaultChecked={g?.published ?? false} />
              Publié sur la boutique
            </label>
          </div>
          <label className="field">
            <span>Titre</span>
            <input name="title" defaultValue={g?.title} required placeholder="Ex. Quel griffoir choisir pour son chat ?" />
            <small>Formulez-le comme la question que les gens tapent dans Google ou posent à une IA.</small>
          </label>
          <label className="field">
            <span>Chapeau</span>
            <textarea name="excerpt" rows={2} defaultValue={g?.excerpt} placeholder="La réponse en une ou deux phrases." />
            <small>Donnez la réponse tout de suite : c&apos;est ce passage que les moteurs IA reprennent le plus souvent.</small>
          </label>
          <label className="field">
            <span>Texte</span>
            <textarea name="body" rows={18} defaultValue={g?.body} />
            <small>Ligne vide = nouveau paragraphe. « ## Titre » pour un intertitre, « - » pour une liste, **gras**, [texte](/produits/adresse) pour un lien.</small>
          </label>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Produits cités</span>
            {!g && <small>Enregistrez d&apos;abord le guide pour choisir les produits d&apos;une autre boutique.</small>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 6, marginTop: 6 }}>
              {products.map((p) => (
                <label key={p.id} className="check">
                  <input type="checkbox" name="product_ids" value={p.id} defaultChecked={g?.product_ids.includes(p.id)} />
                  {p.title}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="form-section">
          <h2>Référencement</h2>
          <p>Facultatif.</p>
          <div className="form-grid">
            <label className="field">
              <span>Adresse de la page</span>
              <input name="slug" defaultValue={g?.slug} placeholder="Générée depuis le titre" />
            </label>
            <label className="field">
              <span>Titre pour Google</span>
              <input name="seo_title" defaultValue={g?.seo_title} maxLength={70} />
            </label>
            <label className="field span-2">
              <span>Description pour Google</span>
              <textarea name="seo_description" rows={2} defaultValue={g?.seo_description} maxLength={170} />
            </label>
          </div>
        </div>
        <div className="form-section form-actions">
          <button className="btn" type="submit">
            {g ? "Enregistrer" : "Créer le guide"}
          </button>
        </div>
      </form>

      {g && (
        <form action={deleteGuide} style={{ marginTop: 16 }}>
          <input type="hidden" name="id" value={g.id} />
          <label className="check" style={{ marginBottom: 10 }}>
            <input type="checkbox" required />
            Supprimer définitivement ce guide
          </label>
          <button className="btn danger small" type="submit">
            Supprimer le guide
          </button>
        </form>
      )}
    </>
  );
}
