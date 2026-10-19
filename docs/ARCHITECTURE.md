# Architecture de Multiboutique

Ce document explique comment le projet est construit, en français simple. Il sert de carte : où se trouve chaque chose, et ce qui se passe quand un client commande ou quand un agent travaille.

## En une phrase

Une seule application Next.js affiche **toutes les boutiques** (une par nom de domaine) et **l'admin**. Les données vivent dans **Supabase** (ou dans un fichier local en mode démo), le paiement passe par **Stripe**, l'hébergement et les tâches planifiées par **Vercel**, les commandes fournisseur par **CJ Dropshipping**, et les textes des agents sont écrits par **Claude** (API Anthropic).

```
 Client (navigateur)                    Propriétaire
        │                                     │
 bocal-et-cie.fr / chat-perche.fr      n'importe-quel-domaine/admin
        │                                     │
        └──────────────► middleware.ts ◄──────┘
                              │
              ┌───────────────┴────────────────┐
        app/[host]/ (boutiques)          app/admin/ (admin)
              │                                │
              └──────────► lib/ ◄──────────────┘
                 db (Supabase ou démo), orders, fulfillment,
                 report, analytics, agents, env…
                              │
     ┌──────────┬─────────────┼─────────────┬──────────────┐
  Supabase    Stripe   CJ Dropshipping   Anthropic   Resend / Telegram / IndexNow
```

## Les dossiers

| Dossier ou fichier | Rôle |
|---|---|
| `middleware.ts` | Aiguillage. Lit le nom de domaine de chaque visite : `/admin` part vers l'admin (après vérification de la session), tout le reste est réécrit vers `app/[host]/…` avec le domaine en paramètre. Redirige `www.` vers le domaine nu. L'adresse d'aperçu `/apercu/<id>/…` est réécrite vers `app/apercu~<id>/…` (jamais indexée : en-tête `X-Robots-Tag`). |
| `app/[host]/` | **Les boutiques.** `[host]` reçoit le domaine ; `lib/sites.ts` retrouve la boutique correspondante. Accueil, `produits/`, `guides/`, `panier/`, `merci/`, pages légales (`[page]/` + `legal.ts`), `sitemap.xml`, `robots.txt`, `llms.txt`, `feed.xml` (Google Merchant Center). |
| `app/admin/` | **L'admin.** `login/` (mot de passe), `(panel)/` pour toutes les pages derrière la connexion : Aujourd'hui (`page.tsx`), `ventes/`, `commandes/`, `veille/`, `boutiques/` (fiche boutique avec ses onglets : `[id]/apercu/` (analyse), `[id]/` (réglages), `[id]/domaine/` ; assistant `creer/`), `produits/`, `guides/`, `agents/`, `reglages/services/`. `actions.ts`, `agent-actions.ts` et `domain-actions.ts` contiennent les actions serveur (enregistrer, rembourser, lancer un agent…). |
| `app/api/` | Points d'entrée techniques : `checkout` (crée le paiement Stripe), `stripe/webhook` (Stripe confirme les paiements), `collect` (mesure d'audience), `cron/*` (tâches planifiées). |
| `components/` | Éléments partagés des boutiques : panier (`cart.tsx`, `CartView.tsx`, `AddToCart.tsx`), fiches (`ProductBits.tsx`), mesure d'audience (`track.ts`), contexte de la boutique et liens internes qui gardent le préfixe d'aperçu (`store.tsx`). |
| `lib/db/` | **Accès aux données.** `types.ts` décrit l'interface `Db` ; `supabase.ts` l'implémente avec Supabase, `demo.ts` avec un fichier JSON local ; `index.ts` choisit l'une ou l'autre ; `seed.ts` contient les boutiques de démonstration. |
| `lib/` (reste) | La logique métier : `orders.ts` (prix du panier, enregistrement d'une commande), `fulfillment.ts` + `suppliers/cj.ts` (fournisseur), `report.ts` (rapport du matin), `stats.ts` (chiffres des pages Ventes), `analytics.ts` (sources de visites), `seo.tsx` (données structurées), `richtext.tsx` (mise en forme des textes), `email.ts` (Resend et Telegram), `indexnow.ts`, `sitemap.ts` (adresses publiques d'une boutique), `store-path.ts` (adresse d'aperçu), `domains.ts` + `vercel.ts` (agent Domaines et API Vercel), `env.ts` (vérification des variables d'environnement), `auth.ts` + `admin.ts` (session admin). |
| `lib/agents/` | Les agents IA : `claude.ts` (appel à l'API avec recherche web et résultat structuré), `run.ts` (journal d'exécution), `veille.ts`, `builder.ts` (construction de boutique), `content.ts` (guides hebdomadaires). |
| `supabase/` | `schema.sql` (installation neuve complète) et `migrations/` (mises à jour numérotées, appliquées par `npm run db:migrate`). |
| `scripts/` | Scripts lancés à la main : `setup.mjs` (+ `setup-lib.mjs`, installation guidée `npm run setup`), `db-migrate.mjs`, `seed-supabase.mjs` (copie la démo dans Supabase). |
| `tests/` | `unit/` (Vitest : calculs) et `e2e/` (Playwright : parcours dans un vrai navigateur, en mode démo). |
| `vercel.json` | Les tâches planifiées (heures en UTC). |
| `.github/workflows/ci.yml` | Vérifications automatiques à chaque envoi sur GitHub. |
| `docs/` | Cette documentation, l'avancement, les décisions, les prompts par phase. |

