// Agent Images : mesure de la qualité d'une image et traitement pour la boutique.
// Tout est calculé sur l'image elle-même (aucun service payant) avec sharp.
//
// Qualité, de 0 à 100 :
//   - résolution (40 points) : 1200 px ou plus sur le petit côté = parfait, moins de 500 px = refusée ;
//   - netteté (25 points) : variance du laplacien sur l'image réduite (une image floue a peu de contours nets) ;
//   - cadrage (15 points) : proche du carré, le format des grilles produits ;
//   - fond (20 points) : bords unis (fond blanc ou studio), idéal pour la photo principale.
import sharp from "sharp";

export type ImageInfo = {
  width: number;
  height: number;
  format: string;
  bytes: number;
  /** Variance du laplacien (plus c'est haut, plus c'est net) */
  sharpness: number;
  /** Part des pixels du bord proches de leur couleur moyenne (0 à 1) */
  borderUniformity: number;
  /** Couleur moyenne du bord, pour agrandir le fond sans couture */
  borderColor: { r: number; g: number; b: number };
  /** Bord clair (fond blanc ou presque) */
  lightBorder: boolean;
  /** Empreinte visuelle 256 bits (dHash 16×16), en hexadécimal */
  hash: string;
};

export type Verdict = { ok: boolean; score: number; reasons: string[] };

export const MIN_SIDE = 500;
const TARGET_SIDE = 1200;
const MAX_SIDE = 2000;

/** Analyse une image (dimensions après rotation EXIF, netteté, fond, empreinte). */
export async function analyzeImage(buf: Buffer): Promise<ImageInfo> {
  const base = sharp(buf, { failOn: "none", limitInputPixels: 80_000_000 }).rotate();
  const meta = await sharp(buf, { failOn: "none" }).metadata();
  const swap = (meta.orientation ?? 1) >= 5;
  const width = (swap ? meta.height : meta.width) ?? 0;
  const height = (swap ? meta.width : meta.height) ?? 0;

  // Netteté : laplacien 3×3 sur une version grise de 512 px
  const grey = await base.clone().resize(512, 512, { fit: "inside", withoutEnlargement: true }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const sharpness = laplacianVariance(grey.data, grey.info.width, grey.info.height);

  // Fond : bord d'une version 64×64 en couleurs, échantillonnée sans moyenne (sinon un décor chargé paraîtrait uni)
  const rgb = await base.clone().resize(64, 64, { fit: "fill", kernel: "nearest" }).removeAlpha().raw().toBuffer();
  const border = borderStats(rgb, 64, 64);

  // Empreinte : dHash 17×16 (256 bits), calculée sur une version 64×64 (les détails fins ne la font pas varier)
  const mid = await base.clone().resize(64, 64, { fit: "fill" }).greyscale().raw().toBuffer();
  const tiny = await sharp(mid, { raw: { width: 64, height: 64, channels: 1 } }).resize(17, 16, { fit: "fill" }).raw().toBuffer();
  return { width, height, format: meta.format ?? "", bytes: buf.length, sharpness, ...border, hash: dHash(tiny) };
}

export function laplacianVariance(px: Uint8Array | Buffer, w: number, h: number) {
  if (w < 3 || h < 3) return 0;
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = px[i - w] + px[i + w] + px[i - 1] + px[i + 1] - 4 * px[i];
      sum += v;
      sum2 += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return sum2 / n - mean * mean;
}

export function borderStats(rgb: Uint8Array | Buffer, w: number, h: number) {
  const pts: [number, number, number][] = [];
  for (let x = 0; x < w; x++) for (const y of [0, 1, h - 2, h - 1]) pts.push(px(rgb, w, x, y));
  for (let y = 2; y < h - 2; y++) for (const x of [0, 1, w - 2, w - 1]) pts.push(px(rgb, w, x, y));
  const avg = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => Math.round(v / pts.length));
  const close = pts.filter((p) => Math.abs(p[0] - avg[0]) + Math.abs(p[1] - avg[1]) + Math.abs(p[2] - avg[2]) < 36).length;
  return {
    borderUniformity: close / pts.length,
    borderColor: { r: avg[0], g: avg[1], b: avg[2] },
    lightBorder: avg[0] > 225 && avg[1] > 225 && avg[2] > 225,
  };
}

function px(rgb: Uint8Array | Buffer, w: number, x: number, y: number): [number, number, number] {
  const i = (y * w + x) * 3;
  return [rgb[i], rgb[i + 1], rgb[i + 2]];
}

