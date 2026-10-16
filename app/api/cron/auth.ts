import type { NextRequest } from "next/server";

/** Vercel envoie "Authorization: Bearer <CRON_SECRET>" à chaque déclenchement planifié. */
export function cronAllowed(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
}
