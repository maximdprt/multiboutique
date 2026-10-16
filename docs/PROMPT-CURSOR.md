# Multiboutique : mise en place et prompts pour Cursor

Ce document a trois parties :

1. **La mise en place** (GitHub, Cursor, Supabase, Vercel), à faire une fois, à la main, en suivant les étapes.
2. **Comment travailler avec Cursor** sur ce projet.
3. **Les prompts**, un par phase, à coller dans Cursor l'un après l'autre.

Le dépôt contient déjà les règles permanentes du projet dans `.cursor/rules/multiboutique.mdc` : Cursor les applique automatiquement à chaque conversation (garde-fous juridiques, budget 0 €, stack, façon de travailler). Vous n'avez pas à les recoller.

---

## Partie 1 : mise en place (environ 45 minutes, une seule fois)

### 1.1 Ce qu'il vous faut

| Outil | Pourquoi | Prix |
|---|---|---|
| [Cursor](https://cursor.com) | L'éditeur avec l'agent qui code | Offre gratuite possible |
| [Node.js](https://nodejs.org) 20 ou plus (version LTS) | Faire tourner le projet sur votre ordinateur | Gratuit |
| [Git](https://git-scm.com) | Récupérer et envoyer le code sur GitHub | Gratuit |
| Compte GitHub (`maximdprt`) | Le code est dans `github.com/maximdprt/multiboutique` | Gratuit |
| Compte [Supabase](https://supabase.com) | La base de données | Gratuit |
| Compte [Vercel](https://vercel.com) | L'hébergement | Gratuit (Hobby) |
| Compte [Stripe](https://stripe.com) | Le paiement (mode test d'abord) | Frais par vente uniquement |
| Compte [CJ Dropshipping](https://cjdropshipping.com) | Commandes fournisseur automatiques | Gratuit |
| Bot Telegram (facultatif) | Recevoir le rapport du matin | Gratuit |
| Clé API Anthropic (facultatif) | Agents qui écrivent et font la veille | Payant, à l'usage : sans clé, mode démo |

### 1.2 Récupérer le projet dans Cursor

1. Ouvrez Cursor, puis **File > New Window**, puis **Clone repo** (ou la palette de commandes `Ctrl/Cmd + Shift + P` > « Git: Clone »).
2. Collez `https://github.com/maximdprt/multiboutique.git`, choisissez un dossier, puis **Open**.
3. Si Cursor demande de se connecter à GitHub, acceptez (c'est ce qui vous permettra d'envoyer vos modifications).
4. Ouvrez le terminal intégré (**Terminal > New Terminal**) et tapez :
   ```bash
   npm install
   npm run dev
   ```
5. Ouvrez dans votre navigateur :
   - http://localhost:3000/admin (mot de passe : `demo`)
   - http://bocal.localhost:3000 et http://chat.localhost:3000 (boutiques de démonstration)

   Si tout s'affiche, le projet marche en mode démo. Arrêtez le serveur avec `Ctrl + C`.

### 1.3 Créer la base de données (Supabase)

1. Sur supabase.com : **New project**, région **Europe (Paris ou Francfort)**, notez le mot de passe de la base.
2. **SQL Editor > New query** : ouvrez le fichier `supabase/schema.sql` du projet, copiez tout, collez, **Run**. Vous devez voir « Success ».
3. **Project Settings > API** : copiez l'**URL du projet** et la clé **service_role** (secrète, ne la partagez jamais).
4. Facultatif, pour partir des boutiques d'exemple : dans le terminal de Cursor
   ```bash
   SUPABASE_URL="https://xxxx.supabase.co" SUPABASE_SERVICE_ROLE_KEY="votre-cle" npm run seed:supabase
   ```
   (lancez une fois `npm run dev` et ouvrez une page avant, pour que les données de démo existent).

### 1.4 Vos variables en local

1. Dans Cursor, dupliquez `.env.example` et renommez la copie en **`.env.local`** (ce fichier n'est jamais envoyé sur GitHub).
2. Remplissez au minimum :
   ```
   ADMIN_PASSWORD=un-long-mot-de-passe
   ADMIN_SECRET=une-chaine-aleatoire-de-40-caracteres
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...
   CRON_SECRET=une-autre-chaine-aleatoire
   ```
   Pour générer une chaîne aléatoire : `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
3. Relancez `npm run dev` : l'admin n'affiche plus « Mode démo : données fictives ».

### 1.5 Mettre en ligne (Vercel)

1. Sur vercel.com, connectez-vous **avec GitHub**.
2. **Add New > Project**, choisissez `multiboutique`, **Import**.
3. Avant de cliquer **Deploy**, ouvrez **Environment Variables** et ajoutez les mêmes variables que dans `.env.local`, plus :
   ```
   DEFAULT_SITE=bocal
   ```
   (ce réglage affiche une boutique sur l'adresse `.vercel.app` tant que vous n'avez pas de domaine).
4. **Deploy**. Au bout de 1 à 2 minutes, vous avez une adresse `https://multiboutique-xxx.vercel.app`. L'admin est sur `/admin`.
5. Ensuite, **chaque `git push` sur la branche `main` redéploie automatiquement**. Les tâches planifiées de `vercel.json` (veille, suivi des colis, rapport, guides) s'activent toutes seules.

### 1.6 Paiement (Stripe, mode test)

1. Stripe, **mode Test** activé : **Développeurs > Clés API**, copiez la clé secrète `sk_test_...` dans `STRIPE_SECRET_KEY` (Vercel et `.env.local`).
2. **Développeurs > Webhooks > Ajouter un endpoint** : URL `https://votre-adresse.vercel.app/api/stripe/webhook`, événements `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`. Copiez le secret `whsec_...` dans `STRIPE_WEBHOOK_SECRET` sur Vercel.
3. Redéployez (Vercel > Deployments > ⋯ > Redeploy), puis passez une commande avec la carte `4242 4242 4242 4242`.

### 1.7 Commandes automatiques (CJ Dropshipping)

1. CJ : **My CJ > Authorization > API**, générez une clé, mettez-la dans `CJ_API_KEY`.
2. `CJ_PAY_MODE=balance` si vous alimentez votre solde CJ (commandes payées sans vous), sinon `manual`.
3. Dans l'admin, pour chaque produit : renseignez l'**identifiant de variante CJ (vid)** et le pays de l'entrepôt.

### 1.8 Rapport du matin sur Telegram (facultatif, gratuit)

1. Dans Telegram, écrivez à **@BotFather** : `/newbot`, suivez les étapes, copiez le jeton dans `TELEGRAM_BOT_TOKEN`.
2. Envoyez un message à votre bot, puis ouvrez `https://api.telegram.org/bot<VOTRE_JETON>/getUpdates` : le nombre après `"chat":{"id":` va dans `TELEGRAM_CHAT_ID`.

### 1.9 Secrets pour GitHub Actions (quand une phase les demandera)

GitHub > dépôt `multiboutique` > **Settings > Secrets and variables > Actions > New repository secret**. Ajoutez au fur et à mesure : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` (si vous en avez une), `APP_URL` (votre adresse Vercel), `CRON_SECRET`.

### 1.10 Les noms de domaine (quand une boutique est prête)

1. Achetez le domaine (OVH, Gandi, Namecheap… environ 10 € par an).
2. Vercel > projet > **Settings > Domains** : ajoutez `ma-boutique.fr` et `www.ma-boutique.fr`, recopiez chez votre registraire les enregistrements DNS affichés.
3. Dans l'admin > **Boutiques > Réglages**, mettez le même domaine (sans `www`).
4. Une phase plus bas automatise ces étapes depuis l'admin.

---

## Partie 2 : comment travailler avec Cursor

- **Mode Agent**, avec le modèle le plus puissant disponible dans votre offre.
- **Une nouvelle conversation par phase** (bouton « New chat ») : Cursor garde mieux le fil quand la conversation est courte. Le lien entre les phases se fait par le fichier `docs/AVANCEMENT.md`, que l'agent met à jour à la fin de chaque phase.
- **Collez le prompt de la phase**, laissez l'agent travailler, acceptez ses modifications quand il vous les montre.
- **À la fin de chaque phase**, avant de passer à la suivante :
  1. testez vous-même ce que l'agent annonce (`npm run dev`, puis les pages concernées) ;
  2. dans l'onglet **Source Control** de Cursor : écrivez un message, **Commit**, puis **Sync / Push** ;
  3. vérifiez sur Vercel que le déploiement est vert.
- **Si l'agent part dans une mauvaise direction** : arrêtez-le, et dites-lui précisément ce qui ne va pas. Si une phase casse quelque chose, revenez en arrière avec Source Control (« Discard changes ») plutôt que d'empiler des corrections.
- **Ne collez jamais de clé secrète dans la conversation** : mettez-les dans `.env.local` et dans Vercel, l'agent n'en a pas besoin pour coder.

---

## Partie 3 : les prompts

### Prompt de la phase 0 : audit et socle

```
Tu reprends le projet multiboutique (Next.js 15, Supabase, Stripe, Vercel). Lis les règles de .cursor/rules/multiboutique.mdc, puis le README.md, puis le code.

Ce qui existe déjà :
- Boutiques multi-domaines dans app/[host]/ : accueil, catalogue, fiches produits, guides, panier, paiement Stripe, pages légales, sitemap.xml, robots.txt (robots IA autorisés), llms.txt, feed.xml (Google Merchant Center), données structurées (lib/seo.tsx), mesure d'audience sans cookie (app/api/collect, components/track.ts).
- Admin dans app/admin/(panel)/ : Aujourd'hui (rapport du matin calculé sans IA, lib/report.ts), Ventes, Commandes (avec envoi fournisseur), Veille (cartes à trier), Boutiques (avec page d'analyse par boutique et assistant de création), Agents (journal).
- Données : interface Db dans lib/db/ avec implémentation Supabase et démo. Schéma dans supabase/schema.sql.
- Agents : lib/agents/ (veille, construction, contenu) avec l'API Claude ; tâches planifiées app/api/cron/* déclarées dans vercel.json.
- Commandes fournisseur automatiques CJ Dropshipping : lib/fulfillment.ts, lib/suppliers/cj.ts.

Ta mission pour cette phase, sans ajouter de fonctionnalité visible :
1. Écris docs/ARCHITECTURE.md : schéma des dossiers, flux d'une commande (panier → Stripe → webhook → commande → CJ → suivi → e-mail), flux des agents, où vit chaque donnée. En français simple.
2. Crée docs/AVANCEMENT.md (état actuel, liste des phases 1 à 9 de docs/PROMPT-CURSOR.md avec une case à cocher chacune) et docs/DECISIONS.md.
3. Découpe supabase/schema.sql en migrations numérotées dans supabase/migrations/ (001_base.sql, 002_agents.sql, 003_commandes_audience_rapports.sql), en gardant schema.sql comme fichier complet pour une installation neuve. Ajoute un script npm "db:migrate" qui applique les migrations manquantes via la connexion Postgres de Supabase (variable SUPABASE_DB_URL) et tient une table schema_migrations.
4. Ajoute un fichier lib/env.ts qui valide les variables d'environnement avec zod (obligatoires, facultatives, format) et une page admin « Réglages > État des services » qui affiche pour chaque service (Supabase, Stripe, webhook, CJ, Anthropic, Resend, Telegram, IndexNow, tâches planifiées) : configuré ou non, et quoi faire si non. Aucun secret affiché.
5. Mets en place les tests : Vitest (calculs de lib/stats.ts, lib/report.ts, prix et frais de port de lib/orders.ts, parseurs de lib/richtext.tsx, classement des sources de lib/analytics.ts) et Playwright (en mode démo : se connecter à l'admin, passer une commande, la voir dans Commandes avec l'envoi fournisseur simulé, trier une carte de veille). Scripts npm "test" et "test:e2e".
6. Ajoute .github/workflows/ci.yml : à chaque push et pull request, installation, vérification des types, build, tests unitaires et tests Playwright en mode démo.
7. Ajoute ESLint (configuration Next.js) et corrige les erreurs.

Critères de fin : npx tsc --noEmit, npm run build, npm test et npm run test:e2e passent ; la CI GitHub est verte après push ; la page État des services s'affiche. Mets à jour docs/AVANCEMENT.md puis montre-moi un résumé de ce qui a été fait et de ce que je dois tester.
```

### Prompt de la phase 1 : mise en ligne et domaines automatisés

```
Lis docs/AVANCEMENT.md et docs/ARCHITECTURE.md. Phase 1 : rendre la mise en ligne et les domaines aussi automatiques que possible.

1. Script npm "setup" (scripts/setup.mjs), interactif et en français, qui :
   - vérifie Node, Git et la présence de .env.local ; propose de le créer à partir de .env.example et génère ADMIN_SECRET, CRON_SECRET, ANALYTICS_SALT et une clé INDEXNOW_KEY ;
   - applique les migrations Supabase (npm run db:migrate) si SUPABASE_DB_URL est présent ;
   - si VERCEL_TOKEN est présent : retrouve ou crée le projet Vercel lié au dépôt GitHub, pousse les variables d'environnement (sauf celles vides), déclenche un déploiement et affiche l'adresse ;
   - si GITHUB_TOKEN est présent : crée les secrets GitHub Actions nécessaires ;
   - affiche à la fin un récapitulatif clair de ce qui est fait et de ce qui reste.
   Vérifie les routes exactes de l'API Vercel et de l'API GitHub dans leur documentation officielle actuelle avant de les coder.

2. Agent Domaines (lib/domains.ts + page admin Boutiques > fiche boutique > onglet Domaine) :
   - bouton « Ajouter ce domaine » : ajoute le domaine et sa variante www au projet Vercel via l'API (VERCEL_TOKEN, VERCEL_PROJECT_ID), configure la redirection www vers le domaine nu ;
   - affiche les enregistrements DNS exacts à créer chez le registraire, avec un bouton copier ;
   - vérifie l'état (DNS, vérification, certificat HTTPS) à la demande et chaque jour via une tâche planifiée ; affiche « En ligne » quand tout est bon ;
   - quand un domaine passe en ligne : soumet le sitemap à IndexNow et ajoute une ligne « Déclarer le domaine dans Google Search Console et Merchant Center » dans le rapport du matin.
   - sans VERCEL_TOKEN : affiche la marche à suivre manuelle (comme dans le README).

3. Adresse d'aperçu pour chaque boutique avant l'achat du domaine : https://<adresse-vercel>/apercu/<id-boutique>/… doit afficher la boutique (adapter middleware.ts), avec une balise noindex.

Critères de fin : sur une installation neuve, npm run setup amène jusqu'à un site en ligne sur Vercel ; un domaine de test s'ajoute depuis l'admin et ses enregistrements DNS s'affichent ; tests à jour. Mets à jour docs/AVANCEMENT.md et le README.
```

### Prompt de la phase 2 : l'admin permet de modifier absolument tout

```
Lis docs/AVANCEMENT.md. Phase 2 : depuis l'admin, le propriétaire doit pouvoir modifier n'importe quel élément visible de n'importe quelle boutique, sans toucher au code, avec aperçu et retour en arrière.

1. Modèle de données (migration + interface Db + démo) : themes, pages (liste ordonnée de blocs en JSON validé par zod), navigation (menus d'en-tête et de pied de page), media (Supabase Storage, bucket public "medias", optimisation à l'envoi), redirects, versions (historique de toute entité modifiable : auteur humain ou agent, date, contenu complet, motif).
2. Les boutiques (app/[host]) doivent être rendues à partir de ces données : l'accueil et toute page devient une suite de blocs. Blocs à fournir : bandeau d'accueil, texte, texte + image, grille de produits (sélection manuelle ou par catégorie), avantages, FAQ, comparatif, guides récents, bannière, vidéo, inscription newsletter (stockée, avec consentement), HTML personnalisé (assaini). Chaque bloc a ses champs et une variante d'affichage. Migre automatiquement l'accueil actuel en blocs, sans changer le rendu.
3. Fiche boutique dans l'admin avec onglets : Aperçu (existe déjà), Thème, Pages, Navigation, Produits, Guides, FAQ, Pages légales, Médias, SEO, Domaine, Livraison et paiement, Avancé, Historique.
   - Thème : couleurs, polices, arrondis, logo, favicon, avec aperçu en direct de la boutique dans un cadre à côté du formulaire. Vérifie le contraste des couleurs (WCAG AA) et avertis si insuffisant.
   - Pages : liste des pages, création, éditeur par blocs avec glisser-déposer pour réordonner, ajout, duplication, suppression, aperçu en direct.
   - Produits : ajout du téléversement d'images (glisser-déposer, recadrage, texte alternatif) et des variantes.
   - SEO : titre et description de chaque page, aperçu du résultat Google, redirections 301 (créées automatiquement quand une adresse change).
   - Pages légales : modèles actuels modifiables, avec bouton « Revenir au modèle ».
   - Avancé : CSS personnalisé, code dans <head> (avec avertissement), duplication de boutique, mise hors ligne, suppression (avec approbation).
   - Historique : toutes les versions, comparaison avant/après, bouton « Restaurer ».
4. Édition en masse : modification groupée (prix, statut, catégorie) et import/export CSV des produits.
5. Barre « Demander à l'agent » sur la fiche boutique : le propriétaire écrit en français (« mets les boutons en vert sapin », « ajoute une FAQ sur l'entretien à la fiche bouillotte », « crée une page comparatif »). Un agent Éditeur traduit la demande en modifications structurées (jamais en code), affiche l'avant/après, et n'applique qu'après clic sur « Appliquer » ; chaque application crée une version. Sans clé d'API IA, la barre explique qu'elle est désactivée.
6. Toute modification revalide la boutique concernée en quelques secondes (revalidatePath / revalidateTag).

Critères de fin : chaque élément visible d'une boutique de démo est modifiable et restaurable ; l'aperçu en direct fonctionne ; tests Playwright ajoutés pour Thème, Pages et Historique. Mets à jour docs/AVANCEMENT.md.
```

### Prompt de la phase 3 : un dossier par boutique, rangé par niche

```
Lis docs/AVANCEMENT.md. Phase 3 : chaque boutique a un dossier lisible et versionné dans le dépôt, sites/<slug-de-la-niche>/.

Structure :
sites/<slug>/site.json, theme.json, navigation.json, faq.json, seo.json, pages/*.json, produits/*.json (avec la source fournisseur), collections/*.json, guides/*.md (front-matter YAML + corps), medias/ (liste des URL, pas les fichiers lourds), CHANGELOG.md.

1. Schémas zod partagés (lib/schemas/) pour valider chaque fichier.
2. npm run site:export <id> et site:export --all : écrit les dossiers depuis la base.
3. npm run site:import sites/<slug> : crée ou restaure une boutique en base à partir de son dossier (avec rapport des différences et confirmation).
4. Agent Archiviste : après chaque publication et chaque nuit, exporte les boutiques modifiées et fait un commit sur GitHub via l'API (GITHUB_TOKEN, dépôt et branche configurables), message « chore(sites/<slug>): … ». Il tourne dans un workflow GitHub Actions planifié (.github/workflows/archive.yml), pas sur Vercel.
5. Le slug du dossier vient de la niche (ex. confort-hiver-bouillotte), avec un sites/_modele/ servant de base à toute nouvelle boutique.

Critères de fin : une boutique fait l'aller-retour base → dossier → base à l'identique (test automatisé) ; le workflow d'archivage fonctionne sur GitHub. Mets à jour docs/AVANCEMENT.md.
```

### Prompt de la phase 4 : la veille réelle, chaque matin

```
Lis docs/AVANCEMENT.md. Phase 4 : la veille trouve chaque matin les produits et les boutiques qui marchent, avec des sources vérifiables, en respectant le budget 0 € par défaut.

1. Couche fournisseur de modèle IA (lib/llm/) : interface unique, implémentation Anthropic par défaut, modèle configurable par agent, comptage des jetons et du coût dans agent_runs, budget quotidien et mensuel par agent (table agent_settings, réglable dans l'admin), arrêt propre quand le budget est atteint, bouton d'arrêt d'urgence global.
2. Sources de la veille, chacune dans un module séparé (lib/veille/sources/), activable dans l'admin, avec mode démo :
   - Boutiques : à partir d'une liste de boutiques surveillées (watch_stores, ajoutables à la main ou découvertes), lecture du catalogue public si robots.txt l'autorise (par exemple /products.json des boutiques Shopify, ou le sitemap) : produits, prix, date d'apparition, ruptures. Historique dans watch_products pour repérer les produits ajoutés récemment et ceux qui restent en tête.
   - Publicités : bibliothèque publicitaire Meta via son API officielle (jeton à fournir par le propriétaire ; accès à demander). Signal fort : publicité active depuis plus de 30 jours, déclinée en plusieurs versions.
   - Recherche et tendances : via un fournisseur de données SEO (DataForSEO, SerpApi ou équivalent) seulement si une clé est fournie ; sinon via l'outil de recherche web de l'API IA si elle est configurée ; sinon désactivé.
   - Fournisseurs : recherche du produit chez CJ via son API (gratuite) : coût, entrepôts, délai et frais vers la France.
3. Agent Conformité : écarte les catégories interdites des règles du projet et signale les risques de marque.
4. Agent Analyste : score sur 100 expliqué (demande 25 %, facilité à se classer 20 %, marge 20 %, preuves de vente 15 %, logistique 10 %, potentiel de contenu 10 %, pénalités conformité), stocké avec son détail dans opportunities, affiché sur la carte de veille (détail dépliable).
5. Planification : la veille est un workflow GitHub Actions (.github/workflows/veille.yml) qui tourne vers 6 h heure de Paris (gère l'heure d'été : deux crons UTC et vérification de l'heure locale) et écrit dans Supabase ; le bouton « Lancer une veille » de l'admin déclenche ce workflow via l'API GitHub (workflow_dispatch). Garde la route Vercel actuelle comme solution de secours.
6. Ajoute à la carte de veille : « Surveiller cette boutique » (ajoute à watch_stores) et l'historique de prix du produit.

Critères de fin : en mode démo, la veille produit des cartes réalistes ; avec CJ seul (gratuit), elle enrichit les cartes avec coûts et délais réels ; les sources payantes sont désactivées sans clé ; tests sur le calcul du score. Mets à jour docs/AVANCEMENT.md et le README (ce qui est gratuit, ce qui est payant).
```

### Prompt de la phase 5 : construction d'une boutique de A à Z

```
Lis docs/AVANCEMENT.md. Phase 5 : à partir d'une carte de veille « Lancer », une équipe d'agents construit une boutique complète en moins de 10 minutes, en posant au propriétaire seulement les questions utiles.

L'assistant actuel (app/admin/(panel)/boutiques/creer, lib/agents/builder.ts) est le point de départ. À ajouter :
1. Questionnaire : chaque question a 3 propositions cliquables et « autre » : nom + domaine (disponibilité vérifiée via RDAP, gratuit), palette (contraste vérifié, aperçu), polices, ton, pages à créer, produits à garder, sujets des premiers guides, livraison et retours, images. Si le propriétaire ne répond pas sous 24 h, les choix par défaut s'appliquent (sauf dépenses).
2. Agents, chacun dans son module et journalisé : Stratège (persona, positionnement, carte des mots-clés : un sujet pilier, des sous-sujets, une requête principale par page), Image de marque, Catalogue (produits trouvés chez CJ avec vid, coût, entrepôt, images dont l'usage est autorisé ; règle de prix : coût × 2,5, minimum coût + 15 €, arrondi psychologique, comparé au prix médian du marché), Rédacteur produits, Rédacteur pages (en blocs, phase 2), Rédacteur guides, Intégrateur (base + dossier sites/<slug>), Contrôle qualité.
3. Contrôle qualité bloquant avant publication : textes trop proches d'une source, caractéristiques non sourcées, promesses interdites, liens cassés, données structurées invalides, images manquantes, audit Lighthouse mobile (performance et accessibilité ≥ 90) sur l'adresse d'aperçu. En cas d'échec, renvoi au bon agent (2 essais) puis signalement au propriétaire.
4. Respect des plafonds : 15 fiches et 5 guides maximum au lancement.
5. Suivi en direct dans l'admin (étapes, journal), boutique d'abord en aperçu (phase 1), puis bouton « Mettre en ligne » qui enchaîne avec l'agent Domaines.
6. Sans clé IA : le parcours fonctionne avec un contenu modèle clairement marqué « à réécrire ».

Critères de fin : de la carte à l'aperçu en moins de 10 minutes avec une clé IA ; contrôle qualité réussi ; dossier sites/<slug> créé ; test e2e du parcours en mode démo. Mets à jour docs/AVANCEMENT.md.
```

### Prompt de la phase 6 : SEO et visibilité dans les IA

```
Lis docs/AVANCEMENT.md. Phase 6 : une équipe d'agents SEO/GEO s'occupe en continu de chaque boutique, dans le respect des plafonds de publication.

1. Technique : index de sitemaps par boutique (pages, produits, guides, images), robots.txt, canoniques, redirections 301 automatiques, page 404 utile, détection des liens cassés, images optimisées, hreflang si une boutique devient multilingue.
2. Données structurées : vérification automatique de chaque page (Product, Offer avec livraison et retours, FAQPage, BreadcrumbList, Article, OnlineStore), rapport des erreurs dans l'admin.
3. Search Console (gratuit) : connexion par compte de service Google (variable GOOGLE_SERVICE_ACCOUNT_JSON), collecte quotidienne des clics, impressions, CTR, position par requête et par page (tables gsc_queries_daily, gsc_pages_daily), soumission des sitemaps via l'API, vérification de l'indexation des nouvelles pages via l'API d'inspection d'URL (respecter le quota). Affichage dans la page d'analyse de chaque boutique.
4. Merchant Center (gratuit) : flux feed.xml existant ; ajoute le suivi de l'état des produits (approuvés, refusés et pourquoi) si un accès API est fourni (vérifie l'API en vigueur dans la documentation Google).
5. Agents : FAQ (ajoute des questions à partir des vraies requêtes Search Console), Maillage interne (liens guides → produits, pas de page orpheline), Rafraîchissement (pages avec beaucoup d'impressions et peu de clics : nouveau titre et description ; positions 8 à 20 : renforcer la page ; chaque changement versionné et mesuré 14 jours après), GEO (llms.txt à jour, formulations faciles à citer, cohérence du nom et de la description de la marque), Contenu (existe : un guide par semaine et par boutique maximum).
6. Chaque agent propose ses actions dans une liste « Actions SEO » de la boutique ; les actions sans risque s'appliquent seules (sitemap, données structurées, liens internes), les réécritures de contenu s'appliquent seules seulement si le réglage « publication automatique » est activé, sinon elles attendent un clic.

Critères de fin : sitemaps soumis, indexation suivie, actions SEO hebdomadaires visibles et mesurées, tout fonctionne sans aucune dépense. Mets à jour docs/AVANCEMENT.md.
```

### Prompt de la phase 7 : pilotage, rapports et recommandations

```
Lis docs/AVANCEMENT.md. Phase 7 : le propriétaire voit chaque matin où il en est et quoi faire pour gagner plus.

1. Collecte quotidienne (metrics_daily par boutique et par jour) : ventes, bénéfice estimé (prix d'achat + frais Stripe + frais de port réels CJ), commandes, visites, conversion, données Search Console, état Merchant Center, coûts des agents.
2. Rapport du matin (lib/report.ts existe, sans IA) : ajoute les chiffres Search Console, les produits qui montent et qui baissent, les ruptures, les marges qui s'érodent ; bilan hebdomadaire le lundi ; compte de résultat mensuel le 1er (exportable en CSV pour le comptable, avec TVA collectée).
3. Recommandations : chaque idée du rapport devient une recommandation (impact estimé en euros, effort, urgence) avec un bouton « Appliquer » qui crée la tâche pour le bon agent (approbation si elle coûte de l'argent). Historique de ce qui a été appliqué et de son effet.
4. Envoi : admin (page Aujourd'hui), Telegram et e-mail (déjà prévus) ; ajoute des boutons d'action directement dans le message Telegram (approuver une commande, trier une idée) via un webhook de bot sécurisé.
5. Page Ventes : ajoute la comparaison entre boutiques sur la période et l'export CSV.

Critères de fin : rapport complet chaque matin vers 7 h, recommandations applicables en un clic, actions Telegram fonctionnelles. Mets à jour docs/AVANCEMENT.md.
```

### Prompt de la phase 8 : commandes, service client et panier

```
Lis docs/AVANCEMENT.md. Phase 8 : supprimer les dernières tâches répétitives.

1. CJ (lib/suppliers/cj.ts, lib/fulfillment.ts existent) : import d'un produit à partir d'une URL CJ (remplit titre provisoire, variantes avec vid, coût, entrepôts, images autorisées), recalcul automatique du coût et du port, réception des webhooks CJ (changement d'état, numéro de suivi) en plus de la synchronisation quotidienne, gestion des ruptures chez le fournisseur (produit masqué + alerte).
2. Service client : boîte de réception par boutique (adresse de transfert via Resend Inbound ou équivalent gratuit), classement automatique (suivi, retour, question produit, réclamation), brouillon de réponse que le propriétaire valide d'un clic ; envoi automatique uniquement pour les questions de suivi de colis.
3. Panier abandonné : enregistrement de l'adresse e-mail saisie au paiement Stripe (session expirée), deux relances (1 h et 24 h), désinscription en un clic, conforme RGPD.
4. Lots et ventes complémentaires : lots de 2 ou 3 configurables par produit, produit complémentaire proposé dans le panier, seuil de livraison offerte affiché.
5. Retours : formulaire de rétractation en ligne (obligatoire), suivi dans l'admin, remboursement Stripe avec approbation.

Critères de fin : une commande va de l'achat à la livraison sans action du propriétaire ; les demandes clients arrivent classées avec un brouillon ; tests ajoutés. Mets à jour docs/AVANCEMENT.md.
```

### Prompt de la phase 9 : finitions, sécurité, performance

```
Lis docs/AVANCEMENT.md. Phase 9 : rendre l'ensemble solide.

1. Sécurité : connexion admin via Supabase Auth (lien magique + double authentification) en remplacement du mot de passe unique, rôles propriétaire / éditeur / lecture seule, limitation des tentatives de connexion, en-têtes de sécurité (CSP, HSTS), vérification de toutes les actions serveur, journal d'audit des actions sensibles.
2. Performance : audit Lighthouse de chaque boutique de démo (objectif ≥ 90 partout sur mobile), cache et revalidation, images.
3. Accessibilité : navigation clavier complète de l'admin et des boutiques, contrastes, libellés.
4. Fiabilité : suivi des erreurs (Sentry offre gratuite ou équivalent), alerte Telegram si une tâche planifiée échoue deux jours de suite, sauvegarde quotidienne de la base (export dans le stockage).
5. Documentation : README à jour pour un non-développeur, docs/ARCHITECTURE.md à jour, guide « que faire si… » (paiement en panne, commande bloquée chez CJ, domaine qui ne répond plus).

Critères de fin : audit de sécurité passé (liste des points vérifiés), Lighthouse ≥ 90, CI verte. Mets à jour docs/AVANCEMENT.md.
```

### Agents complémentaires (à demander plus tard, un par un)

Quand les phases sont terminées, demandez-les à Cursor avec la même structure (objectif, tâches, critères de fin). Tous désactivés par défaut, avec budget et approbation :

- **Prix et marge** : surveille le coût fournisseur et les prix des boutiques suivies, propose des ajustements de prix.
- **Avis clients** : demande un avis réel après livraison, n'affiche que des avis vérifiés.
- **Réseaux sociaux** : épingles Pinterest à partir des produits et guides, idées de vidéos courtes ; publication après validation.
- **Publicité** : campagnes Google Shopping sur les produits qui convertissent déjà ; plafond quotidien strict, arrêt automatique si le coût par vente dépasse la marge, aucune dépense sans approbation.
- **Traduction et expansion** : déclinaison d'une boutique gagnante pour la Belgique, la Suisse, le Canada, puis d'autres langues (adaptation, pas traduction brute ; hreflang).
- **Risques** : litiges et rétrofacturations Stripe, commandes suspectes.
- **Revente** : quand une boutique a 6 mois d'historique rentable, dossier de présentation pour une éventuelle revente.
