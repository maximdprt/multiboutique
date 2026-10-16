// Copie les boutiques, produits et guides du mode démo dans votre base Supabase,
// pour démarrer avec un exemple que vous modifiez ensuite depuis l'admin.
// Les commandes fictives ne sont PAS copiées.
//
// Utilisation : SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:supabase
// (ou renseignez-les dans un fichier .env.local, lu automatiquement)
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Il manque SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const file = path.join(process.cwd(), ".data", "demo-db.json");
if (!fs.existsSync(file)) {
  console.error("Lancez d'abord le site une fois en mode démo (npm run dev, puis ouvrez une page) pour générer .data/demo-db.json.");
  process.exit(1);
}
const demo = JSON.parse(fs.readFileSync(file, "utf8"));
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

for (const [table, rows] of [
  ["sites", demo.sites],
  ["products", demo.products],
  ["guides", demo.guides],
]) {
  const { error } = await sb.from(table).upsert(rows);
  if (error) {
    console.error(`Erreur sur ${table} :`, error.message);
    process.exit(1);
  }
  console.log(`${table} : ${rows.length} ligne(s) copiée(s)`);
}
console.log("Terminé. Pensez à changer les domaines et les informations légales dans l'admin.");
