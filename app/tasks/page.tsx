import { SheetSync } from '@/components/sheet-sync';
import { FormDialog } from '@/components/form-dialog';
import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { checked } from '@/lib/query';
import { loadPlanning } from '@/lib/planning-server';
import { MissionFilters } from '@/components/mission-filters';
import { MissionForm } from '@/components/mission-form';
import { TaskCard } from '@/components/task-card';
import { StepEditor } from '@/components/step-editor';
import { RoutineSync, RoutineList } from '@/components/routine-sync';
async function Content(){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/auth/login');
 const [tr,br,planning]=await Promise.all([s.from('tasks').select('*').eq('user_id',user.id).order('created_at'),s.from('bosses').select('id,name').eq('user_id',user.id).is('defeated_at',null),loadPlanning(s,user.id)]);
 checked(tr);checked(br);const tasks=tr.data??[],bosses=br.data??[];
 return <main className="min-h-screen px-4 pb-28 pt-6"><div className="mx-auto max-w-md"><div className="flex items-center justify-between"><h1 className="text-2xl font-black">Missões</h1><div className="flex gap-2"><FormDialog label="+ Nova missão"><MissionForm bosses={bosses} ready={planning.ready} modules={planning.modules}/></FormDialog><Link href="/workouts" className="rounded-xl border border-violet-700 px-3 py-2 text-sm text-violet-300">🏋️ Treinos</Link></div></div><p className="mt-1 text-sm text-slate-400">Crie, organize e acompanhe cada etapa.</p>
 {planning.ready?<RoutineSync/>:<p className="mt-3 text-sm text-amber-300">Novos recursos aguardando atualização do banco. Suas tarefas continuam disponíveis.</p>}
 <SheetSync/>
 <MissionFilters missions={tasks.map(task=>{const plan=planning.plans.find(p=>p.task_id===task.id);const routine=planning.routines.find(r=>r.id===plan?.routine_id);return {id:task.id,category:task.category,status:task.status,card:<TaskCard task={task}>{planning.ready&&<div className="mt-4 space-y-3 border-t border-slate-700 pt-3">{plan?.kind!=='single'&&<details><summary className="cursor-pointer text-sm font-semibold">{plan?.kind==='workout'?'🏋️ Treino / progresso':'☑️ Etapas / progresso'}{plan?.steps.length?` (${plan.steps.filter(s=>s.done).length}/${plan.steps.length})`:''}</summary><div className="mt-4"><StepEditor key={`${task.id}-${JSON.stringify(plan?.steps??[])}`} taskId={task.id} initial={plan?.steps??[]} modules={planning.modules} workout={plan?.kind==='workout'} readOnly={task.status==='completed'}/></div></details>}{task.status==='pending'&&<details><summary className="cursor-pointer text-sm text-violet-300">{routine?'↻ Editar ocorrência / recorrência':'Editar missão / vincular chefe'}</summary><div className="mt-3"><MissionForm task={task} bosses={bosses} plan={plan} routine={routine}/></div></details>}</div>}</TaskCard>};})}>

 </MissionFilters>
 {planning.ready&&<RoutineList routines={planning.routines} editors={Object.fromEntries(planning.routines.map(r=>[r.id,<MissionForm key={r.id} routineId={r.id} modules={planning.modules} task={{...r,id:r.id}} bosses={bosses} routine={r} plan={{task_id:r.id,kind:r.kind,steps:[],routine_id:r.id,occurrence_date:null}}/>]))}/>}
 </div></main>;
}
export default function Page(){return <Suspense fallback={<main className="p-6">Carregando missões...</main>}><Content/></Suspense>;}
