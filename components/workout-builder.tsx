'use client';
import {useState} from 'react';
import {ActionForm} from './action-form';
import {DateInput} from './date-input';
import {RecurrenceFields} from './recurrence-fields';
import {saveMission} from '@/app/planning-actions';
import {defaults,field,type Module} from '@/lib/planning';
import type {BossOption} from './mission-form';
export function WorkoutBuilder({date,modules,bosses}:{date:string;modules:Module[];bosses:BossOption[]}){
 const [selected,setSelected]=useState<string[]>([]),[scheduledDate,setScheduledDate]=useState(date);
 const choices=[...modules,...defaults];const chosen=choices.filter(m=>selected.includes(m.id));
 const steps=chosen.flatMap(m=>m.steps.map((s,i)=>({...s,id:`${m.id}-${i}`,done:false,actual:''})));
 function cards(items:Module[]){return <div className="mt-3 grid grid-cols-2 gap-2">{items.map(m=>{const active=selected.includes(m.id);return <button key={m.id} type="button" aria-pressed={active} onClick={()=>setSelected(active?selected.filter(id=>id!==m.id):[...selected,m.id])} className={`min-w-0 rounded-2xl border p-3 text-left ${active?'border-violet-400 bg-violet-900/50':'border-slate-700 bg-slate-900'}`}><span className="block text-sm font-semibold">{active?'✓ ':''}{m.name}</span><span className="mt-1 block text-xs text-slate-400">{m.steps.length} exercício{m.steps.length===1?'':'s'}</span></button>;})}</div>;}
 return <ActionForm action={saveMission.bind(null,null)} resetOnSuccess className="space-y-4">
 <input type="hidden" name="kind" value="workout"/><input type="hidden" name="category" value="Saúde"/><input type="hidden" name="priority" value="medium"/><input type="hidden" name="steps" value={JSON.stringify(steps)}/>
 <label className="block text-sm">Quando você quer treinar?<DateInput name="due_date" value={scheduledDate} onChange={e=>setScheduledDate(e.target.value)} required/></label>
 <section><h3 className="font-semibold">O que você quer fazer?</h3><p className="mt-1 text-xs text-slate-400">Combine módulos ou deixe para escolher no dia.</p>{cards(modules.length?modules:defaults)}{modules.length>0&&<details className="mt-3"><summary className="cursor-pointer text-sm text-violet-300">Ver módulos de exemplo</summary>{cards(defaults)}</details>}</section>
 <div className="rounded-2xl bg-slate-900 p-3"><p className="text-sm font-semibold">{steps.length?`${steps.length} exercícios neste treino`:'Treino a definir'}</p><p className="mt-1 text-xs leading-relaxed text-slate-400">{steps.map(s=>s.title).join(' · ')||'Você poderá montar a sessão quando chegar à academia.'}</p></div>
 <details><summary className="cursor-pointer text-sm text-violet-300">Nome, duração, meta e repetição</summary><div className="mt-3 space-y-3"><label className="block text-sm">Nome<input name="title" className={field} maxLength={200} placeholder="Treino do dia" defaultValue="Treino do dia" required/></label><label className="block text-sm">Duração estimada (horas)<input name="estimated_hours" type="number" min="0.1" max="1000" step="0.1" defaultValue="1" className={field}/></label><label className="block text-sm">Chefe / meta<select name="boss_id" className={field}><option value="">Nenhum</option>{bosses.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><RecurrenceFields key={scheduledDate} initialStart={scheduledDate}/></div></details>
 <button className="w-full rounded-2xl bg-violet-600 px-4 py-3 font-bold">{steps.length?'Criar treino':'Reservar dia e decidir depois'}</button>
 </ActionForm>;
}
