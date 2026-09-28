'use client';
import { useState, useTransition } from 'react';
import { saveSteps, saveModule } from '@/app/planning-actions';
import { defaults, field, type Step, type Module } from '@/lib/planning';
function newStepId() { return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `step-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export function StepEditor({taskId,initial=[],modules=[],readOnly=false,workout=false,module}:{taskId?:string;initial?:Step[];modules?:Module[];readOnly?:boolean;workout?:boolean;module?:Module}) {
 const [steps,setSteps]=useState<Step[]>(initial),[name,setName]=useState(module?.name??'');
 const [pending,startTransition]=useTransition(),[message,setMessage]=useState(''),[dirty,setDirty]=useState(false);
 function change(next:Step[]){setSteps(next);setDirty(true);setMessage('');}
 function patch(id:string,values:Partial<Step>){change(steps.map(step=>step.id===id?{...step,...values}:step));}
 function addModule(m:Module){change([...steps,...m.steps.map(step=>({...step,id:newStepId(),done:false,actual:''}))]);}
 function save(){startTransition(async()=>{try{if(taskId)await saveSteps(taskId,steps);else await saveModule(module?.id??null,name,steps);setDirty(false);setMessage('Salvo.');}catch(error){setMessage(error instanceof Error?error.message:'Não foi possível salvar.');}});}
 return <div className="space-y-3">
 {!taskId&&!readOnly&&<label className="block text-sm">Nome do módulo<input className={field} maxLength={100} value={name} onChange={e=>{setName(e.target.value);setDirty(true)}} placeholder="Ex.: Meu treino de braço"/></label>}
 {!readOnly&&workout&&<div><p className="text-sm text-slate-400">Adicione os módulos que quiser fazer nesta sessão.</p><div className="mt-2 flex flex-wrap gap-2">{[...defaults,...modules].map(m=><button key={m.id} disabled={pending} type="button" onClick={()=>addModule(m)} className="rounded-xl border border-violet-800 bg-violet-950 px-3 py-2 text-sm">+ {m.name}</button>)}</div></div>}
 <p className="text-xs text-slate-400">{steps.filter(s=>s.done).length}/{steps.length} etapas concluídas{dirty?' • Alterações não salvas':''}</p>
 {steps.map((step,index)=><fieldset disabled={pending||readOnly} key={step.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
 <div className="flex items-start gap-2"><label className="mt-3 flex shrink-0 items-center gap-1"><input aria-label={`Concluir ${step.title||`etapa ${index+1}`}`} type="checkbox" checked={step.done} onChange={e=>patch(step.id,{done:e.target.checked})}/><span className="text-xs">{index+1}</span></label><label className="min-w-0 flex-1 text-xs">Exercício / etapa<input maxLength={200} className={field} value={step.title} onChange={e=>patch(step.id,{title:e.target.value})}/></label>{!readOnly&&<button type="button" aria-label={`Remover etapa ${index+1}`} onClick={()=>change(steps.filter(s=>s.id!==step.id))} className="mt-7 text-slate-400">✕</button>}</div>
 <label className="mt-2 block text-xs">Meta (séries, repetições, carga, km ou tempo)<input maxLength={300} className={field} value={step.target} onChange={e=>patch(step.id,{target:e.target.value})}/></label>
 {taskId&&<label className="mt-2 block text-xs">Realizado / observações<input maxLength={500} className={field} value={step.actual} placeholder="Ex.: 3 × 12 com 8 kg" onChange={e=>patch(step.id,{actual:e.target.value})}/></label>}
 </fieldset>)}
 {!readOnly&&<><button type="button" disabled={pending||steps.length>=100} onClick={()=>change([...steps,{id:newStepId(),title:'',target:'',actual:'',done:false}])} className="rounded-xl border border-slate-600 px-3 py-2 text-sm">+ Adicionar etapa</button><button type="button" disabled={pending} onClick={save} className="ml-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold disabled:opacity-50">{pending?'Salvando...':taskId?'Salvar progresso':'Salvar módulo'}</button></>}
 {message&&<p role="status" className="text-sm text-violet-200">{message}</p>}
 {taskId&&!readOnly&&<p className="text-xs text-slate-400">Salve antes de sair ou concluir a missão. Etapas registram o progresso; XP, moedas e dano são concedidos uma vez ao concluir a missão, inclusive se você decidir encerrá-la parcialmente.</p>}
 </div>;
}
