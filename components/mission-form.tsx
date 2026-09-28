import { MissionOptions } from '@/components/mission-options';
import { ActionForm } from '@/components/action-form';
import { RecurrenceFields } from '@/components/recurrence-fields';
import { saveMission, saveRoutine } from '@/app/planning-actions';
import { createTask } from '@/app/actions';
import { categories, field, type Plan, type Routine, type Module } from '@/lib/planning';
import type { Task } from '@/lib/types';
export type BossOption={id:string;name:string};
export function MissionForm({task,bosses,plan,routine,ready=true,workout=false,routineId,modules=[],initialDate}:{task?:Task&{boss_id?:string|null};bosses:BossOption[];plan?:Plan;routine?:Routine;ready?:boolean;workout?:boolean;routineId?:string;modules?:Module[];initialDate?:string}) {
 return <ActionForm action={routineId?saveRoutine.bind(null,routineId):ready?saveMission.bind(null,task?.id??null):createTask} resetOnSuccess={!task} className="rounded-3xl border border-slate-700 bg-slate-900 p-5">
 <h2 className="font-bold">{routineId?'Editar próximas ocorrências':task?'Editar missão':workout?'Novo treino':'Nova missão'}</h2>
 <label className="mt-4 block text-sm">Tarefa<input name="title" required maxLength={200} defaultValue={task?.title??(workout?'Treinar':'')} placeholder="O que você quer fazer?" className={field}/></label>
 <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-sm">Categoria<select name="category" defaultValue={task?.category??(workout?'Saúde':'Pessoal')} className={field}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label className="text-sm">Prioridade<select name="priority" defaultValue={task?.priority??'medium'} className={field}><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select></label></div>
 <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-sm">Horas estimadas<input name="estimated_hours" type="number" min="0.1" max="1000" step="0.1" required defaultValue={task?.estimated_hours??1} className={field}/></label><label className="text-sm">Prazo<input name="due_date" type="date" defaultValue={task?.due_date?.slice(0,10)??initialDate??''} className={field}/></label></div>
 <label className="mt-3 block text-sm">Chefe/meta<select name="boss_id" className={field} defaultValue={task?.boss_id??''}><option value="">Nenhum</option>{bosses.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
 {ready&&<><MissionOptions kind={plan?.kind??(workout?'workout':'single')} modules={modules} creation={!task||!!routineId} steps={routine?.steps??[]} />
 {(!task||routine)&&<RecurrenceFields initialStart={initialDate} initial={routine?.rule} lockedStart={!!routine}/>}
 {routine&&!routineId&&<label className="mt-3 block text-sm">Aplicar alterações<select name="scope" className={field}><option value="one">Só esta ocorrência</option><option value="future">Esta e as próximas ainda não geradas</option></select><span className="mt-2 block text-xs text-slate-400">O histórico e outras ocorrências já criadas são preservados. A quantidade final é o total da série, incluindo ocorrências anteriores.</span></label>}
 </>}
 <button className="mt-4 w-full rounded-2xl bg-violet-600 py-3 font-bold">{task?'Salvar alterações':'Criar missão'}</button>
 </ActionForm>;
}
