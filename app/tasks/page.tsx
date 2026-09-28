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
 const [tr,br,planning]=await Promise.all([s.from('tasks').select('*').eq('user_id',user.id).eq('status','pending').order('created_at'),s.from('bosses').select('id,name').eq('user_id',user.id).is('defeated_at',null),loadPlanning(s,user.id)]);
 checked(tr);checked(br);const tasks=tr.data??[],bosses=br.data??[];
 return <main className="min-h-screen px-4 pb-28 pt-6"><div className="mx-auto max-w-md"><div className="flex items-center justify-between"><h1 className="text-2xl font-black">Missões</h1><Link href="/workouts" className="rounded-xl border border-violet-700 px-3 py-2 text-sm text-violet-300">🏋️ Treinos</Link></div><p className="mt-1 text-sm text-slate-400">Crie, organize e acompanhe cada etapa.</p>
 {planning.ready?<RoutineSync/>:<p className="mt-3 text-sm text-amber-300">Novos recursos aguardando atualização do banco. Suas tarefas continuam disponíveis.</p>}
 <MissionFilters missions={tasks.map(task=>{const plan=planning.plans.find(p=>p.task_id===task.id);const routine=planning.routines.find(r=>r.id===plan?.routine_id);return {id:task.id,category:task.category,card:<div className="space-y-2"><TaskCard task={task}/>{planning.ready&&<><details className="rounded-2xl border border-slate-700 bg-slate-900 p-4"><summary className="cursor-pointer text-sm font-semibold">{plan?.kind==='workout'?'🏋️ Montar treino / progresso':'☑️ Etapas / progresso'}{plan?.steps.length?` (${plan.steps.filter(s=>s.done).length}/${plan.steps.length})`:''}</summary><div className="mt-4"><StepEditor key={`${task.id}-${JSON.stringify(plan?.steps??[])}`} taskId={task.id} initial={plan?.steps??[]} modules={planning.modules} workout={plan?.kind==='workout'}/></div></details><details className="rounded-2xl border border-slate-700 p-3"><summary className="cursor-pointer text-sm text-violet-300">{routine?'↻ Editar ocorrência / recorrência':'Editar missão / vincular chefe'}</summary><div className="mt-3"><MissionForm task={task} bosses={bosses} plan={plan} routine={routine}/></div></details></>}</div>};})}>
 <details className="mt-5" open={tasks.length===0}><summary className="cursor-pointer rounded-2xl bg-violet-600 p-4 text-center font-bold">+ Nova missão</summary><div className="mt-3"><MissionForm bosses={bosses} ready={planning.ready}/></div></details>
 </MissionFilters>
 {planning.ready&&<RoutineList routines={planning.routines} editors={Object.fromEntries(planning.routines.map(r=>[r.id,<MissionForm key={r.id} routineId={r.id} task={{...r,id:r.id}} bosses={bosses} routine={r} plan={{task_id:r.id,kind:r.kind,steps:[],routine_id:r.id,occurrence_date:null}}/>]))}/>}
 </div></main>;
}
export default function Page(){return <Suspense fallback={<main className="p-6">Carregando missões...</main>}><Content/></Suspense>;}
