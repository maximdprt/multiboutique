import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { listMigrations, pendingMigrations } from "../../scripts/migrations.mjs";

const normalize = (s: string) => s.replace(/\r\n/g, "\n").trim();

describe("migrations", () => {
  const all = listMigrations();

  it("sont numérotées sans trou ni doublon", () => {
    expect(all.length).toBeGreaterThanOrEqual(3);
    all.forEach((m, i) => expect(m.version.slice(0, 3)).toBe(String(i + 1).padStart(3, "0")));
  });

  it("calcule celles qui restent à appliquer, dans l'ordre", () => {
    expect(pendingMigrations(all, []).map((m) => m.version)).toEqual(all.map((m) => m.version));
    expect(pendingMigrations(all, [all[0].version]).map((m) => m.version)).toEqual(all.slice(1).map((m) => m.version));
    expect(pendingMigrations(all, all.map((m) => m.version))).toEqual([]);
  });

  it("se retrouvent toutes dans schema.sql, qui les marque comme appliquées", () => {
    const schema = normalize(fs.readFileSync("supabase/schema.sql", "utf8"));
    for (const m of all) {
      expect(schema, `${m.version} doit être recopiée dans schema.sql`).toContain(normalize(fs.readFileSync(m.file, "utf8")));
      expect(schema, `${m.version} doit être inscrite dans schema_migrations`).toContain(`('${m.version}')`);
    }
  });
});
