"use client";

import { useEffect, useMemo, useState } from "react";

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const clock = `${String(hours + days * 24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return { clock, hoursTotal: safe / 3600, rewardUnits: Math.floor(safe / 14400) };
}

export function FastingActiveCard({ startedAt }: { startedAt: string }) {
  const started = useMemo(() => new Date(startedAt), [startedAt]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const duration = formatDuration((now.getTime() - started.getTime()) / 1000);
  const nextReward = (duration.rewardUnits + 1) * 4;
  const progress = Math.min(100, Math.max(0, ((duration.hoursTotal % 4) / 4) * 100));

  return (
    <section className="mt-5 rounded-3xl border border-violet-700 bg-gradient-to-br from-slate-900 to-violet-950 p-5 shadow-xl shadow-violet-950/20">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300">Jejum ativo</p>
      <div className="mt-4 text-center">
        <div className="mx-auto grid h-48 w-48 place-items-center rounded-full border-8 border-violet-500 bg-slate-950 shadow-inner">
          <div>
            <p className="text-4xl font-black tabular-nums">{duration.clock}</p>
            <p className="mt-2 text-xs text-slate-400">desde {started.toLocaleString("pt-BR")}</p>
          </div>
        </div>
      </div>
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{duration.rewardUnits} recompensa{duration.rewardUnits === 1 ? "" : "s"} garantida{duration.rewardUnits === 1 ? "" : "s"}</span>
          <span>Próxima em {nextReward}h</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-violet-400" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <p className="mt-4 text-sm text-violet-100">Cada bloco completo de 4 horas rende +1 XP e +1 moeda quando você finalizar.</p>
    </section>
  );
}
