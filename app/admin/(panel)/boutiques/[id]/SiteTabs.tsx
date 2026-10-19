import { previewBase } from "@/lib/store-path";

const TABS = [
  { id: "apercu", name: "Aperçu", path: "/apercu" },
  { id: "reglages", name: "Réglages", path: "" },
  { id: "domaine", name: "Domaine", path: "/domaine" },
] as const;

/** Onglets de la fiche boutique. */
export function SiteTabs({ id, current }: { id: string; current: (typeof TABS)[number]["id"] }) {
  return (
    <section className="panel" style={{ marginBottom: 14 }}>
      <nav className="tabs" aria-label="Fiche boutique">
        {TABS.map((t) => (
          <a key={t.id} href={`/admin/boutiques/${id}${t.path}`} aria-current={t.id === current ? "page" : undefined}>
            {t.name}
          </a>
        ))}
      </nav>
    </section>
  );
}

/** Lien vers l'adresse d'aperçu de la boutique (fonctionne avant l'achat du domaine). */
export function PreviewLink({ id }: { id: string }) {
  return (
    <a className="btn quiet small" href={previewBase(id)} target="_blank" rel="noopener noreferrer" title="Adresse d'aperçu, non indexée par les moteurs">
      Voir l&apos;aperçu
    </a>
  );
}
