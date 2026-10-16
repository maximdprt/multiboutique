import "server-only";
import Stripe from "stripe";

let stripe: Stripe | null = null;

/** Client Stripe, ou null si STRIPE_SECRET_KEY n'est pas défini (mode démo). */
export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

export const stripeMode = (): "live" | "test" =>
  process.env.STRIPE_SECRET_KEY?.startsWith("sk_live") ? "live" : "test";
