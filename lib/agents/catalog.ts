import "server-only";
// Agent Catalogue : relie chaque produit de la boutique à un produit réel chez CJ Dropshipping
// (identifiant de variante pour la commande automatique, prix d'achat, adresse de la fiche),
// puis lance l'agent Images pour récupérer et mettre au propre ses photos.
// Sans CJ_API_KEY, il ne fait rien (les fiches restent à compléter à la main).
import { db } from "../db";
import { importProductImages } from "../images/agent";
import { cjProductUrl, hasCJ, searchProducts, variantsOf, type CJSearchItem } from "../suppliers/cj";
import type { Product } from "../types";

/** Taux de change utilisé pour estimer le prix d'achat (CJ facture en dollars). Réglable. */
export const eurPerUsd = () => Number(process.env.EUR_PER_USD || 0.92);

/**
 * Choisit le meilleur produit CJ : en stock, souvent référencé par d'autres vendeurs (preuve qu'il se vend),
 * et dont le coût laisse une marge (coût ≤ 40 % du prix de vente quand on connaît le prix).
 */
export function pickSupplierProduct(items: CJSearchItem[], priceCents?: number): CJSearchItem | null {
  const maxCostUsd = priceCents ? (priceCents / 100) * 0.4 / eurPerUsd() : Infinity;
  const ok = items.filter((i) => i.pid && i.image && i.sellPriceUsd > 0);
  const affordable = ok.filter((i) => i.sellPriceUsd <= maxCostUsd);
  const pool = affordable.length ? affordable : ok;
  const score = (i: CJSearchItem) => Math.log10(1 + i.listedNum) * 3 + (i.inventory > 0 ? 2 : 0) + Math.log10(1 + i.inventory);
  return [...pool].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Relie un produit à CJ (si ce n'est pas déjà fait) puis importe ses images. */
export async function sourceProduct(p: Product, keywordsEn: string, log: (s: string) => void) {
  if (!hasCJ()) return { linked: false, images: 0 };
  let linked = Boolean(p.supplier_variant_id);
  if (!linked && keywordsEn.trim()) {
    const items = await searchProducts(keywordsEn.trim(), 10).catch((e) => {
      log(`CJ, recherche « ${keywordsEn} » : ${(e as Error).message}`);
      return [];
    });
    const best = pickSupplierProduct(items, p.price_cents);
    if (best) {
      const variants = await variantsOf(best.pid).catch(() => []);
      const v = variants.find((x) => x.image) ?? variants[0];
      const costUsd = v?.priceUsd || best.sellPriceUsd;
      p = await db.saveProduct({
        id: p.id,
        site_id: p.site_id,
        supplier: "CJ Dropshipping",
        supplier_url: cjProductUrl(best.pid, best.name),
        supplier_variant_id: v?.vid ?? "",
        supplier_country: p.supplier_country || "CN",
        cost_cents: costUsd ? Math.round(costUsd * eurPerUsd() * 100) : p.cost_cents,
      });
      linked = Boolean(v?.vid);
      log(`« ${p.title} » relié à CJ : ${best.name} (coût estimé ${(costUsd * eurPerUsd()).toFixed(2)} €, ${best.listedNum} boutiques le vendent).`);
    } else log(`« ${p.title} » : aucun produit CJ convenable pour « ${keywordsEn} », à relier à la main.`);
  }
  const r = await importProductImages(p.id, { replace: true, log: () => {} }).catch((e) => {
    log(`« ${p.title} », images : ${(e as Error).message}`);
    return null;
  });
  if (r) log(`« ${p.title} » : ${r.message}`);
  return { linked, images: r?.imported.length ?? 0 };
}
