import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checked } from "@/lib/query";
import { buildAchievements } from "@/lib/achievement-catalog";

async function safeData<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>, fallback: T) {
  const result = await query;
  return result.error ? fallback : result.data ?? fallback;
}

async function Content() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const [bosses, profile, tasks, plans, modules, links, focus, routines, fasts, finance] = await Promise.all([
    supabase.from("bosses").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("defeated_at", "is", null).then(checked),
    supabase.from("profiles").select("current_streak").eq("user_id", user.id).maybeSingle().then(checked),
    supabase.from("tasks").select("status,category,due_date,completed_at").eq("user_id", user.id).then(checked),
    supabase.from("aq_task_plans").select("kind,steps").eq("user_id", user.id).then(checked),
    supabase.from("aq_workout_modules").select("id", { count: "exact", head: true }).eq("user_id", user.id).then(checked),
    supabase.from("aq_sheet_links").select("task_id", { count: "exact", head: true }).eq("user_id", user.id).then(checked),
    supabase.from("pomodoro_sessions").select("focus_completed,break_completed").eq("user_id", user.id).then(checked),
    supabase.from("aq_routines").select("id", { count: "exact", head: true }).eq("user_id", user.id).then(checked),
    safeData(supabase.from("aq_fasting_sessions").select("reward_units,ended_at").eq("user_id", user.id), []),
    safeData(supabase.from("aq_finance_transactions").select("kind,category,amount,source,installment_count").eq("user_id", user.id), []),
  ]);
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
  });
  const unlocked = achievements.filter(a => a.unlocked);
  const rewardXp = unlocked.reduce((n, a) => n + a.rewardXp, 0);
  const rewardCoins = unlocked.reduce((n, a) => n + a.rewardCoins, 0);
  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-black">Conquistas</h1>
        <p className="mt-1 text-sm text-slate-400">{unlocked.length}/{achievements.length} desbloqueadas.</p>
        <section className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-3"><p className="text-xs text-slate-400">Total</p><p className="mt-1 font-bold">{achievements.length}</p></div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-3"><p className="text-xs text-slate-400">XP</p><p className="mt-1 font-bold">+{rewardXp}</p></div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-3"><p className="text-xs text-slate-400">Moedas</p><p className="mt-1 font-bold">+{rewardCoins}</p></div>
        </section>
        <div className="mt-6 space-y-3">
          {achievements.map(a => (
            <article key={a.code} className={`rounded-2xl border p-4 ${a.unlocked ? "border-emerald-800 bg-emerald-950/35" : "border-slate-800 bg-slate-900 opacity-65"}`}>
              <div className="flex items-start gap-4">
                <div className="text-3xl">{a.icon}</div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-bold">{a.title} {a.unlocked ? "✓" : ""}</h2>
                    <span className="shrink-0 rounded-full bg-slate-950 px-2 py-1 text-[11px] text-amber-200">+{a.rewardXp}/+{a.rewardCoins}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{a.description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={<main className="p-6">Carregando conquistas...</main>}><Content /></Suspense>;
}
