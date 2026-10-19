import "server-only";
// CJ Dropshipping (API 2.0) : jeton d'accès, frais de port, création de commande, suivi.
// Doc : https://developers.cjdropshipping.com/en/api/api2/
import { db } from "../db";

const BASE = "https://developers.cjdropshipping.com/api2.0/v1";
export const hasCJ = () => Boolean(process.env.CJ_API_KEY);

type Token = { accessToken: string; accessTokenExpiryDate: string; refreshToken: string; refreshTokenExpiryDate: string };
type CJResponse<T> = { code: number; result: boolean; message: string; data: T };

// Compte gratuit : 1 requête par seconde au plus (au-delà, CJ répond 429). On espace les appels.
let nextSlot = 0;
async function throttle() {
  const wait = nextSlot - Date.now();
  nextSlot = Math.max(Date.now(), nextSlot) + 1100;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  await throttle();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.token ? { "CJ-Access-Token": init.token } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => null)) as CJResponse<T> | null;
  if (!res.ok || !body || body.result === false || (body.code !== 200 && body.code !== undefined && body.code !== 0)) {
    throw new Error(`CJ : ${body?.message || `erreur ${res.status}`}`);
  }
  return body.data;
}

/** Jeton conservé en base : CJ limite la fréquence des demandes de jeton. */
async function token(): Promise<string> {
  const saved = await db.getSetting<Token>("cj_token");
  const now = Date.now();
  if (saved && Date.parse(saved.accessTokenExpiryDate) - now > 3600_000) return saved.accessToken;
  let fresh: Token;
  if (saved && Date.parse(saved.refreshTokenExpiryDate) > now) {
    fresh = await call<Token>("/authentication/refreshAccessToken", { method: "POST", body: JSON.stringify({ refreshToken: saved.refreshToken }) });
  } else {
    fresh = await call<Token>("/authentication/getAccessToken", { method: "POST", body: JSON.stringify({ apiKey: process.env.CJ_API_KEY }) });
  }
  await db.setSetting("cj_token", fresh);
  return fresh.accessToken;
}

export type CJAddress = {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  zip: string;
  city: string;
  province: string;
  country: string; // code ISO à 2 lettres
  countryName: string;
};

/** Mode de livraison le moins cher qui livre en moins de `maxDays` jours (sinon le plus rapide). */
export async function cheapestLogistic(from: string, to: string, products: { vid: string; quantity: number }[], maxDays = 12) {
  const tk = await token();
  const options = await call<{ logisticName: string; logisticPrice: number; logisticAging: string }[]>("/logistic/freightCalculate", {
    method: "POST",
    token: tk,
    body: JSON.stringify({ startCountryCode: from, endCountryCode: to, products }),
  });
  if (!options?.length) throw new Error(`CJ : aucun transporteur de ${from} vers ${to}`);
  const days = (aging: string) => Math.max(...(aging.match(/\d+/g) ?? ["99"]).map(Number));
  const ok = options.filter((o) => days(o.logisticAging) <= maxDays).sort((a, b) => a.logisticPrice - b.logisticPrice);
  return ok[0] ?? [...options].sort((a, b) => days(a.logisticAging) - days(b.logisticAging))[0];
}

export async function createOrder(opts: {
  orderNumber: string;
  address: CJAddress;
  from: string;
  products: { vid: string; quantity: number }[];
  payByBalance: boolean;
}) {
  const logistic = await cheapestLogistic(opts.from, opts.address.country, opts.products);
  const tk = await token();
  const data = await call<{ orderId: string; orderStatus?: string; actualPayment?: number }>("/shopping/order/createOrderV2", {
    method: "POST",
    token: tk,
    headers: { platformToken: "" },
    body: JSON.stringify({
      orderNumber: opts.orderNumber,
      shippingCountryCode: opts.address.country,
      shippingCountry: opts.address.countryName,
      shippingProvince: opts.address.province || opts.address.city,
      shippingCity: opts.address.city,
      shippingAddress: opts.address.line1,
      shippingAddress2: opts.address.line2 ?? "",
      shippingCustomerName: opts.address.name,
      shippingZip: opts.address.zip,
      shippingPhone: opts.address.phone,
      logisticName: logistic.logisticName,
      fromCountryCode: opts.from,
      // 2 = payée tout de suite avec le solde CJ ; 3 = créée seulement (à payer dans CJ)
      payType: opts.payByBalance ? 2 : 3,
      products: opts.products,
    }),
  });
  return { orderId: data.orderId, status: data.orderStatus ?? "", logistic: logistic.logisticName };
}

export async function orderDetail(orderId: string) {
  const tk = await token();
  return call<{ orderStatus: string; trackNumber: string | null; trackingUrl?: string | null; logisticName?: string }>(
    `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(orderId)}`,
    { method: "GET", token: tk },
  );
}

// ---------- Fiches produits (images, variantes) ----------

/** Identifiant produit CJ (pid) dans une adresse du type https://cjdropshipping.com/product/nom-p-1234ABCD-….html */
export function pidFromUrl(url: string) {
  const m = /-p-([0-9A-Za-z-]{8,})\.html/.exec(url) ?? /[?&]pid=([0-9A-Za-z-]{8,})/.exec(url);
  return m ? m[1] : null;
}

