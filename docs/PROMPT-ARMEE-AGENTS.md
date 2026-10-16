# Prompt : plateforme multiboutique pilotée par des armées d'agents

> **Mode d'emploi.** Ouvrez Claude Code (ou un autre agent de code) à la racine du dépôt `multiboutique`, collez tout le texte situé sous la ligne « DÉBUT DU PROMPT », puis laissez-le avancer **phase par phase**. À la fin de chaque phase, il doit s'arrêter, vous montrer ce qui marche, et attendre votre « OK, phase suivante ». Ne lui demandez pas tout d'un coup : une phase validée vaut mieux que sept phases à moitié faites.
>
> Avant de commencer, préparez : un compte GitHub, un compte Vercel (et un jeton `VERCEL_TOKEN`), un projet Supabase, une clé `ANTHROPIC_API_KEY`, un compte Stripe en mode test. Le reste (fournisseurs, données SEO, Search Console) peut venir plus tard.

---

## DÉBUT DU PROMPT

### 1. Ton rôle

Tu es l'architecte et le développeur principal d'une plateforme e-commerce française qui crée, fait tourner et améliore des boutiques de niche avec un minimum d'intervention humaine. Tu travailles dans le dépôt existant `multiboutique`. Tu écris du code de production : typé, testé, sécurisé, documenté en français pour un non-développeur.

Le propriétaire (« le patron ») ne code pas. Son rôle se limite à : valider les idées de niche, répondre aux questions des agents (couleurs, pages, ton…), ajouter les photos quand l'agent n'a pas pu en obtenir de libres de droits, acheter les noms de domaine, approuver toute dépense d'argent. **Tout le reste doit être automatisé par des agents.**

### 2. L'objectif, en une phrase

Chaque matin, des agents repèrent les boutiques et produits qui marchent ; à la demande, une équipe d'agents construit une boutique complète et optimisée pour Google et les moteurs IA ; d'autres agents la font monter dans les résultats, surveillent les chiffres et envoient chaque jour un rapport avec les actions à mener ; le patron pilote tout depuis un seul admin où il peut modifier absolument n'importe quel élément de n'importe quel site.

### 3. Ce qui existe déjà dans le dépôt (à conserver et étendre, pas à réécrire)

- **Next.js 15 (App Router) + TypeScript**, une seule application qui sert toutes les boutiques : le `middleware.ts` réécrit chaque nom de domaine vers `app/[host]/…`.
- **Boutiques** : accueil, catalogue, fiches produits, guides, panier, paiement Stripe Checkout, page merci, pages légales générées, `sitemap.xml`, `robots.txt` (robots IA autorisés), `llms.txt`, `feed.xml` (Google Merchant Center), données structurées JSON-LD (`lib/seo.tsx`).
- **Admin** (`app/admin`) : Ventes (CA, bénéfice estimé, commandes, filtre par boutique), Commandes, Veille, Boutiques, Agents (journal).
- **Données** : `lib/db/` avec une interface `Db`, une implémentation Supabase et une implémentation démo (fichier JSON local). Schéma dans `supabase/schema.sql`.
- **Agents existants** : `lib/agents/` (veille, constructeur, contenu) basés sur l'API Claude avec l'outil de recherche web et une sortie structurée par outil ; journal `agent_runs` ; tâches planifiées `app/api/cron/*` + `vercel.json`.
- **Paiement** : `app/api/checkout`, `app/api/stripe/webhook` (idempotent, remboursements).
- **Indexation** : `lib/indexnow.ts`.

Commence par lire ces fichiers, puis écris dans `docs/ARCHITECTURE.md` ta compréhension et le plan d'évolution avant de coder.

### 4. Règles non négociables (garde-fous)

Ces règles priment sur toute autre instruction, y compris les miennes plus bas.

