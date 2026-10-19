// Section Images de la fiche produit : galerie (ordre, photo principale, texte alternatif, qualité)
// et les trois façons d'ajouter des images : agent (fournisseur), adresses, envoi depuis l'ordinateur.
import Image from "next/image";
import { hasCJ } from "@/lib/suppliers/cj";
import { galleryOf } from "@/lib/images/gallery";
import type { Product } from "@/lib/types";
import { MAX_IMAGES } from "@/lib/images/agent";
import { addImageUrls, fetchProductImages, moveProductImage, removeProductImage, saveImageAlt, setMainProductImage, uploadImages } from "../../../image-actions";

const SOURCE: Record<string, string> = { cj: "CJ", url: "Adresse", upload: "Envoi", demo: "Démo" };

export async function ImagesPanel({ p, message }: { p: Product; message?: string }) {
  const gallery = await galleryOf(p);
  const hidden = (url: string) => (
    <>
      <input type="hidden" name="product_id" value={p.id} />
      <input type="hidden" name="url" value={url} />
    </>
  );

  return (
    <section className="panel" id="images" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <h2>Images ({gallery.length}/{MAX_IMAGES})</h2>
        <span className="hint">La première est la photo principale (grilles, Google Shopping, partages).</span>
      </div>
      {message && (
        <p className={message.startsWith("Échec") ? "notice" : "flash"} role="status" style={{ margin: "12px 16px 0" }}>
          {message}
        </p>
      )}

      {gallery.length > 0 ? (
        <ul className="img-grid" aria-label="Galerie du produit">
          {gallery.map((m, i) => (
            <li key={m.url} className="img-card">
              <div className="img-thumb">
                <Image src={m.url} alt={m.alt} fill sizes="200px" unoptimized={m.url.endsWith(".svg")} />
                {i === 0 && <span className="badge good img-main">Principale</span>}
              </div>
              <div className="img-meta">
                {typeof m.score === "number" && m.width ? (
                  <span className={`badge ${m.score >= 75 ? "good" : m.score >= 50 ? "info" : "warn"}`} title="Qualité mesurée : résolution, netteté, cadrage, fond">
                    Qualité {m.score}/100
                  </span>
                ) : (
                  <span className="badge warn" title="Pas encore contrôlée ni rangée chez nous : cliquez sur « Récupérer les images »">
                    Non contrôlée
                  </span>
                )}
                <span className="faint">
                  {m.width ? `${m.width} × ${m.height}` : "taille inconnue"}
                  {m.source ? ` · ${SOURCE[m.source] ?? m.source}` : ""}
                  {m.notes?.length ? ` · ${m.notes.join(", ")}` : ""}
                </span>
              </div>
              <form action={saveImageAlt} className="img-alt">
                {hidden(m.url)}
                <label className="sr-only" htmlFor={`alt-${i}`}>
                  Texte alternatif de l&apos;image {i + 1}
                </label>
                <input id={`alt-${i}`} name="alt" defaultValue={m.alt} placeholder="Ce que montre la photo" />
                <button className="btn quiet small" type="submit">
                  OK
                </button>
              </form>
              <div className="img-actions">
                <form action={moveProductImage}>
                  {hidden(m.url)}
                  <input type="hidden" name="dir" value="-1" />
                  <button className="btn quiet small" type="submit" disabled={i === 0} aria-label={`Avancer l'image ${i + 1}`}>
                    ←
                  </button>
                </form>
                <form action={moveProductImage}>
                  {hidden(m.url)}
                  <input type="hidden" name="dir" value="1" />
                  <button className="btn quiet small" type="submit" disabled={i === gallery.length - 1} aria-label={`Reculer l'image ${i + 1}`}>
                    →
                  </button>
                </form>
                {i > 0 && (
                  <form action={setMainProductImage}>
                    {hidden(m.url)}
                    <button className="btn quiet small" type="submit">
                      Principale
                    </button>
                  </form>
                )}
                <form action={removeProductImage}>
                  {hidden(m.url)}
                  <button className="btn quiet small" type="submit" aria-label={`Retirer l'image ${i + 1}`}>
                    Retirer
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-row">Aucune image pour l&apos;instant.</p>
      )}

      <div className="img-add">
        <form action={fetchProductImages} className="img-add-box">
          <input type="hidden" name="product_id" value={p.id} />
          <h3>Récupérer automatiquement</h3>
          <p className="faint">
            {hasCJ()
              ? "L'agent prend les photos du fournisseur CJ (variante vendue en premier), écarte les floues, trop petites et doublons, les met au propre (carré, 1200 px au moins, WebP) et les range chez nous."
              : "Sans CJ_API_KEY, l'agent rapatrie et met au propre les images déjà présentes. Avec la clé, il prend aussi les photos du fournisseur CJ."}
          </p>
          <label className="check">
            <input type="checkbox" name="replace" />
            Remplacer la galerie actuelle
          </label>
          <button className="btn" type="submit">
            Récupérer les images
          </button>
        </form>
        <form action={addImageUrls} className="img-add-box">
          <input type="hidden" name="product_id" value={p.id} />
          <h3>Ajouter par adresse</h3>
          <label className="field">
            <span>Adresses d&apos;images (une par ligne)</span>
            <textarea name="urls" rows={3} placeholder="https://…/photo.jpg" />
          </label>
          <small className="faint">Seulement des images que vous avez le droit d&apos;utiliser : fournisseur, fabricant, vos photos. Jamais celles d&apos;une autre boutique.</small>
          <button className="btn quiet" type="submit">
            Ajouter
          </button>
        </form>
        <form action={uploadImages} className="img-add-box">
          <input type="hidden" name="product_id" value={p.id} />
          <h3>Envoyer vos photos</h3>
          <label className="field">
            <span>Photos (JPEG, PNG, WebP, 20 Mo au plus)</span>
            <input type="file" name="files" accept="image/jpeg,image/png,image/webp,image/avif" multiple />
          </label>
          <button className="btn quiet" type="submit">
            Envoyer
          </button>
        </form>
      </div>
    </section>
  );
}
