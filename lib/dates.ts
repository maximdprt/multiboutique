// Dates "calendaires" dans le fuseau de l'admin (Paris par défaut).
export const TZ = process.env.ADMIN_TIMEZONE || "Europe/Paris";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** "2026-10-13" dans le fuseau de l'admin. */
export const dayKeyOf = (d: Date | string | number) => dayFmt.format(new Date(d));
