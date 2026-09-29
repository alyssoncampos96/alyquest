'use client';
import {useState,useTransition,type ReactNode} from 'react';
import {flushAllSteps} from './step-save-registry';
import {FormDialog} from './form-dialog';
import {WorkoutBuilder} from './workout-builder';
import type {Module} from '@/lib/planning';
import type {BossOption} from './mission-form';
type Session={id:string;due_date:string|null;status:string;title:string;card:ReactNode};
export function WorkoutDays({today,sessions,modules,bosses}:{today:string;sessions:Session[];modules:Module[];bosses:BossOption[]}){
 const [selected,setSelected]=useState(today),[saving,start]=useTransition(),[error,setError]=useState('');
 function selectDay(date:string){start(async()=>{try{await flushAllSteps();setError('');setSelected(date);}catch(e){setError(e instanceof Error?e.message:'Salve o treino antes de trocar o dia.');}});}
 const days=Array.from({length:7},(_,i)=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+i);return {date:d.toISOString().slice(0,10),day:d.toLocaleDateString('pt-BR',{day:'2-digit',timeZone:'UTC'}),label:i===0?'Hoje':d.toLocaleDateString('pt-BR',{weekday:'short',timeZone:'UTC'}).replace('.','')};});
 const visible=sessions.filter(t=>t.due_date===selected);const other=sessions.filter(t=>t.status==='pending'&&(!t.due_date||t.due_date<today||t.due_date>days[6].date));
 return <><div className="mt-5 grid grid-cols-7 gap-1" role="group" aria-label="Escolher dia do treino">{days.map(d=><button key={d.date} aria-pressed={selected===d.date} disabled={saving} onClick={()=>selectDay(d.date)} className={`min-w-0 rounded-xl border py-3 text-center ${selected===d.date?'border-violet-400 bg-violet-600':'border-slate-700 bg-slate-900'}`}><span className="block text-[10px] capitalize">{d.label}</span><span className="mt-1 block font-bold">{d.day}</span><span className={`mx-auto mt-1 block h-1 w-1 rounded-full ${sessions.some(t=>t.due_date===d.date)?'bg-violet-200':'bg-transparent'}`}/></button>)}</div>
 {error&&<p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}<section className="mt-5"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-bold">{selected===today?'Seu treino de hoje':`Treino de ${new Date(`${selected}T12:00:00Z`).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'UTC'})}`}</h2><FormDialog compact label="+ Montar treino"><WorkoutBuilder key={selected} date={selected} modules={modules} bosses={bosses}/></FormDialog></div>{visible.length?<div className="space-y-3">{visible.map(t=><div key={t.id}>{t.card}</div>)}</div>:<div className="rounded-2xl border border-dashed border-slate-700 p-5"><p className="font-semibold">Como você quer se movimentar?</p><p className="mt-2 text-sm text-slate-400">Só uma corrida, braços e abdominal, ou outro módulo. Monte a combinação quando quiser.</p></div>}</section>
 {other.length>0&&<details className="mt-5 rounded-2xl border border-slate-700 p-3"><summary className="cursor-pointer text-sm font-semibold">Outros treinos pendentes ({other.length})</summary><div className="mt-3 space-y-3">{other.map(t=><div key={t.id}>{t.card}</div>)}</div></details>}
 </>;
}
