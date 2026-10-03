import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadAchievementState } from "@/lib/achievement-server";
import { claimAchievement, claimAllAchievements } from "@/app/achievement-actions";
import { ActionForm } from "@/components/action-form";

async function Content() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { achievements } = await loadAchievementState(supabase, user.id);
  const unlocked = achievements.filter(a => a.unlocked);
  const claimed = achievements.filter(a => a.claimed);
  const claimable = achievements.filter(a => a.unlocked && !a.claimed);
  const rewardXp = unlocked.reduce((n, a) => n + a.rewardXp, 0);
  const rewardCoins = unlocked.reduce((n, a) => n + a.rewardCoins, 0);
  const pendingXp = claimable.reduce((n, a) => n + a.rewardXp, 0);
  const pendingCoins = claimable.reduce((n, a) => n + a.rewardCoins, 0);
  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-black">Conquistas</h1>
        <p className="mt-1 text-sm text-slate-400">{unlocked.length}/{achievements.length} desbloqueadas · {claimed.length} resgatadas.</p>
        <section className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-3"><p className="text-xs text-slate-400">Total</p><p className="mt-1 font-bold">{achievements.length}</p></div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-3"><p className="text-xs text-slate-400">XP</p><p className="mt-1 font-bold">+{rewardXp}</p></div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-3"><p className="text-xs text-slate-400">Moedas</p><p className="mt-1 font-bold">+{rewardCoins}</p></div>
        </section>
        <section className="mt-4 rounded-2xl border border-violet-800 bg-violet-950/35 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">Recompensas pendentes</h2>
              <p className="mt-1 text-sm text-violet-100">{claimable.length ? `${claimable.length} conquista${claimable.length === 1 ? "" : "s"} para resgatar: +${pendingXp} XP e +${pendingCoins} moedas.` : "Nada pendente agora. Continue jogando para liberar mais."}</p>
            </div>
            <div className="text-2xl">🪙</div>
          </div>
          <ActionForm action={claimAllAchievements} className="mt-3">
            <button disabled={!claimable.length} className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">Resgatar tudo</button>
          </ActionForm>
        </section>
        <div className="mt-6 space-y-3">
          {achievements.map(a => (
            <article key={a.code} className={`rounded-2xl border p-4 ${a.unlocked ? "border-emerald-800 bg-emerald-950/35" : "border-slate-800 bg-slate-900 opacity-65"}`}>
              <div className="flex items-start gap-4">
                <div className="text-3xl">{a.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-bold">{a.title} {a.unlocked ? "✓" : ""}</h2>
                    <span className="shrink-0 rounded-full bg-slate-950 px-2 py-1 text-[11px] text-amber-200">+{a.rewardXp}/+{a.rewardCoins}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{a.description}</p>
                  <div className="mt-3">
                    {a.claimed ? <span className="rounded-full bg-emerald-900 px-3 py-1 text-xs font-bold text-emerald-100">Resgatada ✓</span> : a.unlocked ? (
                      <ActionForm action={claimAchievement.bind(null, a.code)}>
                        <button className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold">Resgatar</button>
                      </ActionForm>
                    ) : <span className="rounded-full bg-slate-950 px-3 py-1 text-xs text-slate-500">Bloqueada</span>}
                  </div>
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
