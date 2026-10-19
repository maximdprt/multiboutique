import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Media, Product } from "@/lib/types";
import { product } from "./fixtures";

const state = vi.hoisted(() => ({
  products: [] as Product[],
  media: [] as Media[],
  files: new Map<string, Buffer>(),
  images: new Map<string, Buffer>(),
  cj: { images: [] as string[], variantImage: null as string | null },
  hasCJ: true,
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/db", () => ({
  db: {
    kind: "demo",
    getProduct: async (id: string) => structuredClone(state.products.find((p) => p.id === id) ?? null),
    saveProduct: async (p: Partial<Product> & { id: string }) => {
      const cur = state.products.find((x) => x.id === p.id)!;
      Object.assign(cur, p);
      return structuredClone(cur);
    },
    listMedia: async (o: { productId?: string }) => structuredClone(state.media.filter((m) => !o.productId || m.product_id === o.productId).sort((a, b) => a.position - b.position)),
    saveMedia: async (m: Partial<Media>) => {
      const row = { id: `m${state.media.length + 1}`, created_at: "", ...m } as Media;
      state.media.push(row);
      return structuredClone(row);
    },
    deleteMedia: async (id: string) => void (state.media = state.media.filter((m) => m.id !== id)),
  },
}));
vi.mock("@/lib/storage", () => ({
  putFile: async (p: string, data: Buffer) => (state.files.set(p, data), { url: `/medias/${p}`, path: p }),
  removeFile: async (p: string) => void state.files.delete(p),
  isStored: (u: string) => u.startsWith("/medias/"),
}));
vi.mock("@/lib/suppliers/cj", () => ({
  hasCJ: () => state.hasCJ,
  productImages: async () => ({ pid: "P1", name: "Fountain", images: state.cj.images, variantImage: state.cj.variantImage }),
}));
vi.mock("@/lib/images/fetch", () => ({
  downloadImage: async (url: string) => {
    const data = state.images.get(url);
    if (!data) throw new Error("image introuvable (404)");
    return { data, contentType: "image/jpeg", url };
  },
}));

const { importProductImages, orderGallery } = await import("@/lib/images/agent");

/** Photo de test : bandes de couleur sur fond uni (seed = motif différent). */
async function shot(seed: number, w = 1400, h = 1400, bg = "#ffffff") {
  const s = Math.min(w, h);
  const bars = Array.from({ length: 10 }, (_, i) => `<rect x="${s * 0.2 + i * s * 0.06}" y="${s * (0.15 + ((i * seed) % 5) * 0.04)}" width="${s * 0.03}" height="${s * 0.5}" fill="${["#e63946", "#1d3557", "#2a9d8f", "#f4a261"][(i + seed) % 4]}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${bg}"/><g transform="translate(${(w - s) / 2},${(h - s) / 2})">${bars}</g></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

beforeEach(async () => {
  state.products = [product({ id: "p1", slug: "fontaine", title: "Fontaine 2,5 L", images: ["/demo/fontaine.svg"], supplier_variant_id: "V1" })];
  state.media = [];
  state.files.clear();
  state.images.clear();
  state.hasCJ = true;
  const [a, b, c, d] = await Promise.all([shot(1), shot(2, 1600, 1200), shot(3, 1400, 1400, "#e9e2d6"), shot(4)]);
  state.images.set("https://cj/variant.jpg", a);
  state.images.set("https://cj/a.jpg", await sharp(a).resize(900, 900).jpeg({ quality: 70 }).toBuffer()); // même photo, moins bonne
  state.images.set("https://cj/b.jpg", b);
  state.images.set("https://cj/c.jpg", c);
  state.images.set("https://cj/d.jpg", d);
  state.images.set("https://cj/flou.jpg", await sharp(await shot(5)).blur(25).toBuffer());
  state.images.set("https://cj/petite.jpg", await shot(6, 300, 300));
  state.images.set("/demo/fontaine.svg", await shot(7));
  state.cj = { images: ["https://cj/variant.jpg", "https://cj/a.jpg", "https://cj/b.jpg", "https://cj/c.jpg", "https://cj/d.jpg", "https://cj/flou.jpg", "https://cj/petite.jpg", "https://cj/absente.jpg"], variantImage: "https://cj/variant.jpg" };
});

describe("agent Images", () => {
  it("garde les bonnes images, écarte doublons, flou, trop petites et absentes, et les range chez nous", async () => {
    const r = await importProductImages("p1", { replace: true });
    const reasons = r.rejected.map((x) => x.reason).join(" | ");
    expect(reasons).toContain("doublon");
    expect(reasons).toContain("floue");
    expect(reasons).toContain("trop petite");
    expect(reasons).toContain("introuvable");
    expect(r.imported.length).toBe(5); // variante, b, c, d + illustration de démo
    // La photo de la variante vendue passe en premier
    expect(r.imported[0].source_url).toBe("https://cj/variant.jpg");
    expect(r.imported[0].alt).toBe("Fontaine 2,5 L");
    expect(r.imported[1].alt).toBe("Fontaine 2,5 L, vue 2");
    // Toutes stockées chez nous, en WebP, d'au moins 1200 px
    const p = state.products[0];
    expect(p.images).toEqual(r.imported.map((m) => m.url));
    expect(p.images.every((u) => u.startsWith("/medias/sites/"))).toBe(true);
    for (const m of r.imported) {
      expect((await sharp(state.files.get(m.path)!).metadata()).format).toBe("webp");
      expect(Math.min(m.width, m.height)).toBeGreaterThanOrEqual(1200);
    }
  });

  it("se relance sans doublon", async () => {
    await importProductImages("p1", { replace: true });
    const again = await importProductImages("p1");
    expect(again.imported).toEqual([]);
    expect(state.products[0].images).toHaveLength(5);
    expect(again.message).toContain("Aucune nouvelle image");
  });

  it("ajoute une image collée par adresse à la suite de la galerie", async () => {
    await importProductImages("p1", { replace: true });
    // une autre photo : un objet rond, pas les mêmes bandes
    const round = `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="2000"><rect width="100%" height="100%" fill="#fff"/><circle cx="1000" cy="1000" r="600" fill="#264653"/><circle cx="1000" cy="1000" r="300" fill="#e9c46a"/></svg>`;
    state.images.set("https://fabricant.example/photo.jpg", await sharp(Buffer.from(round)).jpeg().toBuffer());
    const r = await importProductImages("p1", { urls: ["https://fabricant.example/photo.jpg"] });
    expect(r.imported).toHaveLength(1);
    expect(r.imported[0]).toMatchObject({ source: "url", position: 5 });
    expect(state.products[0].images).toHaveLength(6);
  });

  it("explique quoi faire quand il n'y a aucune source", async () => {
    state.hasCJ = false;
    state.products[0].images = [];
    const r = await importProductImages("p1");
    expect(r.imported).toEqual([]);
    expect(r.message).toContain("collez des adresses d'images");
  });

  it("choisit comme photo principale une image nette sur fond uni plutôt qu'une photo d'ambiance", () => {
    const ambiance = { score: 80, info: { borderUniformity: 0.3, lightBorder: false } };
    const studio = { score: 72, info: { borderUniformity: 0.98, lightBorder: true } };
    expect(orderGallery([ambiance, studio])[0]).toBe(studio);
  });
});
