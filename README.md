# Multiboutique

Vos boutiques en ligne, votre tableau de bord, et des agents qui travaillent pour vous.

- **Les boutiques** : chaque nom de domaine affiche sa propre boutique (nom, couleurs, produits, guides, pages légales). Pages rapides, rendues côté serveur, optimisées pour Google et les moteurs IA.
- **L'admin** (`/admin`) :
  - **Aujourd'hui** : le rapport du matin (chiffres d'hier, à faire, alertes, idées pour gagner plus), calculé sans IA payante ;
  - **QG des agents** : la ville 3D de vos boutiques (hauteur des bâtiments = chiffre d'affaires sur 30 jours), les agents qui circulent vers ce sur quoi ils travaillent, et les terrains à bâtir (idées de la veille) ;
  - **Ventes**, **Commandes**, **Boutiques** (avec une page d'analyse par boutique : ventes, visites, parcours d'achat, sources dont les assistants IA, pages les plus vues) ;
  - **Veille** : les idées à trier en cartes (écarter, garder, lancer) ;
  - **Agents** : le journal de chaque exécution.
- **Commandes fournisseur automatiques** (CJ Dropshipping) : chaque commande payée part seule chez le fournisseur, et les numéros de suivi reviennent chaque jour aux clients.
- **Les agents** (Claude, avec recherche web) :
  - **Veille**, chaque matin : niches et produits porteurs, boutiques qui les vendent déjà, recherches Google à viser.
  - **Construction**, à la demande : vous répondez à quelques questions (niche, nom, couleurs, produits, guides, livraison), l'agent écrit toute la boutique et cherche les fournisseurs.
  - **Contenu**, chaque lundi : un nouveau guide par boutique, sur une question que les gens posent et que vous ne couvrez pas encore.
- **Le paiement** : Stripe. **La base** : Supabase. **L'hébergement** : Vercel.

Sans configuration, tout tourne en **mode démo** (données et agents fictifs), pour essayer le parcours complet.

---

## 1. Essayer en local

Il vous faut [Node.js](https://nodejs.org) 20 ou plus.

```bash
npm install
npm run dev
```

Puis, dans Chrome, Firefox ou Edge :

| Adresse | Ce que vous voyez |
|---|---|
| http://localhost:3000/admin | L'admin (mot de passe : `demo`) |
| http://bocal.localhost:3000 | La boutique de démo « Bocal & Cie » |
| http://chat.localhost:3000 | La boutique de démo « Chat Perché » |

Les données de démo sont dans `.data/demo-db.json` ; supprimez ce fichier pour repartir de zéro.

---

## 2. Mettre en ligne

### a. Supabase (la base de données)

1. Créez un projet sur [supabase.com](https://supabase.com) (région Europe).
2. **SQL Editor > New query** : collez `supabase/schema.sql`, puis **Run**. (Si vous aviez installé une version précédente, exécutez seulement les parties ajoutées depuis, en bas du fichier.)
3. **Project Settings > API** : notez l'URL du projet et la clé **service_role** (secrète).

### b. Vercel (l'hébergement)

1. Mettez ce dossier sur GitHub (dépôt privé), puis sur [vercel.com](https://vercel.com) : **Add New > Project**.
2. Ajoutez les variables du fichier `.env.example`, au minimum : `ADMIN_PASSWORD`, `ADMIN_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`.
3. **Deploy**. L'admin est sur `https://votre-projet.vercel.app/admin`.

Les tâches planifiées sont déclarées dans `vercel.json` : veille (6 h à Paris), suivi des colis et rapport (7 h), guides (lundi 8 h). Vercel les active au déploiement. Sur l'offre gratuite Hobby, chaque tâche tourne une fois par jour, à l'heure près.

### Coûts avec un budget à 0 €

Gratuit : Vercel Hobby, Supabase (offre gratuite), GitHub, CJ Dropshipping, Telegram, rapport du matin, commandes automatiques, mesure d'audience. Payant mais incontournable : les noms de domaine (environ 10 € par an chacun) et les frais Stripe sur chaque vente. Les agents qui écrivent (veille, construction, guides) utilisent l'API Claude, qui est payante : sans clé, ils tournent en mode démo.

### c. Les agents (clé Claude)

1. Créez une clé sur [console.anthropic.com](https://console.anthropic.com) et mettez-la dans `ANTHROPIC_API_KEY`.
2. Ordre de grandeur : une veille ou une construction de boutique coûte quelques dizaines de centimes (texte généré + une dizaine de recherches web à 0,01 $ chacune). Suivez la consommation dans la console Anthropic.
3. Le journal de chaque exécution est dans **Agents**.

### d. Les noms de domaine

Pour chaque boutique : achetez le domaine, ajoutez-le dans Vercel (**Settings > Domains**, avec et sans `www`), et vérifiez qu'il est bien renseigné dans l'admin (**Boutiques > Réglages**).

### e. Stripe (le paiement)

1. Compte [stripe.com](https://stripe.com), d'abord en **mode test** : clé `sk_test_...` dans `STRIPE_SECRET_KEY`.
2. **Développeurs > Webhooks** : URL `https://un-de-vos-domaines/api/stripe/webhook`, événements `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`. Secret `whsec_...` dans `STRIPE_WEBHOOK_SECRET`.
3. Testez avec la carte `4242 4242 4242 4242`, puis passez en clés réelles.

### f. Commandes automatiques (CJ Dropshipping)

1. Compte gratuit sur [cjdropshipping.com](https://cjdropshipping.com), puis **My CJ > Authorization > API** : générez une clé et mettez-la dans `CJ_API_KEY`.
2. Pour chaque produit, renseignez dans l'admin l'**identifiant de variante CJ (vid)** et le pays de l'entrepôt (un entrepôt européen livre bien plus vite).
3. Alimentez votre solde CJ (`CJ_PAY_MODE=balance`) pour que les commandes soient payées sans vous. Sinon, `manual` : elles sont créées chez CJ et vous les payez dans votre compte.
4. Au-delà de `AUTO_FULFILL_MAX_CENTS` de coût fournisseur (150 € par défaut), la commande attend votre approbation dans l'admin.
5. Les numéros de suivi sont récupérés chaque matin (bouton « Synchroniser le suivi » pour le faire tout de suite) et envoyés aux clients.

### g. Rapport du matin

Il est calculé chaque matin vers 7 h à partir de vos chiffres (aucun coût). Pour le recevoir ailleurs que dans l'admin : `REPORT_EMAIL` + `REPORT_FROM` (via Resend), et/ou `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (bot créé avec @BotFather).

### h. E-mails clients (facultatif)

Compte [Resend](https://resend.com) avec vos domaines vérifiés, puis `RESEND_API_KEY` : confirmation de commande et numéro de suivi envoyés automatiquement.

---

## 3. Être visible vite : ce qui est réaliste

Aucune boutique neuve n'arrive en première page Google en une semaine sur une recherche disputée (« fontaine à eau chat »). Google met en général plusieurs semaines, souvent quelques mois, à faire confiance à un nouveau domaine. Ce qu'on peut obtenir vite :

| Délai | Ce qui est atteignable | Ce que fait le projet |
|---|---|---|
| 1 à 3 jours | Pages découvertes et indexées | Sitemap, IndexNow (Bing) à chaque publication |
| 2 à 7 jours | Produits visibles dans l'onglet **Shopping** de Google (gratuit) | Flux `https://votre-domaine/feed.xml` à déclarer dans Google Merchant Center |
| 1 à 4 semaines | Première page sur des recherches **très précises** (ex. « comment chauffer une bouillotte sèche ») | La veille choisit des niches peu disputées, les guides visent ces questions |
| 1 à 3 mois | Positions sur des recherches plus larges | Un nouveau guide chaque semaine, liens internes vers les produits |
| Immédiat | Première page, mais payante | Google Ads Shopping sur le même flux produits |

Les gestes à faire une fois par boutique :

1. **Google Search Console** : ajoutez le domaine, puis envoyez `https://votre-domaine/sitemap.xml` (menu Sitemaps).
2. **Google Merchant Center** : créez le compte, puis **Produits > Flux > Récupération planifiée** avec `https://votre-domaine/feed.xml`. Seuls les produits avec une vraie photo sont envoyés.
3. **IndexNow** : mettez une clé de 32 caractères (lettres a à f et chiffres) dans `INDEXNOW_KEY`. Le fichier de vérification est servi automatiquement.
4. **Photos** : ajoutez vos propres photos sur chaque fiche. C'est la seule chose que l'agent ne peut pas faire à votre place.

---

## 4. Qui fait quoi

**Vous**
- Choisir une niche dans **Veille** (ou proposer la vôtre) et répondre aux questions de **Créer une boutique**.
- Ajouter les photos, vérifier prix d'achat et lien fournisseur de chaque produit.
- Acheter le domaine et faire les déclarations Google (une fois par boutique).
- Transmettre les commandes au fournisseur (lien direct dans chaque commande), puis saisir le numéro de suivi.

**Les agents**
- Trouver chaque jour de nouvelles opportunités, avec leurs sources.
- Écrire les textes de la boutique, les fiches produits, la FAQ et les premiers guides.
- Publier un guide par boutique chaque semaine et prévenir les moteurs.

Les agents s'inspirent de ce qui marche (produits, prix, angles) mais ne copient jamais les textes, photos ou marques d'un concurrent : c'est illégal, et Google ignore le contenu dupliqué.

---

## 5. Avant d'ouvrir une boutique au public

- [ ] Informations légales complètes (**Boutiques > Réglages** : SIRET, adresse, médiateur de la consommation).
- [ ] CGV, mentions légales et confidentialité relues (modèles générés à partir de vos informations).
- [ ] Produits conformes aux normes européennes (marquage CE pour l'électronique et les jouets, notamment).
- [ ] Délais de livraison réalistes par rapport au fournisseur.
- [ ] Une commande test de bout en bout avec Stripe en mode test.

---

## Organisation du code

```
app/[host]/                 Les boutiques (le dossier [host] reçoit le nom de domaine)
  feed.xml/                 Flux Google Shopping
  sitemap.xml/, robots.txt/, llms.txt/
app/admin/                  L'admin (protégé par mot de passe)
  (panel)/page.tsx          Aujourd'hui (rapport du matin)
  (panel)/qg/               Ville 3D des boutiques et des agents
  (panel)/ventes/           Ventes
  (panel)/boutiques/[id]/apercu/  Analyse d'une boutique
  (panel)/veille/           Résultats de la veille
  (panel)/boutiques/creer/  Assistant de création de boutique
  (panel)/agents/           Agents et journal
app/api/cron/               Tâches planifiées (veille, contenu)
app/api/checkout            Paiement Stripe
app/api/stripe/webhook      Paiements et remboursements
lib/agents/                 Les agents (veille, construction, contenu)
lib/fulfillment.ts          Commandes fournisseur automatiques et suivi
lib/suppliers/cj.ts         Connexion à CJ Dropshipping
lib/report.ts               Rapport du matin
lib/db/                     Accès aux données (Supabase ou démo)
supabase/schema.sql         Tables de la base
vercel.json                 Planification des agents
```
