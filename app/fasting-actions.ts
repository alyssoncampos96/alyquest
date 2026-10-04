"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function saoPauloInstant(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Informe data e hora válidas.");
  const date = new Date(`${value}:00-03:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Informe data e hora válidas.");
  return date.toISOString();
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/fasting");
  revalidatePath("/achievements");
}

export async function startFast(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Entre novamente para continuar.");
  const started = String(form.get("started_at") ?? "");
  if (!started) throw new Error("Informe o começo do jejum.");
  const { error } = await supabase.rpc("aq_fasting_start", {
    p_started_at: saoPauloInstant(started),
    p_notes: String(form.get("notes") ?? "").slice(0, 1000),
  });
  if (error) throw new Error(error.code === "P0001" ? error.message : "Não foi possível iniciar o jejum.");
  refresh();
}

export async function finishFast(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Entre novamente para continuar.");
  const sessionId = String(form.get("session_id") ?? "") || null;
  const started = String(form.get("started_at") ?? "");
  const ended = String(form.get("ended_at") ?? "");
  if (!started || !ended) throw new Error("Informe início e fim do jejum.");
  const { data, error } = await supabase.rpc("aq_fasting_finish", {
    p_session_id: sessionId,
    p_started_at: saoPauloInstant(started),
    p_ended_at: saoPauloInstant(ended),
    p_notes: String(form.get("notes") ?? "").slice(0, 1000),
  });
  if (error) throw new Error(error.code === "P0001" ? error.message : "Não foi possível registrar o jejum.");
  refresh();
  void data;
}

export async function cancelFast(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Entre novamente para continuar.");
  const sessionId = String(form.get("session_id") ?? "");
  const { error } = await supabase.rpc("aq_fasting_cancel", { p_session_id: sessionId });
  if (error) throw new Error(error.code === "P0001" ? error.message : "Não foi possível cancelar o jejum.");
  refresh();
}
