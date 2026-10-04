import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteNotificationRule, saveNotificationRule, toggleNotificationRule } from "@/app/notification-actions";
import { NotificationPermission } from "@/components/notification-permission";
import { formatWeekdays, phraseFor } from "@/lib/notification-copy";

const days = [["0", "Dom"], ["1", "Seg"], ["2", "Ter"], ["3", "Qua"], ["4", "Qui"], ["5", "Sex"], ["6", "Sáb"]];

async function Content() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const [tasksResult, rulesResult] = await Promise.all([
    supabase.from("tasks").select("id,title,category,due_date").eq("user_id", user.id).eq("status", "pending").order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("aq_notification_rules").select("*,task:tasks(title)").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  const tasks = tasksResult.data ?? [];
  const rulesReady = !rulesResult.error;
  const rules = rulesResult.data ?? [];
  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-black">Lembretes</h1>
        <p className="mt-1 text-sm text-slate-400">Missões específicas ou resumo das pendências.</p>
        <div className="mt-5"><NotificationPermission /></div>
        {!rulesReady && <p className="mt-4 rounded-2xl border border-amber-700 bg-amber-950/40 p-4 text-sm text-amber-100">A tela está pronta, mas o banco ainda precisa receber a migração de lembretes.</p>}
        <form action={saveNotificationRule} className="mt-5 rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="font-bold">Novo lembrete</h2>
          <input name="title" required maxLength={160} defaultValue="Resumo das missões pendentes" className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <select name="kind" defaultValue="daily_summary" className="rounded-xl border border-slate-700 bg-slate-950 p-3">
              <option value="daily_summary">Resumo geral</option>
              <option value="task">Missão específica</option>
            </select>
            <input name="time_of_day" type="time" defaultValue="07:00" required className="rounded-xl border border-slate-700 bg-slate-950 p-3" />
          </div>
          <select name="task_id" defaultValue="" className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 p-3">
            <option value="">Sem missão específica</option>
            {tasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}
          </select>
          <fieldset className="mt-4">
            <legend className="text-sm font-semibold">Dias</legend>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {days.map(([value, label]) => <label key={value} className="rounded-xl border border-slate-700 bg-slate-950 p-2 text-center text-xs"><input className="sr-only peer" type="checkbox" name="weekdays" value={value} defaultChecked={value !== "0" && value !== "6"} /><span className="peer-checked:text-violet-300">{label}</span></label>)}
            </div>
          </fieldset>
          <button className="mt-4 w-full rounded-xl bg-violet-600 p-3 font-bold">Salvar lembrete</button>
        </form>
        <section className="mt-5 space-y-3">
          <h2 className="font-bold">Ativos</h2>
          {rules.map(rule => (
            <article key={rule.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{rule.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">{rule.time_of_day?.slice(0, 5)} · {formatWeekdays(rule.weekdays ?? [])}{rule.task?.title ? ` · ${rule.task.title}` : ""}</p>
                </div>
                <form action={toggleNotificationRule.bind(null, rule.id, !rule.active)}>
                  <button className={`rounded-xl px-3 py-2 text-xs font-bold ${rule.active ? "bg-emerald-700 text-emerald-100" : "bg-slate-800 text-slate-300"}`}>{rule.active ? "Ativo" : "Pausado"}</button>
                </form>
              </div>
              <p className="mt-3 rounded-xl bg-slate-950 p-3 text-sm text-violet-100">{phraseFor(rule.phrase_index ?? 0)}</p>
              <form action={deleteNotificationRule.bind(null, rule.id)} className="mt-3 text-right">
                <button className="rounded-xl border border-red-900 px-3 py-2 text-xs font-bold text-red-300">Excluir lembrete</button>
              </form>
            </article>
          ))}
          {rulesReady && !rules.length && <p className="rounded-2xl border border-slate-800 p-4 text-sm text-slate-400">Nenhum lembrete criado ainda.</p>}
        </section>
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={<main className="p-6">Carregando lembretes...</main>}><Content /></Suspense>;
}
