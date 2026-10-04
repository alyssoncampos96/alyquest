export const instant = false;
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { saveNightReview } from "@/app/system-actions";
import { addDays, saoDate, soft } from "@/lib/life-dashboard";

type Review = { wins: string | null; blockers: string | null; tomorrow: string | null; mood: number | null };
type Task = { id: string; title: string; status: string; due_date: string | null; completed_at: string | null };

function Summary({ title, tasks, empty }: { title: string; tasks: Task[]; empty: string }) {
  return <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950 p-3">
    <p className="text-sm font-bold">{title}</p>
    {tasks.length ? <ul className="mt-2 space-y-1 text-sm text-slate-300">{tasks.map(task => <li key={task.id}>• {task.title}</li>)}</ul> : <p className="mt-2 text-xs text-slate-400">{empty}</p>}
  </div>;
}

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const day = saoDate();
  const tomorrow = addDays(day, 1);
  const [review, tasks] = await Promise.all([
    soft<Review | null>(supabase.from("aq_night_reviews").select("wins,blockers,tomorrow,mood").eq("user_id", user.id).eq("review_day", day).maybeSingle(), null),
    soft<Task[]>(supabase.from("tasks").select("id,title,status,due_date,completed_at").eq("user_id", user.id).order("due_date", { ascending: true, nullsFirst: false }).limit(300), []),
  ]);
  const completed = tasks.filter(task => task.status === "completed" && task.completed_at && saoDate(new Date(task.completed_at)) === day);
  const pending = tasks.filter(task => !["completed", "cancelled", "skipped"].includes(task.status));
  const missed = pending.filter(task => task.due_date && task.due_date <= day);
  const scheduled = pending.filter(task => task.due_date === tomorrow);
  return <main className="min-h-screen px-4 pb-28 pt-6"><div className="mx-auto max-w-md">
    <h1 className="text-2xl font-black">Revisão noturna</h1>
    <p className="mt-1 text-sm text-slate-400">O AlyQuest reúne suas missões automaticamente. Use os campos abaixo para acrescentar o que não aparece na lista.</p>
    <ActionForm action={saveNightReview} className="mt-5 rounded-3xl border border-slate-800 bg-slate-900 p-4">
      <input type="hidden" name="day" value={day}/>
      <Summary title="Vitórias de hoje" tasks={completed} empty="Nenhuma missão concluída hoje ainda."/>
      <label className="mt-3 block text-sm font-bold">Outras vitórias ou observações
        <textarea name="wins" defaultValue={review?.wins ?? ""} className="mt-2 h-24 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="O que mais deu certo hoje?"/>
      </label>
      <Summary title="O que ficou pendente" tasks={missed} empty="Nenhuma missão vencida ou pendente para hoje."/>
      <label className="mt-3 block text-sm font-bold">Bloqueios e ajustes adicionais
        <textarea name="blockers" defaultValue={review?.blockers ?? ""} className="mt-2 h-24 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="O que atrapalhou?"/>
      </label>
      <Summary title="Programado para amanhã" tasks={scheduled} empty="Nenhuma missão agendada para amanhã."/>
      <label className="mt-3 block text-sm font-bold">Primeiro passo e outras notas para amanhã
        <textarea name="tomorrow" defaultValue={review?.tomorrow ?? ""} className="mt-2 h-24 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="Por onde você quer começar?"/>
      </label>
      <label className="mt-4 block text-sm font-bold">Humor<input name="mood" type="range" min="1" max="5" defaultValue={review?.mood ?? 3} className="mt-2 w-full"/></label>
      <button className="mt-4 w-full rounded-xl bg-emerald-600 p-3 font-bold">Salvar revisão</button>
    </ActionForm>
  </div></main>;
}
