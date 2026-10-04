export const instant = false;
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addDays, dateFmt, money, saoDate, soft, sum } from "@/lib/life-dashboard";

type Task = { id: string; title: string; category: string | null; status: string; completed_at: string | null; due_date: string | null; estimated_hours: number | string | null };
type Tx = { id: string; title: string; amount: number | string; kind: string; category: string | null; occurred_on: string };
type Focus = { focus_completed: boolean; break_completed: boolean; created_at: string };
type Fast = { started_at: string; ended_at: string | null; reward_coins?: number | string | null; reward_xp?: number | string | null };

function dayKey(value?: string | null) { return value ? value.slice(0, 10) : ""; }

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const end = saoDate();
  const start = addDays(end, -6);
  const [tasks, txs, focus, fasts, battles] = await Promise.all([
    soft<Task[]>(supabase.from("tasks").select("id,title,category,status,completed_at,due_date,estimated_hours").eq("user_id", user.id).or(`completed_at.gte.${start},due_date.gte.${start}`), []),
    soft<Tx[]>(supabase.from("aq_finance_transactions").select("id,title,amount,kind,category,occurred_on").eq("user_id", user.id).gte("occurred_on", start).lte("occurred_on", end), []),
    soft<Focus[]>(supabase.from("pomodoro_sessions").select("focus_completed,break_completed,created_at").eq("user_id", user.id).gte("created_at", `${start}T00:00:00`), []),
    soft<Fast[]>(supabase.from("aq_fasting_sessions").select("started_at,ended_at,reward_xp,reward_coins").eq("user_id", user.id).gte("started_at", `${start}T00:00:00`), []),
    soft<{ id: string; defeated_at?: string; created_at?: string }[]>(supabase.from("aq_arena_battles").select("id,created_at").eq("user_id", user.id).gte("created_at", `${start}T00:00:00`), []),
  ]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const done = tasks.filter(t => t.status === "completed" && dayKey(t.completed_at) >= start);
  const focusCount = focus.filter(f => f.focus_completed).length;
  const expense = sum(txs.filter(t => t.kind === "expense"), t => t.amount);
  const income = sum(txs.filter(t => t.kind === "income"), t => t.amount);
  return <main className="min-h-screen px-4 pb-28 pt-6"><div className="mx-auto max-w-md">
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-black">Dashboard semanal</h1><p className="mt-1 text-sm text-slate-400">Últimos 7 dias de missões, foco, jejum, finanças e arena.</p></div><Link href="/planning" className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold">Meu dia</Link></div>
    <section className="mt-5 grid grid-cols-2 gap-3">
      <Card label="Tarefas concluídas" value={done.length}/><Card label="Focos completos" value={focusCount}/><Card label="Jejuns registrados" value={fasts.length}/><Card label="Vitórias na arena" value={battles.length}/><Card label="Entradas" value={money.format(income)}/><Card label="Saídas" value={money.format(expense)}/>
    </section>
    <section className="mt-6 space-y-2"><h2 className="font-black">Ritmo da semana</h2>{days.map(day => { const label = dateFmt.format(new Date(`${day}T12:00:00-03:00`)); const dayTasks = done.filter(t => dayKey(t.completed_at) === day).length; const dayFocus = focus.filter(f => dayKey(f.created_at) === day && f.focus_completed).length; const dayTx = txs.filter(t => t.occurred_on === day).length; const active = dayTasks + dayFocus + dayTx + fasts.filter(f => dayKey(f.started_at) === day || dayKey(f.ended_at) === day).length; return <div key={day} className="rounded-2xl border border-slate-800 bg-slate-900 p-3"><div className="flex items-center justify-between"><p className="font-bold">{label}</p><span className={active ? "text-emerald-300" : "text-slate-500"}>{active ? "ativo" : "sem registro"}</span></div><p className="mt-1 text-xs text-slate-400">{dayTasks} tarefas · {dayFocus} focos · {dayTx} lançamentos</p></div>; })}</section>
    <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-5"><h2 className="font-black">Atalhos</h2><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><Link className="rounded-xl border border-slate-700 p-3" href="/journeys">🗺️ Jornadas</Link><Link className="rounded-xl border border-slate-700 p-3" href="/daily">✨ Diárias</Link><Link className="rounded-xl border border-slate-700 p-3" href="/budget">💰 Orçamento</Link><Link className="rounded-xl border border-slate-700 p-3" href="/review">🌙 Revisão</Link></div></section>
  </div></main>;
}
function Card({label,value}:{label:string;value:string|number}){return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>}
