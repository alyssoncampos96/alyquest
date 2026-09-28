"use client";
import { useState } from 'react';
import { defaults,field,type Module,type Step } from '@/lib/planning';
export function MissionOptions({kind:initial='single',modules=[],steps:initialSteps=[],creation=false}:{kind?:string;modules?:Module[];steps?:Step[];creation?:boolean}) {
 const [kind,setKind]=useState(initial),[steps,setSteps]=useState(initialSteps);
 return <><label className="mt-3 block text-sm">Tipo<select name="kind" value={kind} onChange={e=>setKind(e.target.value)} className={field}><option value="single">Tarefa única (sem etapas)</option><option value="task">Tarefa com etapas</option><option value="workout">Treino — modular</option></select></label>
 {creation&&kind==='workout'&&<div className="mt-4"><p className="text-sm">Módulos desta sessão</p><p className="mt-1 text-xs text-slate-400">Selecione agora ou deixe para decidir no dia.</p><div className="mt-2 flex flex-wrap gap-2">{[...defaults,...modules].map(m=><button key={m.id} type="button" className="rounded-xl border border-violet-700 px-3 py-2 text-sm" onClick={()=>setSteps([...steps,...m.steps.map((s,i)=>({...s,id:`${Date.now()}-${steps.length+i}-${Math.random().toString(36).slice(2)}`,done:false,actual:''}))])}>+ {m.name}</button>)}</div><ul className="mt-3 space-y-2">{steps.map(s=><li key={s.id} className="flex items-center justify-between gap-2 text-sm"><span>{s.title} · {s.target}</span><button type="button" aria-label={`Remover ${s.title}`} onClick={()=>setSteps(steps.filter(x=>x.id!==s.id))}>✕</button></li>)}</ul></div>}
 {creation&&<input type="hidden" name="steps" value={JSON.stringify(kind==='workout'?steps:[])}/>}
 </>;
}
