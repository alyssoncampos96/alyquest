"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parseDays(form: FormData) {
  return form.getAll("weekdays").map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
}

async function invoke(name: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Entre novamente para continuar.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.code === "P0001" ? error.message : "Não foi possível salvar.");
  revalidatePath("/");
  revalidatePath("/notifications");
  return data;
}

export async function saveNotificationRule(form: FormData) {
  const kind = String(form.get("kind") ?? "daily_summary");
  const title = String(form.get("title") ?? "").trim();
  const taskId = String(form.get("task_id") ?? "") || null;
  const time = String(form.get("time_of_day") ?? "");
  const weekdays = parseDays(form);
  if (!title || !/^\d{2}:\d{2}$/.test(time) || !weekdays.length || !["daily_summary", "task"].includes(kind)) {
    throw new Error("Confira título, dias e horário.");
  }
  await invoke("aq_save_notification_rule", {
    p_id: null,
    p_kind: kind,
    p_task_id: taskId,
    p_title: title,
    p_weekdays: weekdays,
    p_time_of_day: time,
    p_active: true,
  });
}

export async function toggleNotificationRule(id: string, active: boolean) {
  await invoke("aq_toggle_notification_rule", { p_id: id, p_active: active });
}

export async function deleteNotificationRule(id: string) {
  await invoke("aq_delete_notification_rule", { p_id: id });
}
