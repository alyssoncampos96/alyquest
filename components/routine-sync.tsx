'use client';
import { useCallback, useEffect, useState, useTransition, type ReactNode } from 'react';
import { materializeRoutines, pauseRoutine } from '@/app/planning-actions';
import type { Routine } from '@/lib/planning';
export function RoutineSync(){
 const [error,setError]=useState(false);
 const sync=useCallback(async()=>{try{await materializeRoutines();setError(false);}catch{setError(true);}},[]);
 useEffect(()=>{void sync();const id=setInterval(()=>{if(document.visibilityState==='visible')void sync();},60000);const visible=()=>{if(document.visibilityState==='visible')void sync();};document.addEventListener('visibilitychange',visible);return()=>{clearInterval(id);document.removeEventListener('visibilitychange',visible)};},[sync]);
 return error?<p role="alert" className="my-3 text-sm text-amber-300">Não foi possível atualizar as recorrências. <button onClick={()=>void sync()} className="underline">Tentar novamente</button></p>:null;
}
export function RoutineList({routines,editors={}}:{routines:Routine[];editors?:Record<string,ReactNode>}){
 const [pending,start]=useTransition(),[error,setError]=useState('');
 return <details className="mt-5 rounded-2xl border border-slate-700 bg-slate-900 p-4"><summary className="cursor-pointer font-semibold">Recorrências ({routines.length})</summary><p className="mt-2 text-xs text-slate-400">As ocorrências são criadas ao abrir o app. Pausar mantém as missões existentes. Reativar recupera as ocorrências pendentes do período.</p>{routines.map(r=><div key={r.id}><div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-800 pt-3"><span className="text-sm">{r.title}<small className="block text-slate-400">{r.active?'Ativa':'Pausada'} • a cada {r.rule.interval} {({daily:'dia(s)',weekly:'semana(s)',monthly:'mês(es)',yearly:'ano(s)'})[r.rule.frequency]}</small></span><button disabled={pending} className="rounded-xl border border-slate-600 px-3 py-2 text-sm" onClick={()=>start(async()=>{try{await pauseRoutine(r.id,!r.active);setError('');}catch{setError('Não foi possível atualizar.');}})}>{r.active?'Pausar':'Reativar'}</button></div><details className="mt-2"><summary className="cursor-pointer text-sm text-violet-300">Editar próximas ocorrências</summary><div className="mt-3">{editors[r.id]}</div></details></div>)}{error&&<p role="alert">{error}</p>}</details>;
}
