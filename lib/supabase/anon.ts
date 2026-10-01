import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

export function createAnonClient() {
  const { url, key } = supabaseConfig();
  return createClient(url, key, { auth: { persistSession: false } });
}
