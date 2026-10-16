// Données structurées schema.org (JSON-LD) : c'est ce que Google et les moteurs IA
// lisent pour comprendre un produit (prix, stock, livraison, retours), un guide ou une FAQ.
import type { Guide, Product, QA, Site } from "./types";
import { siteUrl } from "./sites";
import { plainText, truncate } from "./richtext";

export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      // échappement de "<" pour qu'aucun texte ne puisse fermer la balise script
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

const abs = (site: Site, src: string) => (src.startsWith("/") ? siteUrl(site, src) : src);
const price = (cents: number) => (cents / 100).toFixed(2);

export function organizationLd(site: Site) {
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": siteUrl(site, "/#organisation"),
    name: site.name,
    url: siteUrl(site),
    description: site.description,
    email: site.legal.email,
    ...(site.legal.phone ? { telephone: site.legal.phone } : {}),
    hasMerchantReturnPolicy: returnPolicy(site),
  };
}

export function websiteLd(site: Site) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: siteUrl(site),
    inLanguage: "fr-FR",
    publisher: { "@id": siteUrl(site, "/#organisation") },
  };
}

function returnPolicy(site: Site) {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: site.shipping.countries,
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: site.return_days,
    returnMethod: "https://schema.org/ReturnByMail",
  };
}

function deliveryDays(delay: string): [number, number] {
  const nums = (delay.match(/\d+/g) ?? []).map(Number);
  if (!nums.length) return [3, 7];
  return [nums[0], nums[nums.length - 1]];
}

export function productLd(site: Site, p: Product) {
  const url = siteUrl(site, `/produits/${p.slug}`);
  const [minD, maxD] = deliveryDays(site.shipping.delay);
  const free = site.shipping.free_from_cents > 0 && p.price_cents >= site.shipping.free_from_cents;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: truncate(plainText(p.description), 500),
    image: p.images.map((i) => abs(site, i)),
    sku: p.sku || undefined,
    ...(p.gtin ? { gtin: p.gtin } : {}),
    brand: { "@type": "Brand", name: p.brand || site.name },
    category: p.category || undefined,
    additionalProperty: p.specs.map((s) => ({ "@type": "PropertyValue", name: s.label, value: s.value })),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "EUR",
      price: price(p.price_cents),
      availability: p.stock === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": siteUrl(site, "/#organisation") },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: free ? "0.00" : price(site.shipping.flat_cents), currency: "EUR" },
        shippingDestination: site.shipping.countries.map((c) => ({ "@type": "DefinedRegion", addressCountry: c })),
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
          transitTime: { "@type": "QuantitativeValue", minValue: minD, maxValue: maxD, unitCode: "DAY" },
        },
      },
      hasMerchantReturnPolicy: returnPolicy(site),
    },
  };
}

export function faqLd(items: QA[]) {
  if (!items.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export function breadcrumbLd(site: Site, trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: siteUrl(site, t.path) })),
  };
}

export function articleLd(site: Site, g: Guide) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.title,
    description: g.seo_description || g.excerpt,
    datePublished: g.published_at,
    dateModified: g.updated_at,
    inLanguage: "fr-FR",
    mainEntityOfPage: siteUrl(site, `/guides/${g.slug}`),
    author: { "@type": "Organization", name: site.name, url: siteUrl(site) },
    publisher: { "@id": siteUrl(site, "/#organisation") },
  };
}
