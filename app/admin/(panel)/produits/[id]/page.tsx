import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { adminContext } from "@/lib/admin";
import { euros } from "@/lib/format";
import { siteUrl } from "@/lib/sites";
import type { Product } from "@/lib/types";
import { deleteProduct, saveProduct } from "../../../actions";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; site?: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  if (id === "nouveau") return { title: "Nouveau produit" };
  return { title: (await db.getProduct(id))?.title ?? "Produit" };
}

const specsText = (p: Product) => p.specs.map((s) => `${s.label} : ${s.value}`).join("\n");
const faqText = (p: Product) => p.faq.map((f) => `${f.q}\n${f.a}`).join("\n\n");

export default async function ProductEdit({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "nouveau";
  const p = isNew ? null : await db.getProduct(id);
  if (!isNew && !p) notFound();
  const { sites, siteId: selected } = await adminContext(sp.site);
  const defaultSite = p?.site_id ?? sp.site ?? selected ?? sites[0]?.id;
  const site = sites.find((s) => s.id === defaultSite);

  return (
    <>
      <a href="/admin/produits" className="back">
        ‹ Produits
      </a>
      <div className="page-head">
        <div>
          <h1>{p ? p.title : "Nouveau produit"}</h1>
          {p && site && (
            <p>
              <a href={siteUrl(site, `/produits/${p.slug}`)} target="_blank" rel="noopener noreferrer">
                Voir sur {site.domain}
              </a>
            </p>
          )}
        </div>
      </div>
      {sp.ok && <p className="flash">Produit enregistré. La boutique est à jour.</p>}

      <form action={saveProduct} className="panel">
        {p && <input type="hidden" name="id" value={p.id} />}
        <div className="form-section">
          <h2>L&apos;essentiel</h2>
          <p>Le titre et le sous-titre apparaissent dans la grille et en haut de la fiche.</p>
          <div className="form-grid">
            <label className="field">
              <span>Boutique</span>
              <select name="site_id" defaultValue={defaultSite} required>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Catégorie</span>
              <input name="category" defaultValue={p?.category} placeholder="Ex. Organisation" />
            </label>
            <label className="field span-2">
              <span>Titre</span>
              <input name="title" defaultValue={p?.title} required placeholder="Ex. Bocaux en verre hermétiques, lot de 6" />
              <small>Décrivez le produit comme un client le chercherait sur Google, sans majuscules à chaque mot.</small>
            </label>
            <label className="field span-2">
              <span>Sous-titre</span>
              <input name="subtitle" defaultValue={p?.subtitle} placeholder="Ex. 1 litre, couvercle à levier et joint silicone" />
            </label>
            <label className="check">
              <input type="checkbox" name="active" defaultChecked={p?.active ?? true} />
              Visible sur la boutique
            </label>
          </div>
        </div>

        <div className="form-section">
          <h2>Prix et stock</h2>
          <p>Le prix d&apos;achat n&apos;est jamais affiché : il sert à calculer votre marge dans le tableau de bord.</p>
          <div className="form-grid three">
            <label className="field">
              <span>Prix de vente (€)</span>
              <input name="price" inputMode="decimal" defaultValue={euros(p?.price_cents)} required placeholder="34,90" />
            </label>
            <label className="field">
              <span>Prix barré (€)</span>
              <input name="compare_at" inputMode="decimal" defaultValue={euros(p?.compare_at_cents)} placeholder="Facultatif" />
              <small>Uniquement s&apos;il correspond à un vrai prix pratiqué auparavant.</small>
            </label>
            <label className="field">
              <span>Prix d&apos;achat (€)</span>
              <input name="cost" inputMode="decimal" defaultValue={euros(p?.cost_cents)} placeholder="Coût fournisseur" />
            </label>
            <label className="field">
              <span>Stock</span>
              <input name="stock" type="number" min={0} defaultValue={p?.stock ?? ""} placeholder="Vide = non suivi" />
            </label>
            <label className="field">
              <span>Référence (SKU)</span>
              <input name="sku" defaultValue={p?.sku} />
            </label>
            <label className="field">
              <span>Ordre d&apos;affichage</span>
              <input name="position" type="number" defaultValue={p?.position ?? 0} />
            </label>
          </div>
        </div>

        <div className="form-section">
          <h2>Fournisseur</h2>
          <p>Le lien s&apos;affiche dans chaque commande pour recommander en un clic.</p>
          <div className="form-grid">
            <label className="field">
              <span>Nom du fournisseur</span>
              <input name="supplier" defaultValue={p?.supplier} placeholder="Ex. CJ Dropshipping" />
            </label>
            <label className="field">
              <span>Lien vers le produit chez le fournisseur</span>
              <input name="supplier_url" type="url" defaultValue={p?.supplier_url} placeholder="https://" />
            </label>
            <label className="field">
              <span>Identifiant de variante CJ (vid)</span>
              <input name="supplier_variant_id" defaultValue={p?.supplier_variant_id ?? ""} placeholder="Pour l'envoi automatique des commandes" />
              <small>Dans CJ : fiche produit, variante, « VID ». Sans lui, la commande reste à transmettre à la main.</small>
            </label>
            <label className="field">
              <span>Pays de l&apos;entrepôt</span>
              <input name="supplier_country" defaultValue={p?.supplier_country ?? ""} placeholder="CN, FR, DE…" maxLength={2} />
              <small>Un entrepôt en Europe livre en quelques jours au lieu de 1 à 3 semaines.</small>
            </label>
          </div>
        </div>

        <div className="form-section">
          <h2>Photos</h2>
          <p>Une adresse d&apos;image par ligne, la première est la photo principale. Utilisez vos propres photos ou des photos libres de droits.</p>
          <label className="field">
            <span>Adresses des images</span>
            <textarea name="images" rows={3} defaultValue={p?.images.join("\n")} placeholder="https://…/photo-1.jpg" />
          </label>
        </div>

        <div className="form-section">
          <h2>Contenu de la fiche</h2>
          <p>
            Un texte original et précis est ce qui fait remonter une fiche sur Google et la fait citer par les IA. Ne copiez pas la description du
            fournisseur.
          </p>
          <div className="form">
            <label className="field">
              <span>Description</span>
              <textarea name="description" rows={10} defaultValue={p?.description} />
              <small>Ligne vide = nouveau paragraphe. « ## Titre » pour un intertitre, « - » pour une liste, **gras**.</small>
            </label>
            <label className="field">
              <span>Points forts</span>
              <textarea name="highlights" rows={3} defaultValue={p?.highlights.join("\n")} placeholder="Un point fort par ligne" />
            </label>
            <label className="field">
              <span>Caractéristiques</span>
              <textarea name="specs" rows={4} defaultValue={p ? specsText(p) : ""} placeholder={"Contenance : 1 L\nMatière : verre"} />
              <small>Une par ligne, au format « Libellé : valeur ».</small>
            </label>
            <label className="field">
              <span>Questions fréquentes</span>
              <textarea
                name="faq"
                rows={6}
                defaultValue={p ? faqText(p) : ""}
                placeholder={"Passe-t-il au lave-vaisselle ?\nOui, sauf le couvercle.\n\nQuestion suivante ?\nRéponse."}
              />
              <small>Question sur la 1re ligne, réponse dessous, une ligne vide entre chaque question.</small>
            </label>
          </div>
        </div>

        <div className="form-section">
          <h2>Référencement</h2>
          <p>Facultatif : si vous laissez vide, le titre et le début de la description sont utilisés.</p>
          <div className="form-grid">
            <label className="field">
              <span>Adresse de la page</span>
              <input name="slug" defaultValue={p?.slug} placeholder="Générée depuis le titre" />
            </label>
            <label className="field">
              <span>Titre pour Google</span>
              <input name="seo_title" defaultValue={p?.seo_title} maxLength={70} />
            </label>
            <label className="field span-2">
              <span>Description pour Google</span>
              <textarea name="seo_description" rows={2} defaultValue={p?.seo_description} maxLength={170} />
              <small>Environ 150 caractères.</small>
            </label>
            <label className="field">
              <span>Marque</span>
              <input name="brand" defaultValue={p?.brand} placeholder="Par défaut, le nom de la boutique" />
            </label>
            <label className="field">
              <span>Code-barres (EAN / GTIN)</span>
              <input name="gtin" defaultValue={p?.gtin} />
            </label>
          </div>
        </div>

        <div className="form-section form-actions">
          <button className="btn" type="submit">
            {p ? "Enregistrer" : "Créer le produit"}
          </button>
        </div>
      </form>

      {p && (
        <form action={deleteProduct} style={{ marginTop: 16 }}>
          <input type="hidden" name="id" value={p.id} />
          <label className="check" style={{ marginBottom: 10 }}>
            <input type="checkbox" required />
            Supprimer définitivement ce produit (les commandes passées sont conservées)
          </label>
          <button className="btn danger small" type="submit">
            Supprimer le produit
          </button>
        </form>
      )}
    </>
  );
}
