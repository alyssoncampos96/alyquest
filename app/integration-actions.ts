"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createGptToken() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Entre novamente para continuar.");
  const token = `aq_${randomBytes(32).toString("base64url")}`;
  const { data, error } = await supabase.rpc("aq_integration_create_token", { p_name: "GPT AlyQuest", p_token: token });
  if (error) throw new Error(error.code === "P0001" ? error.message : "Não foi possível criar o token.");
  revalidatePath("/gpt");
  return { token, tokenInfo: data as { id: string; name: string; last4: string } };
}
