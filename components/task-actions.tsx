"use client";
import {useState,useTransition,type ReactNode} from 'react';
import {finishMission,changeTaskState} from '@/app/mission-actions';
import {flushSteps} from './step-save-registry';
import {FormDialog} from './form-dialog';
import {DateInput} from './date-input';
import type {Task} from '@/lib/types';
export function TaskActions({task,editor,routine=false}:{task:Task;editor?:ReactNode;routine?:boolean}){
 const [pending,start]=useTransition(),[error,setError]=useState('');
 function run(fn:()=>Promise<unknown>){start(async()=>{setError('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar.');}});}
 if(task.status==='completed')return <p className="mt-2 text-xs text-emerald-300">✓ Concluída{task.completed_at?` · ${new Date(task.completed_at).toLocaleDateString('pt-BR')}`:''}</p>;
 if(task.status==='cancelled'||task.status==='skipped')return <div className="mt-2 text-xs text-slate-400">{task.status==='skipped'?'Ocorrência pulada':'Cancelada'} <button disabled={pending} onClick={()=>run(()=>changeTaskState(task.id,'restore'))} className="ml-2 text-violet-300">Restaurar</button>{error&&<p role="alert">{error}</p>}</div>;
 return <><div className="mt-3 flex flex-wrap items-center gap-2 text-xs [&>button]:rounded-lg [&>button]:px-2.5 [&>button]:py-2 [&>button]:font-semibold">
 <button disabled={pending} className="bg-emerald-600" onClick={()=>run(async()=>{await flushSteps(task.id);const result=await finishMission(task.id);window.dispatchEvent(new CustomEvent('aq:reward',{detail:result}));})}>{pending?'Salvando…':'✓ Concluir'}</button>
 <FormDialog compact label="Adiar"><form onSubmit={e=>{e.preventDefault();const f=e.currentTarget;const date=String(new FormData(f).get('date'));run(async()=>{await changeTaskState(task.id,'postpone',date);f.closest('dialog')?.close();});}}><label className="text-sm">Nova data<DateInput name="date" required defaultValue={task.due_date??''}/></label><button disabled={pending} className="mt-3 rounded-xl bg-violet-600 px-3 py-2">Salvar data</button></form></FormDialog>
 {editor&&<FormDialog compact label="Editar">{editor}</FormDialog>}
 {routine&&<button disabled={pending} className="border border-slate-700" onClick={()=>run(()=>changeTaskState(task.id,'skip'))}>Pular ocorrência</button>}
 <button disabled={pending} className="border border-slate-700 text-slate-300" onClick={()=>run(()=>changeTaskState(task.id,'cancel'))}>Cancelar</button>
 </div>{error&&<p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}</>;
}
