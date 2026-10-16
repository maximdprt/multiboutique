import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { parseBlocks, plainText, RichText, truncate } from "@/lib/richtext";

describe("parseBlocks", () => {
  it("reconnaît titres, paragraphes et listes", () => {
    const src = "## Comment choisir ?\nUn bon bocal ferme bien.\nIl se lave facilement.\n\n### Les tailles\n- 0,5 L\n- 1 L\n\nFin.";
    expect(parseBlocks(src)).toEqual([
      { type: "h2", text: "Comment choisir ?" },
      { type: "p", text: "Un bon bocal ferme bien.\nIl se lave facilement." },
      { type: "h3", text: "Les tailles" },
      { type: "ul", items: ["0,5 L", "1 L"] },
      { type: "p", text: "Fin." },
    ]);
  });

  it("sépare un paragraphe et la liste qui le suit sans ligne vide", () => {
    expect(parseBlocks("Avantages :\n* solide\n* léger\nEt voilà")).toEqual([
      { type: "p", text: "Avantages :" },
      { type: "ul", items: ["solide", "léger"] },
      { type: "p", text: "Et voilà" },
    ]);
  });

  it("accepte les fins de ligne Windows et ignore les lignes vides en trop", () => {
    expect(parseBlocks("Un\r\n\r\n\r\n\r\nDeux")).toEqual([
      { type: "p", text: "Un" },
      { type: "p", text: "Deux" },
    ]);
  });
});

describe("RichText", () => {
  it("affiche le gras et les liens internes", () => {
    const html = renderToStaticMarkup(<RichText source="Voir **ce bocal** [ici](/produits/bocal)." />);
    expect(html).toContain("<strong>ce bocal</strong>");
    expect(html).toContain('<a href="/produits/bocal">ici</a>');
  });

  it("neutralise les liens dangereux et n'interprète aucun HTML", () => {
    const html = renderToStaticMarkup(<RichText source={'[clic](javascript:alert(1)) <script>alert(1)</script>'} />);
    expect(html).toContain('<a href="#">clic</a>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("ajoute rel=noopener aux liens externes", () => {
    expect(renderToStaticMarkup(<RichText source="[site](https://exemple.fr)" />)).toContain('rel="noopener"');
  });
});

describe("plainText et truncate", () => {
  it("retire la mise en forme", () => {
    expect(plainText("## Titre\n\n**Gras** et [lien](/x)\n- point")).toBe("Titre\nGras et lien\n• point");
  });

  it("coupe proprement sur un mot", () => {
    expect(truncate("un deux trois quatre", 12)).toBe("un deux…");
    expect(truncate("  court   texte ", 50)).toBe("court texte");
  });
});
