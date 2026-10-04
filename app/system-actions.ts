"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function invoke(name: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Entre novamente para continuar.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.code === "P0001" ? error.message : "Não foi possível salvar.");
  ["/", "/daily", "/planning", "/review", "/inbox", "/finance", "/budget", "/cards", "/arena", "/character", "/journeys", "/streak", "/weekly", "/battle-history", "/themes", "/bosses"].forEach((path) => revalidatePath(path));
  return data;
}

export async function generateDailyMissions(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Data inválida.");
  return invoke("aq_generate_daily_missions", { p_day: day });
}

export async function claimDailyMission(id: string) {
  return invoke("aq_claim_daily_mission", { p_id: id });
}

export async function saveQuickInbox(form: FormData) {
  const content = String(form.get("content") ?? "").trim();
  const kind = String(form.get("kind") ?? "idea");
  await invoke("aq_save_quick_inbox", { p_content: content, p_kind: kind });
}

export async function updateQuickInbox(id: string, status: "archived" | "converted" | "open") {
  await invoke("aq_update_quick_inbox", { p_id: id, p_status: status });
}

export async function saveDailyPlan(form: FormData) {
  const day = String(form.get("day") ?? "");
  const topTaskIds = form.getAll("top_task_ids").map(String).filter(Boolean);
  await invoke("aq_save_daily_plan", {
    p_day: day,
    p_intention: String(form.get("intention") ?? "").slice(0, 2000),
    p_top_task_ids: topTaskIds,
    p_workout_intention: String(form.get("workout_intention") ?? "").slice(0, 1000),
    p_focus_minutes: Number(form.get("focus_minutes") ?? 0) || 0,
  });
}

export async function saveNightReview(form: FormData) {
  await invoke("aq_save_night_review", {
    p_day: String(form.get("day") ?? ""),
    p_wins: String(form.get("wins") ?? "").slice(0, 2000),
    p_blockers: String(form.get("blockers") ?? "").slice(0, 2000),
    p_tomorrow: String(form.get("tomorrow") ?? "").slice(0, 2000),
    p_mood: Number(form.get("mood") ?? 0) || null,
  });
}

export async function saveFinanceBudget(form: FormData) {
  const amount = Number(String(form.get("amount") ?? "").replace(",", "."));
  await invoke("aq_save_finance_budget", {
    p_month: String(form.get("month") ?? ""),
    p_category: String(form.get("category") ?? "Outros"),
    p_amount: Number.isFinite(amount) ? amount : -1,
  });
}

export async function setTheme(form: FormData) {
  await invoke("aq_set_theme", { p_theme: String(form.get("theme") ?? "default") });
}

export async function claimDailyMissionForm(form: FormData) {
  await claimDailyMission(String(form.get("id") ?? ""));
}

export async function updateQuickInboxForm(form: FormData) {
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "open") as "archived" | "converted" | "open";
  await updateQuickInbox(id, status);
}
