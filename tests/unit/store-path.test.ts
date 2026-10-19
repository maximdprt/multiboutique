import { describe, expect, it } from "vitest";
import { PREVIEW_PREFIX, parsePreviewPath, previewBase, previewIdOf, withBase } from "@/lib/store-path";

describe("adresse d'aperçu", () => {
  it("reconnaît /apercu/<id>/…", () => {
    expect(parsePreviewPath("/apercu/bocal")).toEqual({ id: "bocal", rest: "/" });
    expect(parsePreviewPath("/apercu/bocal/")).toEqual({ id: "bocal", rest: "/" });
    expect(parsePreviewPath("/apercu/bocal/produits/bocal-1l")).toEqual({ id: "bocal", rest: "/produits/bocal-1l" });
    expect(parsePreviewPath("/apercu/")).toBeNull();
    expect(parsePreviewPath("/apercus/bocal")).toBeNull();
    expect(parsePreviewPath("/produits")).toBeNull();
    expect(parsePreviewPath("/apercu/Bocal%20x")).toBeNull();
  });

  it("retrouve l'identifiant dans le segment [host]", () => {
    expect(previewIdOf(PREVIEW_PREFIX + "bocal")).toBe("bocal");
    expect(previewIdOf(encodeURIComponent(PREVIEW_PREFIX + "chat"))).toBe("chat");
    expect(previewIdOf("bocal-et-cie.fr")).toBeNull();
    expect(previewIdOf(PREVIEW_PREFIX)).toBeNull();
  });

  it("préfixe seulement les liens internes", () => {
    const base = previewBase("bocal");
    expect(withBase(base, "/")).toBe("/apercu/bocal");
    expect(withBase(base, "/produits")).toBe("/apercu/bocal/produits");
    expect(withBase(base, "/?utm_source=x")).toBe("/apercu/bocal?utm_source=x");
    expect(withBase(base, "#contenu")).toBe("#contenu");
    expect(withBase(base, "mailto:a@b.fr")).toBe("mailto:a@b.fr");
    expect(withBase(base, "https://exemple.fr/x")).toBe("https://exemple.fr/x");
    expect(withBase(base, "//exemple.fr/x")).toBe("//exemple.fr/x");
    expect(withBase("", "/produits")).toBe("/produits");
  });
});
