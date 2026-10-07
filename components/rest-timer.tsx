"use client";
import { useEffect, useRef, useState } from "react";
import { manageRest } from "@/app/planning-actions";

type ActiveRest = { id: string; target_minutes: number; active_seconds: number; running_since: string | null };
function remaining(rest: ActiveRest) {
  const elapsed = rest.active_seconds + (rest.running_since ? Math.max(0, Math.floor((Date.now() - new Date(rest.running_since).getTime()) / 1000)) : 0);
  return Math.max(0, rest.target_minutes * 60 - elapsed);
}

export function RestTimer({ activeRest }: { activeRest: ActiveRest | null }) {
  const [minutes, setMinutes] = useState(activeRest?.target_minutes ?? 15);
  const [sessionId, setSessionId] = useState<string | null>(activeRest?.id ?? null);
  const [seconds, setSeconds] = useState(activeRest ? remaining(activeRest) : 15 * 60);
  const [running, setRunning] = useState(Boolean(activeRest?.running_since));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    if (!running) return;
    const deadline = Date.now() + seconds * 1000;
    const timer = setInterval(() => setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 250);
    return () => clearInterval(timer);
    // Capture the deadline only when starting or resuming.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  useEffect(() => { if (running && seconds === 0) void complete(); });

  async function complete() {
    if (!sessionId || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const result = await manageRest(sessionId, "complete");
      setRunning(false); setSessionId(null);
      setMessage(result.coins ? `Descanso concluído! +${result.coins} ${result.coins === 1 ? "moeda" : "moedas"}.` : "Descanso concluído! Sessões a partir de 15 minutos rendem moedas.");
      setSeconds(minutes * 60);
    } catch (cause) {
      setRunning(false); setSeconds(1);
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir o descanso. Tente novamente.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  async function toggle() {
    if (busy || inFlight.current) return;
    if (seconds === 0) { await complete(); return; }
    const id = sessionId ?? crypto.randomUUID();
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await manageRest(id, running ? "pause" : sessionId ? "resume" : "start", minutes);
      setSessionId(id); setSeconds(Math.max(0, minutes * 60 - result.seconds)); setRunning(result.status === "running");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o descanso."); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (busy || inFlight.current) return;
    setBusy(true); setError("");
    try {
      if (sessionId) await manageRest(sessionId, "cancel");
      setRunning(false); setSessionId(null); setSeconds(minutes * 60); setMessage("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível cancelar."); }
    finally { setBusy(false); }
  }

  const reward = Math.floor(minutes / 15);
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return <section className="rounded-3xl border border-emerald-800 bg-slate-900 p-5">
    <h2 className="text-lg font-black">🌿 Só descanso</h2>
    <p className="mt-1 text-sm text-slate-300">Escolha o tempo. A cada 15 minutos completos, você ganha 1 moeda.</p>
    <div className="mt-4 flex flex-wrap gap-2">{[15, 30, 45, 60].map(value => <button key={value} type="button" disabled={Boolean(sessionId) || busy} onClick={() => { setMinutes(value); setSeconds(value * 60); setMessage(""); }} className={`rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-60 ${minutes === value ? "border-emerald-400 bg-emerald-800" : "border-slate-700 bg-slate-950"}`}>{value} min</button>)}</div>
    <label className="mt-4 block text-sm text-slate-300">Ou personalize de 1 a 240 minutos<input type="number" min="1" max="240" step="1" inputMode="numeric" disabled={Boolean(sessionId) || busy} value={minutes} onChange={event => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 1 && value <= 240) { setMinutes(value); setSeconds(value * 60); setMessage(""); } }} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-base text-white" /></label>
    <div className="py-8 text-center"><div role="timer" aria-label={`Descanso: ${clock}`} className="text-6xl font-black tabular-nums">{clock}</div><p className="mt-3 text-sm text-emerald-300">Recompensa ao concluir: +{reward} {reward === 1 ? "moeda" : "moedas"}</p>{reward === 0 && <p className="mt-1 text-xs text-slate-400">Menos de 15 minutos não rendem moeda.</p>}</div>
    <button type="button" disabled={busy} onClick={toggle} className="w-full rounded-2xl bg-emerald-600 py-4 font-black text-slate-950 disabled:opacity-60">{busy ? "Aguarde..." : running ? "Pausar descanso" : sessionId ? "Retomar descanso" : "Iniciar descanso"}</button>
    {sessionId && <button type="button" disabled={busy} onClick={cancel} className="mt-3 w-full rounded-xl border border-slate-700 py-3 text-sm font-semibold">Cancelar sem recompensa</button>}
    {message && <p role="status" className="mt-3 text-sm text-emerald-300">{message}</p>}{error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
  </section>;
}
