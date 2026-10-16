# Avancement

À lire au début de chaque phase, à mettre à jour à la fin. Les prompts de chaque phase sont dans `docs/PROMPT-CURSOR.md`, les choix techniques dans `docs/DECISIONS.md`, le fonctionnement général dans `docs/ARCHITECTURE.md`.

Dernière mise à jour : 16 octobre 2026, fin de la phase 0.

## Où on en est

**Ce qui marche (vérifié par les tests, en mode démo) :**

- Boutiques multi-domaines : accueil, catalogue, fiches produits, guides, panier, paiement, pages légales, sitemap, robots.txt, llms.txt, flux Google Merchant Center, données structurées, mesure d'audience sans cookie.
- Admin : Aujourd'hui (rapport du matin), Ventes, Commandes (avec envoi fournisseur), Veille (cartes à trier), Boutiques (analyse par boutique, assistant de création), Agents (journal), **Réglages > État des services** (nouveau).
- Commandes fournisseur CJ automatiques, suivi des colis, e-mails (Resend), rapport sur Telegram.
- Agents IA (veille, construction, guides) avec Claude, et leur mode démo.

**Ce qui n'a pas pu être testé ici (aucune clé réelle utilisée) :**

- Paiement Stripe réel et webhook ; commande réelle chez CJ ; envoi d'e-mails Resend ; Telegram ; agents avec une vraie clé Anthropic ; connexion à un vrai projet Supabase.
- `npm run db:migrate` a été testé sur une base Postgres locale (PGlite) : application des 3 migrations, relance sans effet, installation neuve par `schema.sql` puis relance sans effet. Pas encore sur un vrai projet Supabase.
- La CI GitHub : le fichier est prêt, elle tournera au premier envoi (push) de la branche.

**Outils de vérification :** `npm run typecheck`, `npm run lint`, `npm test` (67 tests), `npm run test:e2e` (5 parcours), `npm run build`. Tous passent.

## Phases

- [x] **Phase 0 : audit et socle**. Documentation (architecture, avancement, décisions), migrations numérotées et `npm run db:migrate`, vérification des variables d'environnement (`lib/env.ts`) et page État des services, tests Vitest et Playwright, CI GitHub, ESLint.
- [ ] **Phase 1 : mise en ligne et domaines automatisés**. Script `npm run setup`, agent Domaines (Vercel), adresse d'aperçu par boutique.
- [ ] **Phase 2 : l'admin permet de modifier absolument tout**. Thèmes, pages en blocs, navigation, médias, redirections, historique des versions, édition en masse, barre « Demander à l'agent ».
- [ ] **Phase 3 : un dossier par boutique, rangé par niche**. `sites/<slug>/`, export et import, agent Archiviste (GitHub Actions).
- [ ] **Phase 4 : la veille réelle, chaque matin**. Couche fournisseur IA avec budgets, sources (boutiques, publicités Meta, tendances, CJ), agents Conformité et Analyste, veille sur GitHub Actions.
- [ ] **Phase 5 : construction d'une boutique de A à Z**. Questionnaire, équipe d'agents, contrôle qualité bloquant, mise en ligne.
- [ ] **Phase 6 : SEO et visibilité dans les IA**. Technique, données structurées, Search Console, Merchant Center, agents SEO/GEO.
- [ ] **Phase 7 : pilotage, rapports et recommandations**. `metrics_daily`, rapports hebdomadaire et mensuel, recommandations applicables, actions Telegram.
- [ ] **Phase 8 : commandes, service client et panier**. Import CJ par URL, webhooks CJ, boîte de réception, panier abandonné, lots, retours.
- [ ] **Phase 9 : finitions, sécurité, performance**. Supabase Auth et rôles, en-têtes de sécurité, Lighthouse ≥ 90, accessibilité, suivi des erreurs, sauvegardes.

## Phase 0 : ce qui a été fait

- `docs/ARCHITECTURE.md` : dossiers, flux d'une commande, flux des agents, où vit chaque donnée.
- `supabase/migrations/` : `001_base.sql`, `002_agents.sql`, `003_commandes_audience_rapports.sql`. `supabase/schema.sql` reste le fichier complet (installation neuve) et marque ces migrations comme appliquées.
- `npm run db:migrate` (`scripts/db-migrate.mjs`) : applique les migrations manquantes via `SUPABASE_DB_URL`, table `schema_migrations`. `--liste` pour voir l'état.
- `lib/env.ts` : validation zod de toutes les variables (format, obligations selon le contexte), état de chaque service. `instrumentation.ts` signale les problèmes dans les journaux au démarrage.
- Page **Réglages > État des services** (`/admin/reglages/services`, lien « Réglages » en bas du menu) : admin, Supabase, Stripe, webhook, CJ, Anthropic, Resend, Telegram, IndexNow, tâches planifiées, mesure d'audience. Pour chacun : configuré ou non, problème éventuel, marche à suivre. Plus : base joignable, dernière commande reçue de Stripe, dernière exécution de chaque tâche planifiée.
- Tests : Vitest (`tests/unit/`, 67 tests) et Playwright (`tests/e2e/`, 5 parcours). Scripts `npm test`, `npm run test:e2e`.
- CI : `.github/workflows/ci.yml` (installation, types, ESLint, tests unitaires, build, tests Playwright).
- ESLint 9 avec la configuration Next.js : `npm run lint`, aucune erreur ni alerte.
- `.env.example` : ajout de `SUPABASE_DB_URL`.

## Reste à faire / points d'attention

- Pousser la branche `phase-0` sur GitHub et vérifier que la CI est verte.
- Sur une base Supabase déjà installée : ajouter `SUPABASE_DB_URL` puis lancer `npm run db:migrate` une fois (sans risque, voir `docs/DECISIONS.md`).
- Le code existant lit encore `process.env` directement ; passer progressivement par `lib/env.ts`.
- Les liens des pages restent des `<a>` (voir `docs/DECISIONS.md`) : à revoir en phase 9 avec la mesure d'audience.