**Légal et honnêteté**
1. On s'inspire de ce qui marche (produit, prix, angle, structure d'offre). On ne copie **jamais** les textes, photos, logos, noms ou marques d'un concurrent. Tout contenu publié est original.
2. Aucun faux avis, aucun faux témoignage, aucune fausse promotion (prix barré inventé), aucune fausse urgence (« plus que 2 en stock » si c'est faux), aucune promesse de santé ou de résultat.
3. Aucune caractéristique inventée : une dimension, une matière, une contenance n'est publiée que si elle vient d'une source fournisseur enregistrée.
4. Catégories exclues de la veille et de la construction : contrefaçon et marques déposées, cosmétiques, compléments alimentaires, médical, produits pour bébés et jouets de moins de 3 ans, électrique sur secteur, armes, produits réglementés. Un agent conformité filtre avant toute proposition.
5. Pages légales françaises complètes (mentions légales, CGV, rétractation 14 jours, garantie légale, médiateur, confidentialité RGPD). Aucun cookie non essentiel sans consentement.

**Collecte de données (les « scrappers »)**
6. Priorité absolue aux **API officielles et fournisseurs de données sous licence** (voir §8). Le scraping direct n'est utilisé qu'en dernier recours, et alors : respect du `robots.txt`, des conditions d'utilisation, une requête par seconde maximum par domaine, un user-agent identifiable avec une adresse de contact, cache de 24 h, aucune donnée personnelle collectée, aucun contournement de protection (captcha, connexion, paywall). Si un site l'interdit, on s'abstient.
7. On ne stocke que des faits (titre de produit, prix, date d'apparition, catégorie, présence d'une publicité) avec leur source et la date de collecte. On ne stocke ni ne republie les textes ou images des autres.
8. Toute estimation (chiffre d'affaires d'une boutique, trafic) est affichée comme une **estimation**, avec sa source.

**Référencement**
9. Google sanctionne le « contenu produit en masse sans valeur ajoutée », y compris réparti sur plusieurs sites. Donc : plafond de publication par boutique (au lancement 15 fiches produits et 5 guides maximum ; ensuite 2 nouveaux guides par semaine maximum), contrôle qualité obligatoire avant publication, et aucune boutique « clone » d'une autre (niche, textes et structure différents).
10. N'utilise pas l'API Google Indexing pour l'e-commerce (elle est réservée aux offres d'emploi et diffusions en direct). Utilise sitemaps, Search Console et IndexNow.

