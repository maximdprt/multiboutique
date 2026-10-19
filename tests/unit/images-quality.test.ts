import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { DUPLICATE_DISTANCE, analyzeImage, hashDistance, judge, processImage } from "@/lib/images/quality";

/** Photo « produit » de test : un objet contrasté au centre d'un fond uni. */
async function productShot(w: number, h: number, bg = "#ffffff") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="${bg}"/>
    <g transform="translate(${w / 2 - Math.min(w, h) * 0.3},${h / 2 - Math.min(w, h) * 0.3})">
      ${Array.from({ length: 12 }, (_, i) => `<rect x="${i * Math.min(w, h) * 0.05}" y="0" width="${Math.min(w, h) * 0.025}" height="${Math.min(w, h) * 0.6}" fill="${i % 2 ? "#1d3557" : "#e63946"}"/>`).join("")}
      <circle cx="${Math.min(w, h) * 0.3}" cy="${Math.min(w, h) * 0.3}" r="${Math.min(w, h) * 0.12}" fill="#2a9d8f"/>
    </g></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

describe("agent Images : qualité", () => {
  it("note bien une photo nette, grande, carrée, sur fond blanc", async () => {
    const info = await analyzeImage(await productShot(1400, 1400));
    expect(info).toMatchObject({ width: 1400, height: 1400, lightBorder: true });
    expect(info.borderUniformity).toBeGreaterThan(0.95);
    const v = judge(info);
    expect(v.ok).toBe(true);
    expect(v.score).toBeGreaterThanOrEqual(85);
  });

  it("repère le flou", async () => {
    const shot = await productShot(1400, 1400);
    const blurred = await sharp(shot).blur(12).toBuffer();
    const [a, b] = await Promise.all([analyzeImage(shot), analyzeImage(blurred)]);
    expect(b.sharpness).toBeLessThan(a.sharpness / 5);
    expect(judge(b).score).toBeLessThan(judge(a).score);
  });

  it("refuse une image trop petite ou trop allongée, avec le motif", async () => {
    const small = judge(await analyzeImage(await productShot(400, 400)));
    expect(small.ok).toBe(false);
    expect(small.reasons[0]).toContain("trop petite");
    const banner = judge(await analyzeImage(await productShot(2400, 600)));
    expect(banner.reasons).toContain("format trop allongé (bannière ou capture)");
  });

  it("reconnaît un doublon redimensionné ou recompressé, pas une autre image", async () => {
    const shot = await productShot(1400, 1400);
    const copy = await sharp(shot).resize(700, 700).jpeg({ quality: 60 }).toBuffer();
    const other = await productShot(1400, 1400, "#f2d0a9");
    // une vraie autre photo (le miroir de cette mire presque symétrique serait, lui, quasi identique)
    const flipped = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1400"><rect width="100%" height="100%" fill="#fff"/><circle cx="700" cy="700" r="420" fill="#264653"/><circle cx="700" cy="700" r="200" fill="#e9c46a"/></svg>`)).jpeg().toBuffer();
    const [a, b, c, d] = await Promise.all([shot, copy, other, flipped].map(analyzeImage));
    expect(hashDistance(a.hash, b.hash)).toBeLessThanOrEqual(DUPLICATE_DISTANCE);
    expect(hashDistance(a.hash, d.hash)).toBeGreaterThan(DUPLICATE_DISTANCE);
    expect(c.lightBorder).toBe(false);
  });

  it("met au carré sans déformer, agrandit à 1200 px et convertit en WebP", async () => {
    const buf = await productShot(800, 600);
    const info = await analyzeImage(buf);
    const out = await processImage(buf, info);
    expect(out.notes).toEqual(["agrandie", "mise au carré"]);
    expect(out.width).toBe(out.height);
    expect(out.width).toBeGreaterThanOrEqual(1200);
    const meta = await sharp(out.data).metadata();
    expect(meta.format).toBe("webp");
    // le fond ajouté reprend la couleur du bord : les coins restent blancs
    const corner = await sharp(out.data).extract({ left: 0, top: 0, width: 4, height: 4 }).removeAlpha().raw().toBuffer();
    expect(Math.min(...corner)).toBeGreaterThan(240);
  });

  it("ne met pas au carré une photo d'ambiance (fond chargé) : elle garde son cadrage", async () => {
    // scène : sol, mur, meubles et plante qui touchent les bords de l'image
    const scene = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200">
      <rect width="1600" height="700" fill="#c9b79c"/><rect y="700" width="1600" height="500" fill="#6b4f3a"/>
      <rect x="-40" y="300" width="420" height="900" fill="#2f3e46"/><rect x="1250" y="150" width="400" height="1100" fill="#84a98c"/>
      <circle cx="800" cy="1150" r="260" fill="#e9c46a"/><rect x="600" y="0" width="90" height="420" fill="#264653"/></svg>`;
    const noisy = await sharp(Buffer.from(scene)).jpeg({ quality: 90 }).toBuffer();
    const info = await analyzeImage(noisy);
    const out = await processImage(noisy, info);
    expect(out.notes).not.toContain("mise au carré");
    expect([out.width, out.height]).toEqual([1600, 1200]);
  });
});
