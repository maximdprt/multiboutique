export default function NotFound() {
  return (
    <div className="wrap">
      <section className="page-title" style={{ paddingBottom: 96 }}>
        <h1>Cette page n&apos;existe pas.</h1>
        <p>Le produit a peut-être été retiré, ou l&apos;adresse contient une faute de frappe.</p>
        <p style={{ marginTop: 28 }}>
          <a className="btn" href="/produits">
            Voir les produits
          </a>
        </p>
      </section>
    </div>
  );
}
