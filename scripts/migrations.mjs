// Liste des migrations (supabase/migrations/NNN_nom.sql), dans l'ordre de leur numéro.
import fs from "node:fs";
import path from "node:path";

export const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

/** [{ version: "001_base", file: "/…/001_base.sql" }, …] */
export function listMigrations(dir = MIGRATIONS_DIR) {
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{3}_[a-z0-9_]+\.sql$/.test(f))
    .sort()
    .map((f) => ({ version: f.replace(/\.sql$/, ""), file: path.join(dir, f) }));
}

/** Migrations pas encore appliquées, dans l'ordre. */
export function pendingMigrations(all, applied) {
  const done = new Set(applied);
  return all.filter((m) => !done.has(m.version));
}
