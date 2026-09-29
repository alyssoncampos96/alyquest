"use client";
import { useEffect, useRef, useState } from 'react';
import { finishFocus } from '@/app/planning-actions';
import type { Task } from '@/lib/types';
export function Pomodoro({tasks}:{tasks:Pick<Task, 'id' | 'title' | 'estimated_hours' | 'category'>[]}) {
  const [category,setCategory]=useState('Todos');
  const visibleTasks=category==='Todos'?tasks:tasks.filter(t=>(t.category??'Sem categoria')===category);
  const [focusMinutes,setFocusMinutes]=useState(25),[breakMinutes,setBreakMinutes]=useState(5);
  const [taskIds,setTaskIds]=useState<string[]>([]),[other,setOther]=useState(''),[hasOther,setHasOther]=useState(false),[started,setStarted]=useState(false);
  const requestId=useRef<string|null>(null);
  function newId(){const b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
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
      requestId.current??=newId();
      const sid=await finishFocus(sessionId??requestId.current,taskIds,hasOther?other.trim():'',phase,focusMinutes,breakMinutes);
      setSessionId(sid);
      if(phase==='focus'){setPhase('break');setSeconds(breakMinutes*60)}
      else{setPhase('focus');setSeconds(focusMinutes*60);setSessionId(null);requestId.current=null;setStarted(false)}
    } catch {setError('Não foi possível registrar esta fase. Tente salvar novamente.');}
    finally{busy.current=false;setSaving(false)}
  }
  function toggle(){if(running){stop();return}if(seconds===0){void finish();return}if(hasOther&&!other.trim()){setError('Descreva a outra atividade.');return;}setError('');setStarted(true);requestId.current??=newId();setRunning(true)}
  function reset(){stop();setPhase('focus');setSessionId(null);requestId.current=null;setStarted(false);setSeconds(focusMinutes*60);setError('')}
  function suggest(){const h=tasks.filter(t=>taskIds.includes(t.id)).reduce((n,t)=>n+Number(t.estimated_hours??1),0);const f=h>=2?50:25,b=f===50?10:5;stop();setPhase('focus');setSessionId(null);requestId.current=null;setStarted(false);setFocusMinutes(f);setBreakMinutes(b);setSeconds(f*60);setError('')}
  return <section className="rounded-3xl border border-slate-700 bg-slate-900 p-5"><div className="grid grid-cols-2 gap-3"><label className="text-xs text-slate-400">Foco<select disabled={started || saving} value={focusMinutes} onChange={e=>{const v=Number(e.target.value);setFocusMinutes(v);if(!running&&phase==='focus')setSeconds(v*60)}} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white">{[25,45,50,60].map(v=><option key={v} value={v}>{v} min</option>)}</select></label><label className="text-xs text-slate-400">Descanso<select disabled={started || saving} value={breakMinutes} onChange={e=>{const v=Number(e.target.value);setBreakMinutes(v);if(phase==='break')setSeconds(v*60)}} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white">{[5,10,15,20].map(v=><option key={v} value={v}>{v} min</option>)}</select></label></div><fieldset disabled={started||saving} className="mt-4"><legend className="text-sm font-semibold">Atividades deste foco</legend><p className="mt-1 text-xs text-slate-400">Marque uma ou várias. A recompensa é por sessão, independentemente da quantidade de atividades.</p><div role="group" aria-label="Filtrar atividades por categoria" className="mt-3 flex flex-wrap gap-2">{['Todos',...new Set(tasks.map(t=>t.category??'Sem categoria'))].map(c=><button type="button" key={c} aria-pressed={c===category} onClick={()=>setCategory(c)} className={`rounded-full px-2 py-1 text-xs ${c===category?'bg-violet-600':'bg-slate-800'}`}>{c}</button>)}</div><p className="mt-2 text-xs text-slate-400">{taskIds.length} selecionadas · as seleções são mantidas ao trocar o filtro.</p><div className="mt-3 max-h-48 space-y-3 overflow-y-auto">{visibleTasks.map(t=><label key={t.id} className="flex items-start gap-3 text-sm"><input type="checkbox" checked={taskIds.includes(t.id)} onChange={e=>setTaskIds(e.target.checked?[...taskIds,t.id]:taskIds.filter(id=>id!==t.id))}/><span>{t.title}</span></label>)}</div><label className="mt-3 flex items-center gap-3 text-sm"><input type="checkbox" checked={hasOther} onChange={e=>setHasOther(e.target.checked)}/>Outra atividade</label>{hasOther&&<label className="mt-3 block text-xs">Descrição da atividade<input maxLength={500} value={other} onChange={e=>setOther(e.target.value)} placeholder="Ex.: estudar inglês" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"/></label>}</fieldset><div className="py-7 text-center"><div className="text-sm font-bold text-violet-400">{phase==='focus'?'⚔️ FOCO':'🌿 DESCANSO'}</div><div className="relative mx-auto my-4 h-56 w-56"><svg viewBox="0 0 240 240" className="h-full w-full -rotate-90" aria-hidden="true"><circle cx="120" cy="120" r="108" fill="none" stroke="#1e293b" strokeWidth="9"/><circle cx="120" cy="120" r="108" fill="none" stroke={phase==='focus'?'#a78bfa':'#34d399'} strokeWidth="9" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1-seconds/((phase==='focus'?focusMinutes:breakMinutes)*60)} className="transition-all duration-300"/></svg><div role="timer" aria-label={`${phase==='focus'?'Foco':'Descanso'}: ${label}`} className="absolute inset-0 flex items-center justify-center text-5xl font-black tracking-tight">{label}</div></div><p className="mt-3 text-xs text-slate-400">{phase==='focus'?'Concluir o foco rende +1 XP e +1 moeda.':'Concluir o descanso rende +1 XP e +1 moeda.'}</p></div><button disabled={saving} onClick={toggle} className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 font-bold">{saving?'Salvando...':running?'Pausar':seconds===0?'Tentar salvar novamente':'Iniciar'}</button><div className="mt-3 grid grid-cols-2 gap-3"><button disabled={saving} onClick={reset} className="rounded-xl border border-slate-700 bg-slate-950 py-3 text-sm font-semibold">Reiniciar</button><button disabled={saving} onClick={suggest} className="rounded-xl border border-violet-800 bg-violet-950 py-3 text-sm font-semibold text-violet-200">✨ Sugerir</button></div>{error&&<p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}</section>}
