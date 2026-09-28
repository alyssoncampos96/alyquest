'use client';
import { useState } from 'react';
import { today, field, type Rule } from '@/lib/planning';
export function RecurrenceFields({ initial=null, lockedStart=false, initialStart }: { initial?:Rule|null; lockedStart?:boolean; initialStart?:string }) {
 const [frequency,setFrequency]=useState(initial?.frequency??'none');
 const [interval,setInterval]=useState(initial?.interval??1),[start,setStart]=useState(initial?.start??initialStart??today());
 const [weekdays,setWeekdays]=useState(initial?.weekdays??[new Date(`${start}T12:00:00`).getDay()]);
 const [end,setEnd]=useState(initial?.until?'date':initial?.count?'count':'never');
 const [until,setUntil]=useState(initial?.until??start),[count,setCount]=useState(initial?.count??10);
 const rule=frequency==='none'?null:{frequency,interval,start,weekdays,until:end==='date'?until:null,count:end==='count'?count:null};
 return <div className="mt-4 rounded-2xl border border-slate-700 p-4">
 <label className="block text-sm">Repetir<select className={field} value={frequency} onChange={e=>setFrequency(e.target.value as typeof frequency)}><option value="none">Não se repete</option><option value="daily">Diariamente</option><option value="weekly">Semanalmente</option><option value="monthly">Mensalmente</option><option value="yearly">Anualmente</option></select></label>
 <input type="hidden" name="rule" value={JSON.stringify(rule)}/>
 {frequency!=='none'&&<div className="mt-3 space-y-3">
 <div className="grid grid-cols-2 gap-3"><label className="text-sm">A cada<input type="number" min="1" max="99" required className={field} value={interval} onChange={e=>setInterval(Number(e.target.value))}/><span className="text-xs text-slate-400">{({daily:'dia(s)',weekly:'semana(s)',monthly:'mês(es)',yearly:'ano(s)'} as Record<string,string>)[frequency]}</span></label><label className="text-sm">Início<input type="date" required disabled={lockedStart} min={lockedStart?undefined:today()} className={field} value={start} onChange={e=>setStart(e.target.value)}/></label></div>
 {frequency==='weekly'&&<fieldset><legend className="text-sm">Dias da semana</legend><div className="mt-2 flex flex-wrap gap-2">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((label,index)=><label key={label} className={`rounded-xl border px-2 py-2 text-sm ${weekdays.includes(index)?'border-violet-500 bg-violet-950':'border-slate-700'}`}><input className="mr-1" type="checkbox" checked={weekdays.includes(index)} onChange={e=>setWeekdays(e.target.checked?[...weekdays,index]:weekdays.filter(d=>d!==index))}/>{label}</label>)}</div></fieldset>}
 <label className="block text-sm">Termina<select className={field} value={end} onChange={e=>setEnd(e.target.value)}><option value="never">Nunca</option><option value="date">Em uma data</option><option value="count">Após uma quantidade</option></select></label>
 {end==='date'&&<label className="block text-sm">Data final<input type="date" className={field} min={start} required value={until} onChange={e=>setUntil(e.target.value)}/></label>}
 {end==='count'&&<label className="block text-sm">Total de ocorrências da série<input type="number" className={field} min="1" max="10000" required value={count} onChange={e=>setCount(Number(e.target.value))}/></label>}
 {(frequency==='monthly'||frequency==='yearly')&&<p className="text-xs text-slate-400">Se o dia não existir naquele mês, usamos o último dia do mês.</p>}
 </div>}
 </div>;
}
