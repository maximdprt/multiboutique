import "server-only";
// CJ Dropshipping (API 2.0) : jeton d'accès, frais de port, création de commande, suivi.
// Doc : https://developers.cjdropshipping.com/en/api/api2/
import { db } from "../db";

const BASE = "https://developers.cjdropshipping.com/api2.0/v1";
export const hasCJ = () => Boolean(process.env.CJ_API_KEY);

type Token = { accessToken: string; accessTokenExpiryDate: string; refreshToken: string; refreshTokenExpiryDate: string };
type CJResponse<T> = { code: number; result: boolean; message: string; data: T };

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
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