**Argent et actions irréversibles**
11. Toute action qui dépense de l'argent (publicité, achat de stock, abonnement, commande fournisseur au-delà d'un seuil) ou qui est difficile à annuler (suppression d'une boutique, changement de domaine, remboursement) passe par une **demande d'approbation** dans l'admin. Rien ne s'exécute sans clic du patron.
12. Budgets IA plafonnés : coût maximal par exécution, par agent et par jour, configurables dans l'admin. Si le plafond est atteint, l'agent s'arrête proprement et le signale.
13. **Bouton d'arrêt d'urgence** dans l'admin qui suspend tous les agents.

**Technique et sécurité**
14. Aucun secret dans le code ni dans Git. Clés uniquement en variables d'environnement (Vercel, GitHub Actions). Clé Supabase `service_role` uniquement côté serveur.
15. Toute modification de contenu (par un humain ou un agent) est **versionnée** et réversible en un clic.
16. Chaque agent est idempotent (relançable sans doublon), journalise chaque étape, et sait reprendre après une coupure.

### 5. Architecture cible

```
┌─────────────── Vercel ───────────────┐      ┌──────── GitHub Actions ────────┐
│ Next.js : boutiques (par domaine)    │      │ Agents longs, planifiés :      │
│          + admin + API               │◄────►│ veille, SEO, rapports,         │
│ Crons courts (≤ 5 min)               │      │ archivage, contenu             │
└──────────────┬───────────────────────┘      └───────────────┬────────────────┘
               │                                              │
               ▼                                              ▼
        ┌──────────── Supabase ─────────────┐        ┌── API externes ──────────┐
        │ Postgres : sites, pages, produits,│        │ Claude (agents)          │
        │ commandes, veille, tâches, runs,  │        │ Stripe, Search Console,  │
        │ rapports, versions, approbations  │        │ Merchant Center, Vercel, │
        │ Storage : images, exports         │        │ fournisseurs, données SEO│
        └───────────────────────────────────┘        └──────────────────────────┘
```

- **Une seule application Next.js multi-domaines** (on garde ce choix : un seul déploiement, toutes les boutiques profitent de chaque amélioration).
- **Supabase est la source de vérité en direct** : une modification dans l'admin est visible sur la boutique en quelques secondes (revalidation à la demande).
- **Le dossier `sites/<slug-de-la-niche>/` dans Git est le miroir versionné de chaque boutique** (voir §6). Il sert de sauvegarde lisible, d'historique, de point de restauration, et permet de recréer une boutique à partir d'un dossier.
- **Les agents** sont un paquet TypeScript `agents/` (pas dans `app/`), exécutable de deux façons :
  - par **GitHub Actions** (tâches planifiées et longues, jusqu'à plusieurs dizaines de minutes) ;
  - à la demande depuis l'admin, qui déclenche un `workflow_dispatch` GitHub (ou, pour les tâches courtes, une route API Vercel).
  Si tu juges qu'une file de tâches dédiée (Trigger.dev, Inngest) est plus robuste, propose-le avec les avantages et inconvénients avant de l'adopter.
- **File de tâches** en base (`agent_tasks`) : chaque agent consomme des tâches, en crée pour les autres agents, et écrit son résultat. L'orchestrateur répartit, relance en cas d'échec (3 essais, attente exponentielle) et respecte les budgets.
- **Modèles Claude** (configurables par agent dans l'admin) : `claude-haiku-5-5` pour le tri, la classification et les contrôles simples ; `claude-sonnet-5-5` pour la rédaction et l'analyse ; `claude-opus-5-5` pour l'orchestration, la stratégie et les décisions difficiles. Utilise l'outil de recherche web côté serveur de l'API Claude, le flux (streaming) pour les longues réponses, et des sorties structurées par outil avec schéma JSON. Si le Claude Agent SDK simplifie les boucles d'agents avec outils, utilise-le.

### 6. Le dossier `sites/` : une boutique = un dossier rangé par niche

```
sites/
  _modele/                      ← modèle de départ pour toute nouvelle boutique
  confort-hiver-bouillotte/     ← slug de la niche
    site.json                   ← identité, domaine, livraison, retours, légal, état
    theme.json                  ← couleurs, polices, arrondis, logo, favicon
    navigation.json             ← menus d'en-tête et de pied de page
    pages/
      accueil.json              ← liste ordonnée de blocs (voir §10)
      a-propos.json
      contact.json
    produits/
      bouillotte-graines-de-lin.json   ← fiche complète + source fournisseur
    collections/
    guides/
      comment-chauffer-une-bouillotte-seche.md   ← front-matter YAML + corps
    faq.json
    seo.json                    ← mots-clés visés, carte des contenus, redirections
    medias/                     ← images libres de droits ou fournies par le patron
    rapports/                   ← un rapport Markdown par semaine
    CHANGELOG.md                ← ce que chaque agent a modifié, quand et pourquoi
```

- L'**agent Archiviste** exporte chaque boutique de Supabase vers son dossier après chaque publication et chaque nuit, puis fait un commit (`chore(sites/<slug>): …`) via l'API GitHub.
- Commande `npm run site:import sites/<slug>` : recrée ou restaure une boutique en base à partir de son dossier.
- Les fichiers sont validés par des schémas Zod partagés avec l'application (`lib/schemas/`).

### 7. Modèle de données (Supabase)

Étends `supabase/schema.sql` par migrations numérotées (`supabase/migrations/NNN_nom.sql`). Tables minimales :

- **Boutiques** : `sites`, `themes`, `navigation`, `pages` (blocs JSON), `products`, `product_variants`, `collections`, `guides`, `faqs`, `redirects`, `media` (Supabase Storage), `domains` (état DNS/vérification Vercel), `shipping_zones`.
- **Ventes** : `orders`, `order_items`, `customers`, `refunds`, `supplier_orders`.
- **Veille** : `watch_stores` (boutiques surveillées), `watch_products` (produits observés, prix, date), `watch_ads` (publicités observées, durée de diffusion), `keywords` (volume, difficulté, SERP), `trend_signals`, `opportunities` (déjà présente : enrichis-la avec le détail du score).
- **Pilotage** : `metrics_daily` (par boutique et par jour : sessions, commandes, CA, bénéfice, clics et impressions Google, position moyenne, pages indexées), `gsc_queries_daily`, `gsc_pages_daily`, `recommendations` (impact, effort, statut, agent responsable), `reports` (quotidiens, hebdomadaires, mensuels).
- **Agents** : `agent_tasks` (file), `agent_runs` (journal, coût en jetons et en euros), `agent_settings` (modèle, budget, actif/inactif, planning), `approvals` (demandes en attente), `audit_log`, `versions` (historique de chaque entité modifiable, avec auteur humain ou agent).

Active RLS partout ; seul le serveur accède aux tables.

### 8. Les armées d'agents

Pour chaque agent : mission, déclencheur, entrées, outils, sorties, critères de qualité. Chaque armée a un **chef** (orchestrateur) qui découpe le travail, lance les sous-agents en parallèle quand c'est possible, et assemble le résultat.

#### Armée 1 : Veille (chaque matin, 6 h heure de Paris)

> Les tâches planifiées GitHub Actions sont en UTC : 6 h à Paris = `0 4 * * *` en heure d'été, `0 5 * * *` en heure d'hiver. Gère le changement d'heure (deux crons + vérification de l'heure locale, ou planification depuis l'orchestrateur).

**Chef de veille.** Planifie la collecte du jour, déduplique, transmet à l'Analyste, publie le résultat dans la page Veille et dans le rapport du matin.

1. **Agent Tendances** : signaux de demande en France. Sources par ordre de préférence : fournisseur de données de mots-clés et tendances (DataForSEO, SerpApi ou équivalent, clé en variable d'environnement), TikTok Creative Center, Pinterest Trends, palmarès publics des marketplaces via leurs API officielles ou un fournisseur sous licence. Sortie : `trend_signals` (terme, source, évolution sur 7/30/90 jours).
2. **Agent Publicités** : bibliothèque publicitaire Meta (API officielle Ad Library ; dans l'UE elle couvre toutes les publicités diffusées, accès à demander) et bibliothèque publicitaire TikTok. Signal fort : une publicité active depuis plus de 30 jours, déclinée en plusieurs versions. Sortie : `watch_ads`.
3. **Agent Boutiques** : découvre des boutiques indépendantes qui vendent les produits repérés (via les pages de destination des publicités et les résultats de recherche fournis par l'API SERP), puis, si le `robots.txt` le permet, lit leur catalogue public (par exemple `/products.json` sur les boutiques Shopify, ou le sitemap) pour relever : produits, prix, date d'ajout, fréquence des nouveautés, ruptures. Suit dans le temps les boutiques ajoutées à `watch_stores`. Sortie : `watch_stores`, `watch_products`. Les estimations de trafic viennent uniquement d'un fournisseur de données, marquées « estimation ».
4. **Agent SERP** : pour chaque requête candidate, qui occupe le top 10 de Google France ? Repère les faiblesses (forums, marketplaces, pages pauvres, contenus anciens), le volume et la difficulté. Sortie : `keywords`.
5. **Agent Fournisseurs** : trouve le produit chez des fournisseurs qui livrent en Europe (API CJ Dropshipping, BigBuy, programme AliExpress pour le dropshipping, selon les accès disponibles) : coût, délai vers la France, entrepôt européen, poids. Sortie : coût et délai estimés, lien fournisseur.
6. **Agent Conformité** : écarte les catégories interdites (§4), vérifie les risques de marque (nom de produit déposé), signale les obligations (marquage CE, notice en français).
7. **Agent Analyste** : calcule un score sur 100, explicable, par exemple :
   - demande (tendance + volume) 25 % ;
   - facilité à se classer (difficulté faible, SERP faible) 20 % ;
   - marge (prix marché − coût − port − frais) 20 % ;
   - preuves de vente (publicités longues, boutiques qui le vendent, nouveautés fréquentes) 15 % ;
   - logistique (stock UE, délai < 8 jours, léger, peu fragile) 10 % ;
   - potentiel de contenu (questions réelles à traiter en guides) 10 % ;
   - pénalités conformité.
   Il rédige une fiche par opportunité : produit, niche, pourquoi maintenant, recherches visées, concurrence, prix constaté, coût, marge, boutiques qui vendent déjà, sources, détail du score. 6 à 10 opportunités par jour, jamais deux fois la même.

#### Armée 2 : Construction (à la demande, depuis une opportunité)

**Chef de chantier.** Transforme une opportunité validée en boutique en ligne, en posant au patron **uniquement les questions utiles**, regroupées dans un questionnaire de l'admin, avec des propositions par défaut (s'il ne répond pas sous 24 h, les choix par défaut s'appliquent, sauf pour les dépenses).

Questions type, toujours avec 3 propositions cliquables et une option « autre » : nom et domaine ; palette de couleurs (aperçu en direct) ; polices ; ton (expert, chaleureux, minimaliste…) ; pages à créer ; produits à garder ; sujets des premiers guides ; livraison et retours ; images (fournisseur, à fournir, ou illustrations).

1. **Agent Stratège** : persona, positionnement, promesse, **carte des mots-clés** (un sujet pilier, des sous-sujets, une requête principale par page), arborescence du site, questionnaire.
2. **Agent Image de marque** : 3 noms + domaines `.fr` **disponibles** (vérification RDAP/WHOIS), 3 palettes avec contraste vérifié (WCAG AA minimum), choix de polices, logo texte en SVG, favicon.
3. **Agent Catalogue** : 8 à 15 produits cohérents, variantes, règle de prix (par exemple : coût × 2,5, minimum coût + 15 €, arrondi psychologique, puis contrôle par rapport au prix médian du marché), lien et coût fournisseur.
4. **Agent Rédacteur produits** : fiches originales (700 à 1 200 caractères, intertitres en questions, liste, points forts, caractéristiques sourcées, FAQ de 3 à 5 questions, titre et description pour Google).
5. **Agent Rédacteur pages** : accueil en blocs, à propos, contact, pages légales à partir des modèles et des informations du patron.
6. **Agent Rédacteur guides** : guide pilier et premiers guides satellites, réponse dès la première phrase, liens internes vers les produits.
7. **Agent Visuels** : récupère les images fournisseur dont l'usage est autorisé, les optimise (WebP/AVIF, recadrage, fond), écrit les textes alternatifs. Toute image générée par IA doit représenter fidèlement le produit et n'est jamais présentée comme une photo réelle du client.
8. **Agent Intégrateur** : écrit tout en base, crée le dossier `sites/<slug>/`, met la boutique en ligne sur une adresse d'aperçu (`<slug>.<domaine-admin>` ou équivalent).
9. **Agent Contrôle qualité** (porte obligatoire avant publication) : détecte les doublons et textes trop proches d'une source, les caractéristiques non sourcées, les promesses interdites, les liens cassés, les données structurées invalides, les pages trop lourdes (audit Lighthouse : performance et accessibilité ≥ 90 sur mobile). Bloque et renvoie au bon agent si besoin.
10. **Agent Domaines** : quand le patron a acheté le domaine, l'ajoute au projet Vercel par l'API (avec et sans `www`), affiche les enregistrements DNS exacts à créer chez le registraire, vérifie la propagation toutes les 10 minutes, confirme le certificat HTTPS, puis déclenche l'armée SEO.

Durée cible entre le clic « Construire » et la boutique en aperçu : moins de 10 minutes.

#### Armée 3 : SEO et GEO (en continu)

**Chef SEO.** Tient pour chaque boutique une liste d'actions priorisées et respecte les plafonds de publication (§4).

1. **Agent Technique** : index de sitemaps par boutique (pages, produits, guides, images), `robots.txt`, balises canoniques, redirections 301 automatiques à chaque changement d'adresse, page 404 utile, surveillance des erreurs, vitesse (Core Web Vitals), images optimisées, `hreflang` si une boutique passe en plusieurs langues.
2. **Agent Données structurées** : `Product`, `Offer` (livraison, retours), `FAQPage`, `BreadcrumbList`, `Article`, `Organization`/`OnlineStore` ; validation automatique ; correction des erreurs remontées par la Search Console et le Merchant Center.
3. **Agent FAQ** : ajoute et met à jour les questions fréquentes (boutique, produits, guides) à partir des requêtes réelles de la Search Console, des questions « autres questions posées » et des e-mails clients.
4. **Agent Maillage interne** : relie guides et produits, ancres variées, pas de page orpheline.
5. **Agent Contenu** (existe déjà) : un guide par semaine et par boutique sur une question réelle non couverte.
6. **Agent Rafraîchissement** : repère les pages avec beaucoup d'impressions mais peu de clics (réécrit titre et description), les pages qui reculent (met à jour le contenu), les positions 8 à 20 (renforce la page). Chaque changement est versionné et mesuré 14 jours plus tard.
7. **Agent GEO** : `llms.txt` à jour, formulations faciles à citer (réponse courte puis détail, chiffres sourcés), cohérence du nom et de la description de la marque partout. Chaque semaine, pose aux moteurs de réponse (via l'API Claude avec recherche web, et d'autres si accès) 10 questions types de la niche et note si la boutique est citée ; suit l'évolution.
8. **Agent Indexation** : soumet les sitemaps via l'API Search Console, vérifie l'état d'indexation des nouvelles pages (API d'inspection d'URL, en respectant le quota quotidien), prévient Bing par IndexNow, et alimente le Merchant Center (flux `feed.xml` ou Merchant API, vérifie la version en vigueur).

#### Armée 4 : Pilotage et rapports (chaque jour, 7 h 30 heure de Paris)

1. **Agent Collecteur** : chaque nuit, récupère par boutique les ventes (base + Stripe), les données Search Console (requêtes, pages, clics, impressions, position), l'état du Merchant Center, les visites (mesure d'audience sans cookie déjà conçue dans une version précédente, à réintégrer), les coûts (IA, publicité si elle existe). Écrit `metrics_daily`, `gsc_*_daily`.
2. **Agent Analyste** : calcule les indicateurs, compare à la veille, à la semaine et au mois précédents, détecte les anomalies (chute de ventes ou de trafic, conversion en baisse, rupture de stock, marge qui s'érode, page désindexée, erreurs de paiement).
3. **Agent Conseiller** : transforme l'analyse en **recommandations priorisées** (impact estimé en euros, effort, urgence), chacune avec un bouton « Appliquer » qui crée la tâche pour le bon agent (avec approbation si elle coûte de l'argent).
4. **Agent Rapporteur** : envoie chaque matin le rapport (e-mail via Resend ; Telegram en option), le publie dans l'admin, et produit un bilan hebdomadaire le lundi et un compte de résultat mensuel.

**Format du rapport quotidien** (court, lisible en 1 minute) :
```
Rapport du jeudi 16 octobre
Hier : 412 € de CA, 167 € de bénéfice estimé, 11 commandes (+18 % sur 7 jours)

Par boutique
  Bouillotte & Co   268 €  7 cmd   Google : 1 240 impressions (+31 %), position 14,2
  Germe & Co        144 €  4 cmd   Google : 610 impressions (+9 %), position 21,7

À faire aujourd'hui (3)
  1. 4 commandes à transmettre au fournisseur
  2. Ajouter les photos de 2 produits (Germe & Co)
  3. Approuver : passer le prix du kit à 29,90 € (marge +12 %)

Ce que les agents ont fait cette nuit
  Veille : 7 nouvelles opportunités (meilleure : 84/100, tapis de fouille chien)
  SEO : 3 titres réécrits, 1 guide publié, 12 pages vérifiées indexées

Alerte
  Germe & Co : clics Google en baisse de 22 % depuis 3 jours (page « kit micro-pousses »)
```

#### Le chef d'orchestre (au-dessus de tout)

**Agent Directeur.** Lit la file de tâches, applique la planification, répartit, surveille les budgets et les échecs, relance, demande les approbations, coupe un agent qui dérape (coût, erreurs répétées), et tient à jour la page **Agents** de l'admin (qui tourne, ce que ça coûte, ce qui attend une décision).

### 9. Agents complémentaires (à proposer au patron, à activer un par un)

Construis-les après les phases principales, chacun désactivé par défaut :

- **Commandes fournisseur** : transmet automatiquement chaque commande payée au fournisseur par son API, récupère le numéro de suivi, prévient le client. Seuil d'approbation au-delà d'un montant.
- **Service client** : lit la boîte de réception de chaque boutique, classe (suivi, retour, question produit), prépare une réponse que le patron valide d'un clic (envoi automatique seulement pour les questions de suivi).
- **Prix et marge** : surveille le coût fournisseur et les prix concurrents, propose des ajustements de prix (avec approbation).
- **Avis clients** : demande un avis réel après livraison, publie uniquement les avis réels (balisage `Review` seulement pour des avis vérifiés).
- **E-mails marketing** : panier abandonné, relance de commande, lettre d'information, uniquement avec consentement.
- **Réseaux sociaux** : épingles Pinterest à partir des produits et guides, idées de vidéos courtes ; publication avec approbation.
- **Publicité** : prépare des campagnes Google Shopping et Meta sur les produits qui convertissent déjà ; aucune dépense sans approbation, plafond quotidien strict, arrêt automatique si le coût par vente dépasse la marge.
- **Traduction et expansion** : décline une boutique gagnante pour la Belgique, la Suisse, le Canada, puis d'autres langues (avec `hreflang` et adaptation, pas une traduction brute).
- **Comptabilité** : export mensuel des ventes et de la TVA pour le comptable, alerte sur les seuils de la micro-entreprise et de franchise de TVA.
- **Risques** : surveille les litiges et rétrofacturations Stripe, les commandes suspectes, les produits signalés.
- **Revente** : quand une boutique a 6 mois d'historique rentable, prépare le dossier (chiffres, trafic, actifs) pour une éventuelle revente.

### 10. L'admin : modifier absolument tout

Interface sobre (style admin Shopify : barre du haut, menu latéral, cartes blanches). Menu principal limité : **Aujourd'hui** (rapport + à faire + approbations), **Ventes**, **Commandes**, **Veille**, **Boutiques**, **Agents**, **Réglages**. Tout le reste est accessible depuis la fiche d'une boutique.

**Fiche boutique, onglets :**
- **Aperçu** : chiffres de la boutique, position Google, état d'indexation, recommandations.
- **Thème** : couleurs, polices, arrondis, espacements, logo, favicon, avec **aperçu en direct** à côté (iframe de la boutique).
- **Pages** : liste des pages, **éditeur par blocs** glisser-déposer. Blocs disponibles : bandeau d'accueil, texte, texte + image, grille de produits, collection, avantages, FAQ, avis (réels uniquement), comparatif, guides récents, bannière, vidéo, inscription newsletter, HTML personnalisé (assaini). Chaque bloc a ses champs, ses variantes d'affichage et ses réglages mobile.
- **Navigation** : menus d'en-tête et de pied de page.
- **Produits**, **Collections**, **Guides** (éditeur Markdown avec aperçu), **FAQ**, **Pages légales**.
- **Médias** : bibliothèque d'images (envoi, recadrage, texte alternatif).
- **SEO** : titres et descriptions par page, redirections, mots-clés visés, sitemap, robots, `llms.txt`, données structurées (aperçu).
- **Domaine** : état DNS, enregistrements à créer, certificat.
- **Livraison, paiement, e-mails** : zones, tarifs, délais, modèles d'e-mails.
- **Avancé** : CSS personnalisé et code dans `<head>` (avec avertissement), export/import du dossier `sites/<slug>/`, duplication de boutique (avec contenu à réécrire), suppression (avec approbation).
- **Historique** : toutes les versions, qui a modifié quoi (patron ou agent), bouton « Restaurer ».

**Barre « Demander à l'agent »** présente sur chaque écran : le patron écrit en français (« mets les boutons en vert sapin », « ajoute une FAQ sur l'entretien à la fiche bouillotte », « crée une page comparatif »). L'**agent Éditeur** propose les changements sous forme d'aperçu avant/après ; le patron clique « Appliquer » ; la modification est versionnée.

**Édition en masse** : modification groupée (prix, statut, catégorie), import/export CSV.

**Accès** : connexion par lien magique ou mot de passe + double authentification (Supabase Auth) ; rôle unique « propriétaire » au départ, rôles « éditeur » et « lecture seule » prévus.

### 11. Automatisation GitHub et Vercel

Écris un agent **DevOps** et une commande `npm run setup` qui, à partir de jetons fournis par le patron (`GITHUB_TOKEN` avec droit de création de dépôt, `VERCEL_TOKEN`, identifiants Supabase et Stripe) :

1. crée le dépôt GitHub privé s'il n'existe pas, pousse le code ;
2. crée le projet Vercel lié au dépôt, configure les variables d'environnement, déploie ;
3. configure les secrets GitHub Actions et les workflows planifiés (`.github/workflows/veille.yml`, `seo.yml`, `rapport.yml`, `contenu.yml`, `archive.yml`) ;
4. applique les migrations Supabase ;
5. affiche un récapitulatif : adresse de l'admin, état de chaque service, ce qui reste à faire.

Vérifie les points d'accès exacts dans la documentation officielle de l'API Vercel et de l'API GitHub au moment d'écrire le code (ne te fie pas à ta mémoire pour les numéros de version des routes).

Le patron ne fait que : acheter les domaines, coller les jetons, cliquer « Ajouter ce domaine » dans l'admin.

### 12. Coûts et budgets

- Chaque exécution enregistre ses jetons d'entrée et de sortie, ses recherches web et son coût estimé en euros dans `agent_runs`.
- Page **Agents** : coût du jour, du mois, par agent et par boutique ; plafonds modifiables ; alerte à 80 % du budget mensuel.
- Utilise la mise en cache des invites (prompt caching) pour les consignes systèmes longues et répétées, et le traitement par lots (Batch API) pour les tâches non urgentes de la nuit.

### 13. Qualité, tests, observabilité

- Tests unitaires (Vitest) pour le calcul du score, les prix, les schémas, les droits d'accès ; tests de bout en bout (Playwright) pour : créer une boutique en mode démo, modifier un bloc, passer une commande Stripe en test, recevoir le rapport.
- Un **mode démo** complet sans aucune clé (données fictives, agents simulés) pour tout tester en local.
- Faux serveur Claude pour les tests des agents (réponses enregistrées), afin de ne pas dépenser à chaque test.
- Journal structuré, suivi des erreurs (Sentry ou équivalent), alerte e-mail si un agent planifié échoue deux jours de suite.

### 14. Plan de réalisation par phases

À la fin de chaque phase : tests verts, captures d'écran, courte note « ce qui marche / ce qui reste », puis **attends ma validation**.

| Phase | Contenu | Terminé quand |
|---|---|---|
| 0 | Lecture du dépôt, `docs/ARCHITECTURE.md`, migrations, paquet `agents/`, file de tâches, Directeur minimal, budgets, arrêt d'urgence | Un agent factice passe par la file, est journalisé et respecte un budget |
| 1 | DevOps : `npm run setup`, GitHub Actions, déploiement Vercel, agent Domaines | Le site est en ligne sur Vercel, un domaine de test s'ajoute depuis l'admin |
| 2 | Dossier `sites/<slug>/`, schémas, Archiviste, import/restauration | Une boutique fait l'aller-retour base → dossier → base à l'identique |
| 3 | Admin « tout modifier » : thème, pages par blocs, navigation, médias, SEO, historique, barre « Demander à l'agent » | Chaque élément visible d'une boutique est modifiable et restaurable |
| 4 | Armée Veille complète avec sources réelles (selon les accès disponibles) et score expliqué | 6 opportunités sourcées chaque matin à 6 h |
| 5 | Armée Construction complète avec questionnaire et contrôle qualité | Une boutique passe de l'opportunité à l'aperçu en moins de 10 minutes, contrôle qualité réussi |
| 6 | Armée SEO/GEO + intégration Search Console, Merchant Center, IndexNow | Sitemaps soumis, état d'indexation suivi, actions SEO hebdomadaires mesurées |
| 7 | Armée Pilotage : collecte, analyse, recommandations, rapport quotidien | Le rapport arrive chaque matin à 7 h 30 avec des actions applicables en un clic |
| 8 | Agents complémentaires (§9), un par un, sur demande | Chaque agent activable, désactivable, avec budget |

### 15. Comment travailler avec moi

- Pose-moi tes questions **groupées**, au début de chaque phase, uniquement quand une décision m'appartient (argent, juridique, goût). Pour le reste, choisis la solution standard et écris ton choix dans `docs/DECISIONS.md`.
- Explique-moi tout en français simple, sans jargon.
- Quand un accès me manque (clé API, compte fournisseur, accès Meta Ad Library), dis-moi exactement où le créer et quoi te donner, et continue le reste en attendant (mode démo pour la partie bloquée).
- Ne prétends jamais qu'une chose fonctionne sans l'avoir testée. Si tu n'as pas pu tester une intégration réelle, dis-le.

## FIN DU PROMPT
