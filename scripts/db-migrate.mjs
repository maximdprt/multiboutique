// Applique les migrations de supabase/migrations/ qui ne l'ont pas encore été.
// Chaque migration appliquée est notée dans la table schema_migrations.
//
// Utilisation : npm run db:migrate            (applique ce qui manque)
//               npm run db:migrate -- --liste (affiche l'état sans rien changer)
//
// Il faut SUPABASE_DB_URL (dans .env.local ou l'environnement) :
// Supabase > Connect > "Session pooler", chaîne qui commence par postgresql://
// (remplacez [YOUR-PASSWORD] par le mot de passe de la base).
import fs from "node:fs";
import pg from "pg";
import { loadEnvFiles } from "./load-env.mjs";
import { listMigrations, pendingMigrations } from "./migrations.mjs";

loadEnvFiles();

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Il manque SUPABASE_DB_URL : Supabase > Connect > « Session pooler », copiez la chaîne postgresql://… dans .env.local.");
  process.exit(1);
}
const listOnly = process.argv.includes("--liste");

// Supabase impose une connexion chiffrée, avec un certificat signé par sa propre autorité :
// on chiffre sans vérifier l'autorité (sauf base locale, qui n'a pas de chiffrement).
const conn = new URL(url);
const local = ["localhost", "127.0.0.1"].includes(conn.hostname);
conn.searchParams.delete("sslmode");
const client = new pg.Client({ connectionString: conn.toString(), ssl: local ? false : { rejectUnauthorized: false } });

try {
  await client.connect();
} catch (e) {
  console.error(`Connexion à la base impossible : ${e.message}`);
  console.error("Vérifiez SUPABASE_DB_URL (mot de passe, et chaîne « Session pooler » plutôt que « Direct connection »).");
  process.exit(1);
}

let failed = false;
try {
  // Empêche deux exécutions simultanées (par exemple CI et poste local).
  await client.query("select pg_advisory_lock(hashtext('multiboutique:db:migrate'))");
  await client.query(`create table if not exists schema_migrations (
    version    text primary key,
    applied_at timestamptz not null default now()
  )`);
  await client.query("alter table schema_migrations enable row level security");

  const applied = (await client.query("select version from schema_migrations")).rows.map((r) => r.version);
  const all = listMigrations();
  const todo = pendingMigrations(all, applied);

  for (const m of all) console.log(`${applied.includes(m.version) ? "✓ appliquée " : "· à appliquer"}  ${m.version}`);
  if (listOnly) {
    console.log(todo.length ? `\n${todo.length} migration(s) à appliquer.` : "\nLa base est à jour.");
  } else if (!todo.length) {
    console.log("\nLa base est à jour : rien à faire.");
  } else {
    for (const m of todo) {
      process.stdout.write(`\nApplication de ${m.version}… `);
      await client.query("begin");
      try {
        await client.query(fs.readFileSync(m.file, "utf8"));
        await client.query("insert into schema_migrations (version) values ($1)", [m.version]);
        await client.query("commit");
        console.log("ok");
      } catch (e) {
        await client.query("rollback");
        console.log("échec");
        throw new Error(`${m.version} : ${e.message} (rien n'a été modifié pour cette migration)`);
      }
    }
    console.log(`\n${todo.length} migration(s) appliquée(s).`);
  }
} catch (e) {
  failed = true;
  console.error(`\nErreur : ${e.message}`);
} finally {
  await client.end();
}
process.exit(failed ? 1 : 0);
