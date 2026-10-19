# Décisions

Les choix techniques faits en cours de route, avec leur raison. Le plus récent en haut.

## Gabarit « Studio » (19 octobre 2026)

**Les boutiques créées par l'agent utilisent le gabarit Studio, inspiré du modèle de portfolio 3D fourni par le propriétaire.**
Fond très sombre, police Kanit, nom de la boutique en lettres géantes avec un dégradé, bandeaux d'images qui glissent avec le défilement, présentation révélée lettre par lettre, collections numérotées sur fond blanc, produits phares en cartes empilées, boutons pilule en dégradé. Adapté au commerce : les sections montrent les produits, les collections (catégories, nombre de produits, écart de prix), les faits de livraison et de retour, et mènent toujours vers une fiche ou le catalogue. Les autres pages (catalogue, fiche, panier, guides) reprennent le même style. Le gabarit se choisit par boutique dans **Réglages > Apparence** (`theme.template`, stocké dans le JSON du thème : pas de migration) ; les boutiques existantes restent en « Classique » tant qu'on ne le change pas. Exemple : Chat Perché dans la démo.

**Réalisé sans Tailwind ni Framer Motion.**
Les règles du projet fixent CSS maison et interdisent de changer de pile sans accord ; et l'objectif Lighthouse ≥ 90 pousse à rester léger. Les effets sont refaits en React + CSS (`components/studio.tsx`, `app/[host]/studio.css`) avec les mêmes réglages que le modèle (délais, distances, aimant 150 px / force 3, repères de défilement 0,8 / 0,2, réduction de 3 % par carte). Ils s'arrêtent si le visiteur demande moins d'animations, et le contenu reste visible sans JavaScript.

**Les couleurs restent celles de chaque boutique.**
Le dégradé des titres va de « texte mêlé au fond » vers la couleur du texte (#646973 → #BBCCD7 dans le modèle), celui du bouton de la couleur principale vers la couleur d'accent : chaque boutique garde son identité. L'agent propose des palettes sombres compatibles (fond presque noir, texte clair, contraste ≥ 7:1).

**Aucune image du modèle ni d'une autre boutique.**
Les visuels du modèle (portrait, GIF de motionsites.ai, images de projets) appartiennent à leurs auteurs : ils ne sont pas repris. Le gabarit n'affiche que les images des produits de la boutique. Récupérer les photos des boutiques Shopify observées par la veille est exclu (droit d'auteur des photographes et des marques, règle n° 1 du projet) : la veille ne garde que des faits (titre, prix, date, source). Sources d'images autorisées : celles du fournisseur (CJ autorise leur usage pour la revente), vos propres photos, des visuels générés à partir de la photo fournisseur du produit, fidèles au produit réel.

## Phase 1 (19 octobre 2026)

**API Vercel et GitHub : routes vérifiées dans la documentation officielle du 19 octobre 2026.**
Vercel : `GET /v9/projects/{id}`, `GET /v10/projects?repoUrl=…`, `POST /v11/projects`, `POST /v10/projects/{id}/env?upsert=true`, `POST /v13/deployments` et `GET /v13/deployments/{id}`, `POST /v10/projects/{id}/domains`, `GET /v9/projects/{id}/domains/{domaine}` et `…/verify`, `GET /v6/domains/{domaine}/config?projectIdOrName=…`. GitHub : `GET …/actions/secrets/public-key` puis `PUT …/actions/secrets/{nom}`, en-tête `X-GitHub-Api-Version: 2026-03-10`. Le projet est retrouvé par son lien GitHub vérifié côté script (le filtre de la liste ne suffit pas à lui seul).

**Enregistrements DNS lus chez Vercel, jamais codés en dur.**
Vercel recommande désormais des valeurs propres à chaque projet (par exemple une adresse A autre que 76.76.21.21, un CNAME `….vercel-dns-0xx.com`). L'onglet Domaine affiche donc les valeurs de rang 1 de `recommendedIPv4` et `recommendedCNAME`, plus les enregistrements TXT de vérification demandés par Vercel. Les valeurs « classiques » n'apparaissent qu'en mode démo.

