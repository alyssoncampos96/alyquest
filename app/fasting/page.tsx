import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { finishFast, startFast } from "@/app/fasting-actions";
import { FastingActiveCard } from "@/components/fasting-active-card";

function partsInSaoPaulo(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "00";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function localInput(date: Date) {
  const p = partsInSaoPaulo(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

function localDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(date);
}

async function Content() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const result = await supabase.from("aq_fasting_sessions").select("*").eq("user_id", user.id).order("started_at", { ascending: false }).limit(20);
  if (result.error) {
    return <main className="min-h-screen px-4 pb-28 pt-6"><div className="mx-auto max-w-md"><h1 className="text-2xl font-black">Jejum</h1><p className="mt-4 rounded-2xl border border-amber-700 bg-amber-950/40 p-4 text-sm text-amber-100">A tela está pronta, mas o banco ainda precisa receber a migração de jejum.</p></div></main>;
  }
  const now = new Date();
  const start = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const sessions = result.data ?? [];
  const active = sessions.find(session => session.status === "active" && !session.ended_at);
  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-black">Jejum</h1>
        <p className="mt-1 text-sm text-slate-400">A cada 4 horas completas: +1 XP e +1 moeda.</p>
        {active ? (
          <>
            <FastingActiveCard startedAt={active.started_at} />
            <form action={finishFast} className="mt-5 rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <h2 className="font-bold">Finalizar jejum ativo</h2>
              <input type="hidden" name="session_id" value={active.id} />
              <label className="mt-3 block text-xs text-slate-400">Começo<input name="started_at" required type="datetime-local" defaultValue={localInput(new Date(active.started_at))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" /></label>
              <label className="mt-3 block text-xs text-slate-400">Fim<input name="ended_at" required type="datetime-local" defaultValue={localInput(now)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" /></label>
              <textarea name="notes" placeholder="Observações" defaultValue={active.notes ?? ""} className="mt-3 h-20 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" />
              <button className="mt-3 w-full rounded-xl bg-emerald-600 p-3 font-bold">Finalizar e receber recompensa</button>
            </form>
          </>
        ) : (
          <form action={startFast} className="mt-5 rounded-2xl border border-slate-700 bg-slate-900 p-4">
            <h2 className="font-bold">Iniciar jejum ativo</h2>
            <label className="mt-3 block text-xs text-slate-400">Começo<input name="started_at" required type="datetime-local" defaultValue={localInput(now)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" /></label>
            <textarea name="notes" placeholder="Observações" className="mt-3 h-20 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" />
            <button className="mt-3 w-full rounded-xl bg-violet-600 p-3 font-bold">Iniciar contador</button>
          </form>
        )}
        <form action={finishFast} className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <details>
            <summary className="cursor-pointer text-sm font-bold text-violet-300">Registrar jejum passado</summary>
            <label className="mt-3 block text-xs text-slate-400">Começo<input name="started_at" required type="datetime-local" defaultValue={localInput(start)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" /></label>
            <label className="mt-3 block text-xs text-slate-400">Fim<input name="ended_at" required type="datetime-local" defaultValue={localInput(now)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" /></label>
            <textarea name="notes" placeholder="Observações" className="mt-3 h-20 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" />
            <button className="mt-3 w-full rounded-xl bg-slate-800 p-3 font-bold">Registrar sessão concluída</button>
          </details>
        </form>
        <section className="mt-5 space-y-2">
          <h2 className="font-bold">Histórico</h2>
          {sessions.filter(s => s.status !== "active").map(s => {
            const startDate = new Date(s.started_at);
            const endDate = s.ended_at ? new Date(s.ended_at) : null;
            const hours = endDate ? Math.max(0, (endDate.getTime() - startDate.getTime()) / 36e5) : 0;
            return <article key={s.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-3"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{hours.toFixed(1).replace(".", ",")}h</h3><p className="mt-1 text-xs text-slate-400">{localDateTime(startDate)} → {endDate ? localDateTime(endDate) : "em aberto"}</p></div><p className="font-bold text-violet-300">+{s.reward_units} 🪙</p></div></article>;
          })}
          {!sessions.filter(s => s.status !== "active").length && <p className="rounded-2xl border border-slate-800 p-4 text-sm text-slate-400">Nenhum jejum registrado ainda.</p>}
        </section>
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={<main className="p-6">Carregando jejum...</main>}><Content /></Suspense>;
}
