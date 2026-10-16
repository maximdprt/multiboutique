# Décisions

Les choix techniques faits en cours de route, avec leur raison. Le plus récent en haut.

## Phase 0 (16 octobre 2026)

**Migrations : script maison avec `pg`, pas la CLI Supabase.**
La CLI Supabase demande Docker et une connexion au compte ; un petit script (`scripts/db-migrate.mjs`) suffit : il lit `supabase/migrations/NNN_nom.sql`, applique dans l'ordre ce qui manque, chaque fichier dans une transaction, et le note dans `schema_migrations`. Un verrou (`pg_advisory_lock`) empêche deux exécutions simultanées. `schema.sql` reste le fichier complet pour une installation neuve et marque toutes les migrations comme appliquées ; un test vérifie qu'il contient bien chaque migration.

**Connexion à Postgres : « Session pooler » de Supabase, chiffrée sans vérification de l'autorité.**
La connexion directe de Supabase n'est joignable qu'en IPv6, ce que GitHub Actions et beaucoup de box ne gèrent pas : on recommande la chaîne « Session pooler ». Supabase signe ses certificats avec sa propre autorité, absente de Node : la connexion est chiffrée (`ssl: { rejectUnauthorized: false }`) mais l'autorité n'est pas vérifiée. Risque jugé acceptable pour un script lancé à la main ; à revoir si on automatise les migrations.

**Les trois premières migrations sont rejouables.**
Elles reprennent le SQL existant, déjà écrit avec `if not exists` / `create or replace`. Une base installée avant la phase 0 (sans `schema_migrations`) peut donc lancer `npm run db:migrate` sans risque : les trois migrations repassent sans rien changer, puis sont notées.

**Variables d'environnement : `lib/env.ts` avec zod, sans jamais bloquer le démarrage.**
Chaque variable a un format vérifié (préfixes `sk_test_`, `whsec_`, `re_`, `sk-ant-`, longueur minimale des secrets…) et les obligations dépendent du contexte (ex. `ADMIN_PASSWORD` obligatoire dès que Supabase est configuré, `CRON_SECRET` sur Vercel). Une variable vide compte comme absente. Les problèmes sont affichés dans **Réglages > État des services** et dans les journaux au démarrage (`instrumentation.ts`), mais le site démarre toujours : le mode démo doit fonctionner sans aucune clé. Le code existant lit encore `process.env` directement ; on migrera vers `lib/env.ts` au fil des phases, sans tout réécrire d'un coup.

**Page « État des services » : aucun secret, même partiel.**
Ni valeur, ni début de clé : seulement « configuré ou non », le mode (test ou réel pour Stripe), et la marche à suivre. Un test unitaire vérifie qu'aucune valeur secrète n'apparaît. La page fait aussi deux vérifications en direct : la base répond-elle, et quand chaque tâche planifiée a-t-elle tourné pour la dernière fois.

**Tests : Vitest (calculs) et Playwright (parcours), le tout en mode démo.**
Les modules testés importent `server-only` et la base : dans Vitest, `server-only` est remplacé par un fichier vide et la base par une version en mémoire (`vi.mock`). Pour Playwright, le serveur de test démarre sur le port 3100 avec une base de démo neuve (`.data/e2e-db.json`) et **toutes les clés vidées** : Next.js ne remplace jamais une variable déjà définie, même vide, donc un `.env.local` rempli n'est pas utilisé et les tests ne touchent jamais aux vrais services. Les boutiques sont jointes par `bocal.localhost:3100` (Chromium envoie `*.localhost` vers la machine locale).

**Vitest 5, donc Node 22.12 ou plus.**
Node 20 n'est plus maintenu depuis avril 2026. `package.json` indique `"engines": { "node": ">=22.12" }`, la CI utilise Node 22.

**ESLint 9 avec la configuration Next.js (`next/core-web-vitals` + `next/typescript`), via `eslint .`.**
`next lint` est déprécié depuis Next 15.5. ESLint 10 n'est pas encore pris en charge par `eslint-config-next` 15.

**Règle `no-html-link-for-pages` désactivée : les liens restent des `<a>`.**
La mesure d'audience compte une page vue au chargement de la page (`PageviewTracker` dans `app/[host]/layout.tsx`). Avec `<Link>`, la navigation se ferait sans recharger la page et les pages vues suivantes ne seraient plus comptées. Passer à `<Link>` demandera d'abord de compter les pages vues à chaque changement d'adresse (phase 9, performance).

**Alertes `npm audit` connues.**
Deux alertes concernent des outils utilisés seulement pendant le développement ou la compilation (`braces` via `eslint-config-next`, `postcss` via Next.js) ; la seule correction proposée est un changement de version majeure (Next 16), à étudier séparément. Rien n'est exposé aux visiteurs.
