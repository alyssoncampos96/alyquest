"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function finishFast(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Entre novamente para continuar.");
  const started = String(form.get("started_at") ?? "");
  const ended = String(form.get("ended_at") ?? "");
  if (!started || !ended) throw new Error("Informe início e fim do jejum.");
  const { data, error } = await supabase.rpc("aq_fasting_finish", {
    p_session_id: null,
    p_started_at: new Date(started).toISOString(),
    p_ended_at: new Date(ended).toISOString(),
    p_notes: String(form.get("notes") ?? "").slice(0, 1000),
  });
  if (error) throw new Error(error.code === "P0001" ? error.message : "Não foi possível registrar o jejum.");
  revalidatePath("/");
  revalidatePath("/fasting");
  revalidatePath("/achievements");
  void data;
}
