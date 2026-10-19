"use client";
// Assistant de création : 1. la niche  2. vos choix (nom, couleurs, produits, guides, livraison)  3. l'agent construit.
import { useEffect, useState } from "react";
import "@fontsource/kanit/800.css";
import { buildAction, proposeAction, runStatus } from "../../../agent-actions";
import type { Palette, Proposal } from "@/lib/agents/builder";
import type { AgentRun } from "@/lib/types";

type Idea = { id: string; niche: string; product: string; score: number; notes: string };
type Defaults = { countries: string; flat: string; free: string; delay: string; returnDays: number };

const toCents = (v: string) => Math.round(Number(v.replace(/\s/g, "").replace(",", ".")) * 100) || 0;

export function Wizard({ demo, initial, ideas, defaults }: { demo: boolean; initial: Omit<Idea, "score"> | null; ideas: Idea[]; defaults: Defaults }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [oppId, setOppId] = useState(initial?.id ?? "");
  const [niche, setNiche] = useState(initial?.niche ?? "");
  const [product, setProduct] = useState(initial?.product ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [prop, setProp] = useState<Proposal | null>(null);
  const [nameIdx, setNameIdx] = useState(0);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [tagline, setTagline] = useState("");
  const [palIdx, setPalIdx] = useState(0);
  const [products, setProducts] = useState<string[]>([]);
  const [guides, setGuides] = useState<string[]>([]);
  const [extraProduct, setExtraProduct] = useState("");
  const [extraGuide, setExtraGuide] = useState("");
  const [ship, setShip] = useState(defaults);

  const [run, setRun] = useState<AgentRun | null>(null);

  // suivi de la construction
  useEffect(() => {
    if (!run || run.status !== "en_cours") return;
    const t = setInterval(async () => {
      const r = await runStatus(run.id);
      if (r) setRun(r);
    }, 2500);
    return () => clearInterval(t);
  }, [run]);

  async function propose() {
    if (!niche.trim() || !product.trim()) {
      setError("Indiquez la niche et le produit d'appel.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await proposeAction({ niche, product, notes });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const p = res.proposal;
    setProp(p);
    setNameIdx(0);
    setName(p.names[0]?.name ?? "");
    setDomain(p.names[0]?.domain ?? "");
    setTagline(p.tagline);
    setPalIdx(0);
    setProducts(p.products.slice(0, 6).map((x) => x.title));
    setGuides(p.guides.slice(0, 3).map((x) => x.title));
    setStep(2);
  }

  async function build() {
    if (!prop) return;
    if (!name.trim() || !domain.trim()) {
      setError("Choisissez un nom et un domaine.");
      return;
    }
    if (!products.length) {
      setError("Gardez au moins un produit.");
      return;
    }
    setBusy(true);
    setError("");
    const palette: Palette = prop.palettes[palIdx];
    const { runId } = await buildAction({
      niche,
      product,
      notes,
      opportunity_id: oppId || undefined,
      name: name.trim(),
      domain: domain.trim().toLowerCase(),
      tagline,
      palette,
      products,
      guides,
      countries: ship.countries.toUpperCase().split(/[^A-Z]+/).filter((c) => c.length === 2),
      flat_cents: toCents(ship.flat),
      free_from_cents: toCents(ship.free),
      delay: ship.delay,
      return_days: Math.max(14, Number(ship.returnDays) || 14),
    });
    setBusy(false);
    setRun({ id: runId, status: "en_cours", log: [], kind: "construction", title: "", result: null, site_id: null, created_at: "", finished_at: null });
    setStep(3);
  }

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="wizard">
      <div className="steps" aria-label="Étapes">
        {["La niche", "Vos choix", "Construction"].map((s, i) => (
          <span key={s} aria-current={step === i + 1 ? "step" : undefined} className={step > i + 1 ? "done" : ""}>
            {i + 1}. {s}
          </span>
        ))}
      </div>
      {demo && step < 3 && (
        <p className="notice info">
          Mode démo : sans clé API, l&apos;agent remplit la boutique avec un contenu modèle. Le parcours est le même qu&apos;en réel.
        </p>
      )}

      {step === 1 && (
        <section className="panel">
          <div className="form-section">
            <h2>Quelle niche voulez-vous lancer ?</h2>
            <p>Partez d&apos;une idée de la veille, ou décrivez la vôtre.</p>
            {ideas.length > 0 && (
              <div className="choices" style={{ marginBottom: 16 }}>
                {ideas.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className="choice"
                    aria-pressed={oppId === o.id}
                    onClick={() => {
                      setOppId(o.id);
                      setNiche(o.niche);
                      setProduct(o.product);
                      setNotes(o.notes);
                    }}
                  >
                    <b>{o.product}</b>
                    <small>
                      {o.niche}, score {o.score}
                    </small>
                  </button>
                ))}
              </div>
            )}
            <div className="form">
              <div className="form-grid">
                <label className="field">
                  <span>Niche</span>
                  <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Ex. Jardinage d'intérieur" />
                </label>
                <label className="field">
                  <span>Produit d&apos;appel</span>
                  <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Ex. Kit de culture de micro-pousses" />
                </label>
              </div>
              <label className="field">
                <span>Précisions pour l&apos;agent (facultatif)</span>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cible, style, ce que vous voulez éviter…" />
              </label>
            </div>
          </div>
          <div className="form-section form-actions">
            {error && <span className="err">{error}</span>}
            <button className="btn" type="button" onClick={propose} disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner" aria-hidden="true" /> L&apos;agent prépare ses propositions…
                </>
              ) : (
                "Voir les propositions de l'agent"
              )}
            </button>
          </div>
        </section>
      )}

      {step === 2 && prop && (
        <section className="panel">
          <div className="form-section">
            <h2>Le nom</h2>
            <p>Vérifiez que le domaine est libre chez votre registraire (OVH, Gandi…) avant de l&apos;acheter.</p>
            <div className="choices">
              {prop.names.map((n, i) => (
                <button
                  key={n.domain}
                  type="button"
                  className="choice"
                  aria-pressed={nameIdx === i}
                  onClick={() => {
                    setNameIdx(i);
                    setName(n.name);
                    setDomain(n.domain);
                  }}
                >
                  <b>{n.name}</b>
                  <small>{n.domain}</small>
                  <small>{n.why}</small>
                </button>
              ))}
            </div>
            <div className="form-grid three" style={{ marginTop: 12 }}>
              <label className="field">
                <span>Nom retenu</span>
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="field">
                <span>Domaine</span>
                <input value={domain} onChange={(e) => setDomain(e.target.value)} />
              </label>
              <label className="field">
                <span>Accroche</span>
                <input value={tagline} onChange={(e) => setTagline(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="form-section">
            <h2>Les couleurs</h2>
            <p>La boutique utilise le gabarit Studio : fond sombre, nom en très grand, bouton en dégradé de la couleur principale vers l&apos;accent.</p>
            <div className="choices">
              {prop.palettes.map((p, i) => (
                <button key={p.label} type="button" className="choice" aria-pressed={palIdx === i} onClick={() => setPalIdx(i)}>
                  <b>{p.label}</b>
                  <div className="swatches" aria-hidden="true">
                    {[p.background, p.ink, p.primary, p.accent].map((c) => (
                      <i key={c} style={{ background: c }} />
                    ))}
                  </div>
                  <div
                    className="preview-mini"
                    style={{
                      background: p.background,
                      color: p.ink,
                      fontFamily: p.font === "serif" ? "Georgia, serif" : p.font === "kanit" ? "Kanit, system-ui, sans-serif" : "inherit",
                      fontWeight: p.font === "kanit" ? 800 : undefined,
                      textTransform: p.font === "kanit" ? "uppercase" : undefined,
                    }}
                  >
                    {name || "Votre boutique"}
                    <br />
                    <span
                      className="btnp"
                      style={{ background: `linear-gradient(123deg, ${p.primary} 30%, ${p.accent} 100%)`, fontFamily: "system-ui", borderRadius: 999, fontWeight: 500, textTransform: "none" }}
                    >
                      Ajouter au panier
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h2>Les produits</h2>
            <p>L&apos;agent écrit une fiche complète pour chaque produit coché et cherche un fournisseur. Vous ajouterez les photos.</p>
            <div className="checklist">
              {[...new Set([...prop.products.map((p) => p.title), ...products])].map((t) => (
                <label key={t} className="check">
                  <input type="checkbox" checked={products.includes(t)} onChange={() => toggle(products, setProducts, t)} />
                  {t}
                </label>
              ))}
            </div>
            <div className="toolbar" style={{ border: 0, padding: "10px 0 0" }}>
              <input value={extraProduct} onChange={(e) => setExtraProduct(e.target.value)} placeholder="Ajouter un produit" />
              <button
                type="button"
                className="btn quiet small"
                onClick={() => {
                  if (extraProduct.trim()) setProducts([...products, extraProduct.trim()]);
                  setExtraProduct("");
                }}
              >
                Ajouter
              </button>
            </div>
          </div>

          <div className="form-section">
            <h2>Les guides</h2>
            <p>Ce sont eux qui font venir les visiteurs depuis Google et les IA. L&apos;agent en écrira ensuite un nouveau chaque semaine.</p>
            <div className="checklist">
              {[...new Set([...prop.guides.map((g) => g.title), ...guides])].map((t) => (
                <label key={t} className="check">
                  <input type="checkbox" checked={guides.includes(t)} onChange={() => toggle(guides, setGuides, t)} />
                  {t}
                </label>
              ))}
            </div>
            <div className="toolbar" style={{ border: 0, padding: "10px 0 0" }}>
              <input value={extraGuide} onChange={(e) => setExtraGuide(e.target.value)} placeholder="Ajouter un sujet de guide" />
              <button
                type="button"
                className="btn quiet small"
                onClick={() => {
                  if (extraGuide.trim()) setGuides([...guides, extraGuide.trim()]);
                  setExtraGuide("");
                }}
              >
                Ajouter
              </button>
            </div>
          </div>

          <div className="form-section">
            <h2>Livraison et retours</h2>
            <div className="form-grid three">
              <label className="field">
                <span>Pays livrés</span>
                <input value={ship.countries} onChange={(e) => setShip({ ...ship, countries: e.target.value })} />
              </label>
              <label className="field">
                <span>Frais de port (€)</span>
                <input value={ship.flat} onChange={(e) => setShip({ ...ship, flat: e.target.value })} inputMode="decimal" />
              </label>
              <label className="field">
                <span>Offerte dès (€)</span>
                <input value={ship.free} onChange={(e) => setShip({ ...ship, free: e.target.value })} inputMode="decimal" />
              </label>
              <label className="field">
                <span>Délai</span>
                <input value={ship.delay} onChange={(e) => setShip({ ...ship, delay: e.target.value })} />
              </label>
              <label className="field">
                <span>Retours (jours)</span>
                <input type="number" min={14} value={ship.returnDays} onChange={(e) => setShip({ ...ship, returnDays: Number(e.target.value) })} />
              </label>
            </div>
          </div>

          <div className="form-section form-actions">
            {error && <span className="err">{error}</span>}
            <button className="btn quiet" type="button" onClick={() => setStep(1)}>
              Retour
            </button>
            <button className="btn" type="button" onClick={build} disabled={busy}>
              {busy ? "Lancement…" : `Construire la boutique (${products.length} produit${products.length > 1 ? "s" : ""}, ${guides.length} guide${guides.length > 1 ? "s" : ""})`}
            </button>
          </div>
        </section>
      )}

      {step === 3 && run && (
        <section className="panel">
          <div className="form-section">
            <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {run.status === "en_cours" && <span className="spinner" aria-hidden="true" />}
              {run.status === "en_cours" ? "L'agent construit la boutique…" : run.status === "termine" ? "La boutique est prête." : "La construction a échoué."}
            </h2>
            <p>
              {run.status === "en_cours"
                ? "Comptez une à trois minutes. Vous pouvez quitter cette page : le travail continue, et il reste visible dans Agents."
                : run.status === "termine"
                  ? `${String(run.result?.produits ?? 0)} fiches produits et ${String(run.result?.guides ?? 0)} guides en ligne sur ${String(run.result?.domain ?? "")}.`
                  : String(run.result?.error ?? "")}
            </p>
            <div className="log">{run.log.join("\n") || "Démarrage…"}</div>
          </div>
          {run.status === "termine" && (
            <div className="form-section">
              <h2>Ce qu&apos;il vous reste à faire</h2>
              <ol style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.8 }}>
                <li>
                  Ajouter les photos et vérifier prix d&apos;achat et lien fournisseur de chaque produit :{" "}
                  <a className="link-blue" href={`/admin/produits?site=${String(run.result?.site_id ?? "")}`}>
                    ouvrir les produits
                  </a>
                  .
                </li>
                <li>Acheter le domaine {String(run.result?.domain ?? "")} et l&apos;ajouter dans Vercel (Settings, Domains).</li>
                <li>Déclarer le domaine dans la Google Search Console et y envoyer le sitemap.</li>
                <li>Déclarer le flux produits dans Google Merchant Center pour apparaître dans l&apos;onglet Shopping.</li>
              </ol>
              <p style={{ marginTop: 10 }}>
                <a className="btn" href={`/admin/produits?site=${String(run.result?.site_id ?? "")}`}>
                  Voir les produits
                </a>{" "}
                {typeof window !== "undefined" && window.location.hostname.endsWith("localhost") && (
                  <a className="btn quiet" href={`http://${String(run.result?.site_id ?? "")}.localhost:${window.location.port}`} target="_blank" rel="noopener noreferrer">
                    Aperçu de la boutique
                  </a>
                )}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