## Le flux d'une commande

```
Panier (navigateur) ─► /api/checkout ─► Stripe Checkout ─► client paie
                                                              │
        ┌─────────────────────────────────────────────────────┘
        ▼
/api/stripe/webhook ─► commande enregistrée ─► e-mail de confirmation
                                │
                                └─(après la réponse)─► envoi chez CJ ─► …chaque jour : suivi ─► e-mail « expédiée »
```

1. **Panier.** Le panier est gardé dans le navigateur (`localStorage`, un par boutique). Les prix qu'il affiche sont indicatifs.
2. **Paiement.** « Payer la commande » appelle `POST /api/checkout`. Le serveur **recalcule tout** à partir de la base (`priceCart` dans `lib/orders.ts`) : prix, stock, livraison offerte au-delà du seuil. Il crée une session Stripe Checkout et renvoie son adresse ; le client paie sur la page Stripe.
   - En mode démo (sans clé Stripe), le paiement est simulé : la commande est créée tout de suite et le client arrive sur `/merci`.
3. **Confirmation.** Stripe appelle `POST /api/stripe/webhook` (signature vérifiée). Si la commande existe déjà pour cette session, rien ne se passe (Stripe peut envoyer deux fois le même événement). Sinon `recordPaidOrder` crée la commande (statut « Payée »), baisse le stock, envoie l'e-mail de confirmation (Resend) et rafraîchit les pages.
4. **Fournisseur.** Juste après, sans faire attendre le client, `fulfillOrder` (`lib/fulfillment.ts`) envoie la commande chez CJ si tous les produits ont un identifiant de variante CJ et si le coût reste sous `AUTO_FULFILL_MAX_CENTS`. Une commande CJ est créée par entrepôt de départ, avec le transporteur le moins cher qui livre en moins de 12 jours. Sinon la commande attend dans l'admin (« À approuver » ou « À envoyer à la main », avec le motif). En mode démo, l'envoi est simulé (`DEMO-<numéro>`).
5. **Suivi.** Chaque matin, la tâche `/api/cron/suivi` interroge CJ : dès qu'un numéro de suivi apparaît, la commande passe « Expédiée » et le client reçoit un e-mail ; puis « Livrée ».
6. **Remboursement.** Depuis l'admin (bouton sur la commande) ou depuis Stripe : l'événement `charge.refunded` passe la commande en « Remboursée » et remet le stock.

## Le flux des agents

Chaque exécution d'agent est notée dans la table `agent_runs` (titre, journal ligne par ligne, résultat, erreur) et visible dans **Agents**. `lib/agents/run.ts` s'en occupe : `startInBackground` (bouton dans l'admin : la page répond tout de suite) ou `runNow` (tâches planifiées).

| Agent | Déclenchement | Ce qu'il fait | Ce qu'il écrit |
|---|---|---|---|
| **Veille** (`veille.ts`) | Chaque jour (`/api/cron/veille`) ou bouton « Lancer une veille » | Cherche sur le web des niches et produits porteurs, avec sources et boutiques exemples, en évitant celles déjà proposées | Table `opportunities` (cartes à trier dans **Veille**) |
| **Construction** (`builder.ts`) | Assistant **Créer une boutique** (souvent depuis une carte « Lancer ») | 1) propose noms, couleurs, produits, guides ; 2) écrit la boutique, les fiches produits (avec recherche fournisseur) et les premiers guides | `sites`, `products`, `guides` ; la carte de veille passe « Lancée » ; IndexNow prévenu |
| **Contenu** (`content.ts`) | Chaque lundi (`/api/cron/contenu`) ou bouton | Un guide par boutique, sur une question réelle pas encore couverte | `guides` (publié ou brouillon selon `AGENT_AUTOPUBLISH`) ; IndexNow |
| **Suivi des colis** (`fulfillment.ts`) | Chaque jour (`/api/cron/suivi`) | Récupère les numéros de suivi chez CJ | `orders` |
| **Domaines** (`lib/domains.ts`, sans IA) | Boutons de l'onglet **Domaine** ; chaque jour (`/api/cron/domaines`) | Ajoute le domaine et `www` au projet Vercel, lit les DNS recommandés, vérifie DNS, propriété et HTTPS ; à la mise en ligne, signale le sitemap à IndexNow | `settings` (`domaine:<id>`) ; ligne « Déclarer le domaine… » et alerte « ne répond plus » dans le rapport |
| **Rapport du matin** (`report.ts`, sans IA) | Chaque jour (`/api/cron/rapport`) | Chiffres d'hier, à faire, alertes, idées | `reports` ; envoi e-mail et Telegram |

