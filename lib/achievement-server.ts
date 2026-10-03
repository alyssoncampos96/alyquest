import { type SupabaseClient } from "@supabase/supabase-js";
import { checked } from "@/lib/query";
import { buildAchievements } from "@/lib/achievement-catalog";

async function safeData<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>, fallback: T) {
  const result = await query;
  return result.error ? fallback : result.data ?? fallback;
}

export async function loadAchievementState(supabase: SupabaseClient, userId: string) {
  const [bosses, profile, tasks, plans, modules, links, focus, routines, fasts, finance, claims] = await Promise.all([
    supabase.from("bosses").select("id", { count: "exact", head: true }).eq("user_id", userId).not("defeated_at", "is", null).then(checked),
    supabase.from("profiles").select("current_streak").eq("user_id", userId).maybeSingle().then(checked),
    supabase.from("tasks").select("status,category,due_date,completed_at").eq("user_id", userId).then(checked),
    supabase.from("aq_task_plans").select("kind,steps").eq("user_id", userId).then(checked),
    supabase.from("aq_workout_modules").select("id", { count: "exact", head: true }).eq("user_id", userId).then(checked),
    supabase.from("aq_sheet_links").select("task_id", { count: "exact", head: true }).eq("user_id", userId).then(checked),
    supabase.from("pomodoro_sessions").select("focus_completed,break_completed").eq("user_id", userId).then(checked),
    supabase.from("aq_routines").select("id", { count: "exact", head: true }).eq("user_id", userId).then(checked),
    safeData(supabase.from("aq_fasting_sessions").select("reward_units,ended_at").eq("user_id", userId), []),
    safeData(supabase.from("aq_finance_transactions").select("kind,category,amount,source,installment_count").eq("user_id", userId), []),
    safeData(supabase.from("aq_achievement_claims").select("code,claimed_at").eq("user_id", userId), []),
  ]);
  const claimedCodes = new Set((claims as { code: string }[]).map(claim => claim.code));
  const achievements = buildAchievements({
    tasks: tasks.data ?? [],
    plans: plans.data ?? [],
    focus: focus.data ?? [],
    bosses: bosses.count ?? 0,
    streak: profile.data?.current_streak ?? 0,
    modules: modules.count ?? 0,
    links: links.count ?? 0,
    routines: routines.count ?? 0,
    fasts,
    finance,
  }).map(achievement => ({ ...achievement, claimed: claimedCodes.has(achievement.code) }));
  return { achievements, claimedCodes };
}
