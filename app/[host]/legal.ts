// Modèles de pages légales générés à partir des informations de la boutique (admin > Boutiques).
// Ce sont des bases de travail : faites-les relire avant d'ouvrir la boutique au public.
import type { Site } from "@/lib/types";
import { money } from "@/lib/format";

const COUNTRY: Record<string, string> = { FR: "France", BE: "Belgique", CH: "Suisse", LU: "Luxembourg", DE: "Allemagne", ES: "Espagne", IT: "Italie", NL: "Pays-Bas" };
const countries = (s: Site) => s.shipping.countries.map((c) => COUNTRY[c] ?? c).join(", ");
const vatLine = (s: Site) =>
  s.legal.vat ? `N° de TVA intracommunautaire : ${s.legal.vat}.` : "TVA non applicable, article 293 B du Code général des impôts.";
const mediator = (s: Site) =>
  s.legal.mediator || "[à compléter : nom, adresse et site internet du médiateur de la consommation auquel vous avez adhéré]";
const shippingLine = (s: Site) =>
  `Les frais de livraison sont de ${money(s.shipping.flat_cents)}${
    s.shipping.free_from_cents > 0 ? `, offerts dès ${money(s.shipping.free_from_cents)} d'achat` : ""
  }. Le délai indicatif est de ${s.shipping.delay} après validation du paiement.`;

export const LEGAL_PAGES: Record<string, { title: string; description: (s: Site) => string; body: (s: Site) => string }> = {
  "livraison-retours": {
    title: "Livraison et retours",
    description: (s) => `Délais, frais de port et conditions de retour chez ${s.name}.`,
    body: (s) => `## Livraison

Nous livrons en : ${countries(s)}.

${shippingLine(s)} Vous recevez un e-mail avec un numéro de suivi dès l'expédition.

## Retours

Vous disposez de ${s.return_days} jours après réception pour nous retourner un article, sans avoir à vous justifier. Écrivez-nous à ${s.legal.email} avec votre numéro de commande : nous vous indiquons l'adresse de retour.

L'article doit être complet et dans son état d'origine. Le remboursement est effectué sur le moyen de paiement utilisé, au plus tard 14 jours après réception du retour.

## Produit abîmé ou non conforme

Écrivez-nous avec une photo à ${s.legal.email}. Nous prenons en charge le remplacement ou le remboursement, frais de retour compris.`,
  },
  cgv: {
    title: "Conditions générales de vente",
    description: (s) => `Conditions générales de vente de la boutique ${s.name}.`,
    body: (s) => `## Article 1 — Objet

Les présentes conditions régissent les ventes conclues sur le site ${s.domain}, édité par ${s.legal.company} (SIRET ${s.legal.siret}), ${s.legal.address}. Contact : ${s.legal.email}.

## Article 2 — Prix

Les prix sont indiqués en euros, toutes taxes comprises. ${vatLine(s)} Les frais de livraison sont indiqués avant la validation de la commande.

## Article 3 — Commande et paiement

La commande est ferme après validation du paiement. Le paiement est sécurisé par Stripe : ${s.name} n'a jamais accès à vos coordonnées bancaires. Un e-mail de confirmation récapitule la commande.

## Article 4 — Livraison

${shippingLine(s)} En cas de retard de plus de 30 jours, vous pouvez annuler la commande et être remboursé.

## Article 5 — Droit de rétractation

Conformément à l'article L221-18 du Code de la consommation, vous disposez de 14 jours à compter de la réception pour vous rétracter, sans motif. ${s.name} étend ce délai à ${s.return_days} jours. Pour l'exercer, envoyez une déclaration claire à ${s.legal.email}. Le remboursement intervient dans les 14 jours suivant la réception du produit retourné. Les frais de retour sont à votre charge, sauf produit défectueux ou non conforme.

## Article 6 — Garanties légales

Tous les produits bénéficient de la garantie légale de conformité (articles L217-3 et suivants du Code de la consommation, 2 ans à compter de la livraison) et de la garantie des vices cachés (articles 1641 et suivants du Code civil).

## Article 7 — Médiation

En cas de litige non résolu avec notre service client, vous pouvez recourir gratuitement au médiateur de la consommation : ${mediator(s)}. Vous pouvez aussi utiliser la plateforme européenne de règlement en ligne des litiges.

## Article 8 — Données personnelles

Le traitement de vos données est décrit dans notre [politique de confidentialité](/confidentialite).

## Article 9 — Droit applicable

Les présentes conditions sont soumises au droit français.`,
  },
  "mentions-legales": {
    title: "Mentions légales",
    description: (s) => `Mentions légales du site ${s.domain}.`,
    body: (s) => `## Éditeur du site

${s.legal.company}
SIRET : ${s.legal.siret}
Adresse : ${s.legal.address}
E-mail : ${s.legal.email}${s.legal.phone ? `\nTéléphone : ${s.legal.phone}` : ""}

${vatLine(s)}

Directeur de la publication : ${s.legal.company.split("—")[0].trim()}.

## Hébergement

${s.legal.host}

## Propriété intellectuelle

Les textes, photographies et éléments graphiques de ce site sont protégés. Toute reproduction sans autorisation est interdite.`,
  },
  confidentialite: {
    title: "Confidentialité",
    description: (s) => `Comment ${s.name} utilise et protège vos données personnelles.`,
    body: (s) => `## Données collectées

Lors d'une commande : nom, adresse e-mail, adresse de livraison, téléphone. Les données de paiement sont traitées directement par Stripe et ne nous sont jamais transmises.

## Pourquoi

Uniquement pour traiter et livrer votre commande, vous en informer et répondre à vos demandes (base légale : exécution du contrat). Les données de facturation sont conservées 10 ans (obligation comptable), les autres 3 ans après votre dernière commande.

## Qui y a accès

${s.name}, et les prestataires nécessaires à la commande : Stripe (paiement), l'hébergeur du site, le service d'envoi d'e-mails et le transporteur ou fournisseur qui expédie votre colis.

## Cookies

Ce site n'utilise aucun cookie publicitaire. Votre panier est mémorisé dans votre navigateur, uniquement pour vous éviter de le perdre.

La fréquentation est mesurée sans cookie et sans conserver votre adresse IP : nous comptons les pages vues et la provenance des visites (moteur de recherche, réseau social, assistant IA…) sous forme de totaux anonymes par jour.

## Vos droits

Vous pouvez accéder à vos données, les rectifier ou demander leur suppression en écrivant à ${s.legal.email}. Vous pouvez aussi adresser une réclamation à la CNIL (cnil.fr).`,
  },
};