Sans clé `ANTHROPIC_API_KEY`, les agents IA tournent en **mode démo** (exemples fictifs, aucun coût). Les appels à Claude passent tous par `lib/agents/claude.ts` : une recherche web limitée en nombre, puis un « outil » dont le schéma impose la forme du résultat.

Les tâches planifiées sont protégées par `CRON_SECRET` (Vercel l'envoie automatiquement). Leurs heures, dans `vercel.json`, sont en UTC : 4 h UTC = 6 h à Paris en été, 5 h en hiver.

## Où vit chaque donnée

Toute lecture ou écriture passe par l'interface `Db` (`lib/db/types.ts`), qui existe en deux versions : **Supabase** (dès que `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont définies) et **démo** (fichier `.data/demo-db.json`, recréé s'il est supprimé). Toute nouvelle donnée doit exister dans les deux.

| Donnée | Table Supabase | Remarques |
|---|---|---|
| Boutiques (nom, domaine, couleurs, infos légales, livraison, FAQ) | `sites` | Thème, légal et livraison en JSON |
| Produits | `products` | `cost_cents` (prix d'achat) n'est jamais affiché ; `supplier_variant_id` = « vid » CJ ; `stock` vide = non suivi |
| Guides | `guides` | Texte en format simple (`##`, `-`, `**gras**`, liens) |
| Commandes | `orders` | Articles copiés au moment de l'achat (prix, coût, fournisseur) ; état fournisseur dans `supplier_*` |
| Idées de la veille | `opportunities` | Statut : nouvelle, retenue, écartée, lancée |
| Journal des agents | `agent_runs` | |
| Audience | `analytics_daily` (+ `analytics_visitors`, effacée au bout de 2 jours) | Un compteur par boutique et par jour ; ni cookie ni adresse IP conservée |
| Rapports du matin | `reports` | Un par jour |
| Réglages techniques | `settings` | Ex. jeton d'accès CJ ; état du domaine de chaque boutique (clé `domaine:<id>` : enregistrements DNS, étapes, date de mise en ligne, déclaration Google faite) |
| Version du schéma | `schema_migrations` | Migrations déjà appliquées |

Ce qui n'est **pas** dans la base :

- Le **panier** : dans le navigateur du client.
- Les **paiements** et remboursements : chez Stripe (la base garde l'identifiant de session).
- Les **secrets** : variables d'environnement (Vercel, `.env.local`), jamais dans le code ni dans Git. La page **Réglages > État des services** dit ce qui est configuré, sans rien afficher de secret.
- Les **images de démo** : `public/demo/`. Les vraies photos : adresses externes (Supabase Storage prévu en phase 2).

Sécurité de la base : la sécurité au niveau des lignes (RLS) est activée sur toutes les tables, sans aucune règle d'accès. Personne ne peut donc les lire depuis un navigateur ; le site y accède uniquement côté serveur avec la clé `service_role`.

## Mettre à jour la base

- **Installation neuve** : coller `supabase/schema.sql` dans Supabase (SQL Editor). Ce fichier contient toutes les migrations et les marque comme appliquées.
- **Base existante** : `npm run db:migrate` applique les fichiers de `supabase/migrations/` qui manquent (il faut `SUPABASE_DB_URL`). `npm run db:migrate -- --liste` affiche l'état sans rien changer.
- **Nouvelle migration** : créer `supabase/migrations/NNN_nom.sql` (rejouable sans risque si possible : `if not exists`), puis recopier son contenu dans `schema.sql` et ajouter sa version dans le `insert into schema_migrations` final. Un test vérifie que c'est fait.

## Vérifier que tout marche

| Commande | Ce qu'elle vérifie |
|---|---|
| `npm run typecheck` | Les types TypeScript |
| `npm run lint` | Les règles de code (ESLint, configuration Next.js) |
| `npm test` | Les calculs : statistiques, rapport du matin, prix et livraison, mise en forme des textes, sources de visites, variables d'environnement, migrations, adresse d'aperçu, agent Domaines (API Vercel simulée), fonctions de `npm run setup` |
| `npm run test:e2e` | Dans un vrai navigateur, en mode démo : connexion à l'admin, commande de bout en bout jusqu'à l'envoi fournisseur simulé, tri d'une carte de veille, page État des services, navigation et commande sur l'adresse d'aperçu, ajout d'un domaine jusqu'à « En ligne » |
| `npm run rendu` | Test de rendu d'une boutique exemple (Bocal & Cie) et de l'admin, sur ordinateur (1440 px) et mobile (Pixel 7) : aucun débordement, images chargées, couleurs du thème, un titre principal, liens nommés, aucune erreur ; une capture par page dans `rendu/` et une planche `rendu/index.html`. Pas lancé par la CI (les captures dépendent du système). |
| `npm run build` | La compilation de production |

La CI GitHub (`.github/workflows/ci.yml`) lance tout cela à chaque envoi de code.
