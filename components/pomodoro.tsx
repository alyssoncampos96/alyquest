"use client";
import { useEffect, useRef, useState } from 'react';
import { completePomodoroPhase } from '@/app/actions';
import type { Task } from '@/lib/types';
export function Pomodoro({tasks}:{tasks:Pick<Task, 'id' | 'title' | 'estimated_hours'>[]}) {
  const [focusMinutes,setFocusMinutes]=useState(25),[breakMinutes,setBreakMinutes]=useState(5);
  const [taskId,setTaskId]=useState(tasks[0]?.id??'');
  const [phase,setPhase]=useState<'focus'|'break'>('focus');
  const [seconds,setSeconds]=useState(1500),[running,setRunning]=useState(false);
  const [sessionId,setSessionId]=useState<string|null>(null);
  const [saving,setSaving]=useState(false),[error,setError]=useState('');
  const busy=useRef(false);
  const label=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  useEffect(()=>{
    if(!running) return;
    const deadline=Date.now()+seconds*1000;
    const timer=setInterval(()=>setSeconds(Math.max(0,Math.ceil((deadline-Date.now())/1000))),250);
    return ()=>clearInterval(timer);
    // A deadline is captured only when starting/resuming the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[running]);
  useEffect(()=>{if(running&&seconds===0) void finish();});
  function stop(){setRunning(false)}
  async function finish(){
    if(busy.current)return;
    busy.current=true;stop();setSaving(true);setError('');
    try {
      const sid=await completePomodoroPhase(sessionId,taskId||null,phase,focusMinutes,breakMinutes);
      setSessionId(sid);
      if(phase==='focus'){setPhase('break');setSeconds(breakMinutes*60)}
      else{setPhase('focus');setSeconds(focusMinutes*60);setSessionId(null)}
    } catch {setError('Não foi possível registrar esta fase. Tente salvar novamente.');}
    finally{busy.current=false;setSaving(false)}
  }
  function toggle(){if(running){stop();return}if(seconds===0){void finish();return}setRunning(true)}
  function reset(){stop();setPhase('focus');setSessionId(null);setSeconds(focusMinutes*60);setError('')}
  function suggest(){const t=tasks.find(t=>t.id===taskId);const h=Number(t?.estimated_hours??1);const f=h>=2?50:25,b=f===50?10:5;stop();setPhase('focus');setSessionId(null);setFocusMinutes(f);setBreakMinutes(b);setSeconds(f*60);setError('')}
  return <section className="rounded-3xl border border-slate-700 bg-slate-900 p-5"><div className="grid grid-cols-2 gap-3"><label className="text-xs text-slate-400">Foco<select disabled={running || saving} value={focusMinutes} onChange={e=>{const v=Number(e.target.value);setFocusMinutes(v);if(!running&&phase==='focus')setSeconds(v*60)}} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white">{[25,45,50,60].map(v=><option key={v} value={v}>{v} min</option>)}</select></label><label className="text-xs text-slate-400">Descanso<select disabled={running || saving} value={breakMinutes} onChange={e=>{const v=Number(e.target.value);setBreakMinutes(v);if(phase==='break')setSeconds(v*60)}} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white">{[5,10,15,20].map(v=><option key={v} value={v}>{v} min</option>)}</select></label></div><label className="mt-4 block text-xs text-slate-400">Missão<select disabled={running || saving} value={taskId} onChange={e=>setTaskId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white">{tasks.length?tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>):<option value="">Sem tarefas pendentes</option>}</select></label><div className="py-7 text-center"><div className="text-sm font-bold text-violet-400">{phase==='focus'?'⚔️ FOCO':'🌿 DESCANSO'}</div><div className="mt-2 text-6xl font-black tracking-tight">{label}</div><p className="mt-3 text-xs text-slate-400">{phase==='focus'?'Concluir o foco rende +1 XP e +1 moeda.':'Concluir o descanso rende +1 XP e +1 moeda.'}</p></div><button disabled={saving} onClick={toggle} className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 font-bold">{saving?'Salvando...':running?'Pausar':seconds===0?'Tentar salvar novamente':'Iniciar'}</button><div className="mt-3 grid grid-cols-2 gap-3"><button disabled={saving} onClick={reset} className="rounded-xl border border-slate-700 bg-slate-950 py-3 text-sm font-semibold">Reiniciar</button><button disabled={saving} onClick={suggest} className="rounded-xl border border-violet-800 bg-violet-950 py-3 text-sm font-semibold text-violet-200">✨ Sugerir</button></div>{error&&<p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}</section>}