**« En ligne » = la boutique répond en HTTPS avec son propre robots.txt.**
Vercel n'a pas d'API simple pour l'état du certificat d'un domaine. On demande `https://domaine/robots.txt` : la requête n'aboutit qu'avec un certificat valide, et le fichier doit annoncer le sitemap de ce domaine (ce qui écarte une page de parking du registraire). C'est aussi la seule vérification possible sans jeton Vercel (mode manuel).

**État des domaines dans la table `settings` (clé `domaine:<id>`), pas de nouvelle table.**
Une ligne par boutique, sans requête ni historique à faire : le magasin clé-valeur existant suffit et marche déjà en Supabase comme en démo. Si le domaine d'une boutique change, l'état repart de zéro ; l'ancien domaine n'est pas retiré de Vercel automatiquement (suppression = action difficile à annuler, à faire à la main).

**Ajout du domaine : le clic sur « Ajouter ce domaine » vaut approbation.**
L'ajout est réversible (on retire le domaine dans Vercel), gratuit et ne touche pas le DNS du propriétaire. `www` est ajouté avec une redirection 308 vers le domaine nu, en plus de celle du middleware. Les appels sont rejouables : un domaine déjà présent n'est pas rajouté.

**IndexNow à la mise en ligne : toutes les adresses du sitemap, une seule fois.**
IndexNow attend une liste d'adresses, pas un sitemap : on envoie celles du sitemap (`lib/sitemap.ts`, partagé avec `sitemap.xml`) quand le domaine passe à « En ligne » pour la première fois. Google n'utilise pas IndexNow : le rapport du matin rappelle de déclarer le domaine dans Search Console et Merchant Center jusqu'au clic sur « C'est fait ».

**Tâche planifiée des domaines à 4 h UTC, avant le rapport (5 h UTC).**
Le rapport du matin voit ainsi l'état du jour. L'offre Hobby autorise 100 tâches planifiées par projet, une fois par jour au plus, à l'heure près.

**Adresse d'aperçu : `/apercu/<id>/…`, réécrite vers le segment `[host]` = `apercu~<id>`.**
Elle marche sur n'importe quelle adresse (`.vercel.app`, `localhost`, domaine de l'admin), même pour une boutique hors ligne, pour pouvoir la vérifier (et plus tard l'auditer avec Lighthouse) avant l'ouverture. Elle n'est pas protégée par mot de passe : l'audit doit pouvoir la lire. Protections : en-tête `X-Robots-Tag: noindex, nofollow` et balise robots, aucune visite comptée dans les statistiques. Les liens internes passent par `StoreLink` (`components/store.tsx`) qui ajoute le préfixe ; le panier envoie l'identifiant de la boutique au paiement, et Stripe revient sur l'aperçu. Les balises canoniques et le sitemap pointent toujours vers le vrai domaine.

**`npm run setup` : une question avant chaque envoi, `--oui` pour tout accepter.**
Sans terminal interactif, les réponses par défaut (oui) s'appliquent. Les variables vides ne partent jamais vers Vercel, ni `GITHUB_TOKEN`, `GITHUB_REPO` et `SUPABASE_DB_URL`, qui ne servent que sur l'ordinateur ou dans GitHub Actions. Les variables partent en type `encrypted`, pour la production et les préversions. `VERCEL_TOKEN` part sur Vercel parce que l'agent Domaines en a besoin : un jeton Vercel donne accès à tout le compte (ou à toute l'équipe choisie), à garder secret comme un mot de passe. Les secrets GitHub sont chiffrés avec `libsodium-wrappers`, comme dans l'exemple officiel de GitHub. Le script a été essayé sans clé et contre de faux serveurs Vercel et GitHub, pas contre les vrais.

**Mode démo des domaines : simulation pas à pas.**
Sans base réelle ni jeton, « Ajouter ce domaine » simule l'ajout et chaque « Vérifier maintenant » franchit une étape (DNS, vérification, certificat, en ligne) : le parcours se teste de bout en bout sans rien toucher (test Playwright).

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