/**
 * dHash : compare chaque pixel à son voisin de droite sur une image 17×16 en gris (256 bits).
 * Mesuré sur nos images de test : une même photo redimensionnée ou recompressée diffère de 0 à 2 bits,
 * deux photos différentes d'au moins 14 bits, une photo et son miroir d'environ 35.
 * (Une grille 8×8 confondait des photos différentes sur fond blanc.)
 */
export function dHash(grey17x16: Uint8Array | Buffer) {
  let bits = "";
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) bits += grey17x16[y * 17 + x] > grey17x16[y * 17 + x + 1] ? "1" : "0";
  return BigInt(`0b${bits}`).toString(16).padStart(64, "0");
}

/** Au-delà de cet écart (en bits), deux images sont considérées comme différentes. */
export const DUPLICATE_DISTANCE = 8;

/** Nombre de bits différents entre deux empreintes (0 = identiques, ≤ DUPLICATE_DISTANCE = même photo). */
export function hashDistance(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return 256;
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

/** Note de qualité et motifs de refus. */
export function judge(info: ImageInfo): Verdict {
  const reasons: string[] = [];
  const short = Math.min(info.width, info.height);
  const ratio = Math.max(info.width, info.height) / Math.max(1, short);
  if (short < MIN_SIDE) reasons.push(`trop petite (${info.width} × ${info.height} px, il faut ${MIN_SIDE} px au moins)`);
  if (info.sharpness < 25) reasons.push("floue");
  if (ratio > 3) reasons.push("format trop allongé (bannière ou capture)");

  const resolution = short >= TARGET_SIDE ? 40 : short >= 1000 ? 34 : short >= 800 ? 26 : short >= 600 ? 16 : short >= MIN_SIDE ? 8 : 0;
  const sharp = Math.round(Math.min(1, info.sharpness / 300) * 25);
  const framing = ratio <= 1.05 ? 15 : ratio <= 1.35 ? 11 : ratio <= 1.8 ? 6 : 0;
  const background = Math.round(info.borderUniformity * 20);
  return { ok: reasons.length === 0, score: Math.min(100, resolution + sharp + framing + background), reasons };
}

/** Bonne candidate pour la photo principale : nette, fond uni et clair. */
export function mainCandidateBonus(info: ImageInfo) {
  return (info.borderUniformity > 0.85 ? 10 : 0) + (info.lightBorder ? 8 : 0);
}

export type Processed = { data: Buffer; width: number; height: number; notes: string[] };

/**
 * Prépare l'image pour la boutique :
 *  - redressée selon l'orientation de l'appareil photo, métadonnées retirées ;
 *  - mise au carré si le fond est uni (en prolongeant ce fond : aucune déformation, aucun recadrage du produit) ;
 *  - agrandie à 1200 px si elle est plus petite (Lanczos + léger renforcement), réduite à 2000 px au plus ;
 *  - convertie en WebP (qualité 84).
 */
export async function processImage(buf: Buffer, info: ImageInfo): Promise<Processed> {
  const notes: string[] = [];
  let img = sharp(buf, { failOn: "none", limitInputPixels: 80_000_000 }).rotate();
  let w = info.width;
  let h = info.height;

  const short = Math.min(w, h);
  if (short < TARGET_SIDE) {
    const k = TARGET_SIDE / short;
    w = Math.round(w * k);
    h = Math.round(h * k);
    img = img.resize(w, h, { kernel: "lanczos3" }).sharpen({ sigma: 0.6 });
    notes.push("agrandie");
  } else if (Math.max(w, h) > MAX_SIDE) {
    const k = MAX_SIDE / Math.max(w, h);
    w = Math.round(w * k);
    h = Math.round(h * k);
    img = img.resize(w, h, { kernel: "lanczos3" });
    notes.push("réduite");
  }

  if (w !== h && info.borderUniformity > 0.8 && Math.max(w, h) / Math.min(w, h) <= 1.8) {
    const side = Math.min(MAX_SIDE, Math.max(w, h));
    const scaled = await img.resize(side, side, { fit: "inside" }).png().toBuffer({ resolveWithObject: true });
    const { width: sw, height: sh } = scaled.info;
    img = sharp(scaled.data).extend({
      top: Math.floor((side - sh) / 2),
      bottom: Math.ceil((side - sh) / 2),
      left: Math.floor((side - sw) / 2),
      right: Math.ceil((side - sw) / 2),
      background: { ...info.borderColor, alpha: 1 },
    });
    w = h = side;
    notes.push("mise au carré");
  }

  const out = await img.flatten({ background: info.borderColor }).webp({ quality: 84, effort: 5, smartSubsample: true }).toBuffer({ resolveWithObject: true });
  return { data: out.data, width: out.info.width, height: out.info.height, notes };
}
