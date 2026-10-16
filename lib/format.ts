const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const eurRound = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eurCompact = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 });

export const money = (cents: number) => eur.format(cents / 100);
export const moneyRound = (cents: number) => eurRound.format(Math.round(cents / 100));
export const moneyCompact = (cents: number) => (Math.abs(cents) >= 1_000_000 ? eurCompact.format(cents / 100) : moneyRound(cents));

export const number = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
export const percent = (x: number, digits = 0) =>
  new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits }).format(x);

export const date = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
export const dateShort = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** "Bocaux en verre" -> "bocaux-en-verre" */
export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Convertit un montant saisi ("34,90" ou "34.90") en centimes. */
export function parseEuros(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const s = String(v).trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export const euros = (cents: number | null | undefined) => (cents == null ? "" : (cents / 100).toFixed(2).replace(".", ","));
