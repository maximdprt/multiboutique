import "server-only";
// E-mails transactionnels via Resend (https://resend.com). Facultatif :
// sans RESEND_API_KEY, rien n'est envoyé et tout le reste fonctionne.
import type { Order, Site } from "./types";
import { money } from "./format";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function send(site: Site, to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  // L'adresse d'expédition doit appartenir à un domaine vérifié dans Resend.
  const from = `${site.name} <${process.env.EMAIL_FROM_LOCAL || "commandes"}@${site.domain}>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, reply_to: site.legal.email }),
  });
  if (!res.ok) console.error("Envoi d'e-mail impossible :", res.status, await res.text());
}

function layout(site: Site, body: string) {
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;color:${site.theme.ink}">
<p style="font-size:20px;font-weight:600;color:${site.theme.primary}">${esc(site.name)}</p>${body}
<p style="color:#666;font-size:13px;margin-top:32px">Une question ? Répondez simplement à cet e-mail.</p></div>`;
}

export async function sendOrderConfirmation(site: Site, o: Order) {
  const rows = o.items
    .map((i) => `<tr><td>${i.quantity} × ${esc(i.title)}</td><td align="right">${money(i.unit_price_cents * i.quantity)}</td></tr>`)
    .join("");
  await send(
    site,
    o.email,
    `Commande n° ${o.number} confirmée`,
    layout(
      site,
      `<p>Bonjour ${esc(o.name.split(" ")[0] || "")},</p><p>Merci pour votre commande n° ${o.number}. Nous la préparons, vous recevrez un e-mail avec le numéro de suivi dès l'expédition (délai indicatif : ${esc(site.shipping.delay)}).</p>
<table width="100%" cellpadding="6" style="border-collapse:collapse">${rows}
<tr><td>Livraison</td><td align="right">${o.shipping_cents ? money(o.shipping_cents) : "Offerte"}</td></tr>
<tr><td><strong>Total</strong></td><td align="right"><strong>${money(o.total_cents)}</strong></td></tr></table>`,
    ),
  );
}

export async function sendShippingNotice(site: Site, o: Order) {
  const link = o.tracking_url ? `<p><a href="${esc(o.tracking_url)}">Suivre mon colis</a></p>` : "";
  await send(
    site,
    o.email,
    `Votre commande n° ${o.number} est en route`,
    layout(site, `<p>Bonne nouvelle : votre commande a été expédiée.</p><p>Numéro de suivi : <strong>${esc(o.tracking_number)}</strong></p>${link}`),
  );
}