/** Liste d'images CJ : tableau, texte JSON ou texte séparé par des virgules selon les réponses. */
export function imageList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string" && /^https?:\/\//.test(x));
  if (typeof v !== "string" || !v.trim()) return [];
  const t = v.trim();
  if (t.startsWith("[")) {
    try {
      return imageList(JSON.parse(t));
    } catch {
      // texte mal formé : on tente le découpage simple
    }
  }
  return t.split(/[,\s]+/).filter((x) => /^https?:\/\//.test(x));
}

type CJVariant = { vid: string; pid?: string; variantImage?: string; variantSku?: string; variantNameEn?: string };
// GET /product/query : la photo principale est « bigImage » ; « productImageSet » est la galerie (tableau d'adresses)
type CJProduct = { pid: string; productNameEn?: string; bigImage?: string; productImageSet?: unknown; variants?: CJVariant[]; description?: string };

/** Images d'un produit CJ (par variante ou par adresse) : photo de la variante d'abord, puis la galerie du produit. */
export async function productImages(opts: { vid?: string; url?: string }) {
  const tk = await token();
  let pid = opts.url ? pidFromUrl(opts.url) : null;
  let variant: CJVariant | null = null;
  if (opts.vid) {
    variant = await call<CJVariant>(`/product/variant/queryByVid?vid=${encodeURIComponent(opts.vid)}`, { method: "GET", token: tk }).catch(() => null);
    pid ??= variant?.pid ?? null;
  }
  if (!pid) throw new Error("produit introuvable chez CJ : vérifiez l'identifiant de variante (vid) ou l'adresse du produit");
  const p = await call<CJProduct>(`/product/query?pid=${encodeURIComponent(pid)}`, { method: "GET", token: tk });
  variant ??= p.variants?.find((v) => v.vid === opts.vid) ?? null;
  const variantImage = variant?.variantImage && /^https?:\/\//.test(variant.variantImage) ? variant.variantImage : null;
  const gallery = [...new Set([...(variantImage ? [variantImage] : []), ...imageList(p.bigImage), ...imageList(p.productImageSet)])];
  // Les images de la description portent souvent du texte publicitaire (parfois en chinois) :
  // seulement si la galerie est trop pauvre
  const fromDescription = [...(p.description ?? "").matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]).filter((u) => /^https?:\/\//.test(u));
  const images = gallery.length >= 3 ? gallery : [...new Set([...gallery, ...fromDescription])];
  return { pid, name: p.productNameEn ?? "", images, variantImage };
}

// ---------- Recherche dans le catalogue CJ (agent Catalogue) ----------

export type CJSearchItem = { pid: string; name: string; image: string; sellPriceUsd: number; listedNum: number; inventory: number; category: string };

/** GET /product/listV2 : produits correspondant à des mots-clés anglais, les plus vendus en premier. */
export async function searchProducts(keyWord: string, size = 10): Promise<CJSearchItem[]> {
  const tk = await token();
  const q = new URLSearchParams({ keyWord, page: "1", size: String(size), orderBy: "1", sort: "desc", countryCode: "FR" });
  type Raw = { id: string; nameEn?: string; bigImage?: string; sellPrice?: string | number; nowPrice?: string | number; listedNum?: number; warehouseInventoryNum?: number; threeCategoryName?: string };
  const data = await call<{ content?: { productList?: Raw[] }[] }>(`/product/listV2?${q}`, { method: "GET", token: tk });
  const list = (data.content ?? []).flatMap((c) => c.productList ?? []);
  return list.map((r) => ({
    pid: r.id,
    name: r.nameEn ?? "",
    image: r.bigImage ?? "",
    sellPriceUsd: Number(String(r.nowPrice ?? r.sellPrice ?? "0").split(/[-~]/)[0]) || 0,
    listedNum: r.listedNum ?? 0,
    inventory: r.warehouseInventoryNum ?? 0,
    category: r.threeCategoryName ?? "",
  }));
}

export type CJVariantInfo = { vid: string; name: string; image: string; priceUsd: number; sku: string };

/** GET /product/variant/query?pid= : variantes d'un produit (identifiant vid, prix d'achat en dollars). */
export async function variantsOf(pid: string): Promise<CJVariantInfo[]> {
  const tk = await token();
  type Raw = { vid: string; variantNameEn?: string; variantImage?: string; variantSellPrice?: number | string; variantSku?: string };
  const list = await call<Raw[]>(`/product/variant/query?pid=${encodeURIComponent(pid)}`, { method: "GET", token: tk });
  return (list ?? []).map((v) => ({ vid: v.vid, name: v.variantNameEn ?? "", image: v.variantImage ?? "", priceUsd: Number(v.variantSellPrice) || 0, sku: v.variantSku ?? "" }));
}

/** Adresse publique d'un produit CJ (reconnue ensuite par pidFromUrl). */
export const cjProductUrl = (pid: string, name = "produit") =>
  `https://cjdropshipping.com/product/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "produit"}-p-${pid}.html`;
