"use client";

import { useState, type ReactNode } from "react";

const categories = ["Pessoal", "Trabalho", "Faculdade", "Financeiro", "Saúde"];
type Mission = { id: string; category: string | null; card: ReactNode };

export function MissionFilters({ missions, children }: { missions: Mission[]; children: ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);
  const options = [...new Set([...categories, ...missions.map(mission => mission.category || "Sem categoria")])];
  const visible = selected === null ? missions : missions.filter(mission => (mission.category || "Sem categoria") === selected);

  return <>
    <div role="group" aria-label="Filtrar missões por categoria" className="mt-5 flex flex-wrap gap-2">
      {[null, ...options].map(category => {
        const active = selected === category;
        const count = category === null ? missions.length : missions.filter(mission => (mission.category || "Sem categoria") === category).length;
        return <button
          key={category ?? "all"}
          type="button"
          aria-pressed={active}
          aria-controls="filtered-missions"
          onClick={() => setSelected(category)}
          className={`rounded-full border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${active ? "border-violet-500 bg-violet-600 text-white" : "border-slate-700 bg-slate-900 text-slate-300 hover:border-violet-500 hover:text-white"}`}
        >{category ?? "Todos"} <span className={active ? "text-violet-200" : "text-slate-500"}>{count}</span></button>;
      })}
    </div>
    {children}
    <section id="filtered-missions" aria-label="Missões filtradas">
      <h2 aria-live="polite" className="mb-3 mt-7 text-lg font-bold">{selected ? `${selected} — Pendentes` : "Pendentes"} ({visible.length})</h2>
      <div className="space-y-3">
        {visible.map(mission => <div key={mission.id}>{mission.card}</div>)}
        {!visible.length && <p className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">{selected ? `Nenhuma missão pendente em ${selected}.` : "Nenhuma missão pendente."}</p>}
      </div>
    </section>
  </>;
}
