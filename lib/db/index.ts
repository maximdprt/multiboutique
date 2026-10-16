import "server-only";
import type { Db } from "./types";
import { demoDb } from "./demo";
import { supabaseDb } from "./supabase";

export const isSupabaseConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Supabase si configuré, sinon base de démonstration locale. */
export const db: Db = isSupabaseConfigured ? supabaseDb : demoDb;

export type { Db, OrderFilter } from "./types";
