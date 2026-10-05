import { loadTaskCategories } from '@/lib/task-categories-server';
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
import { MissionCard } from '@/components/mission-card';
import { RoutineSync, RoutineList } from '@/components/routine-sync';
async function Content(){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/auth/login');
 const [tr,br,planning]=await Promise.all([s.from('tasks').select('*').eq('user_id',user.id).order('created_at'),s.from('bosses').select('id,name').eq('user_id',user.id).is('defeated_at',null),loadPlanning(s,user.id)]);
 const categoryOptions=await loadTaskCategories();
 checked(tr);checked(br);const tasks=tr.data??[],bosses=br.data??[];
 return <main className="min-h-screen px-4 pb-28 pt-6"><div className="mx-auto max-w-md"><div className="flex items-center justify-between"><h1 className="text-2xl font-black">Missões</h1><div className="flex gap-2"><FormDialog label="+ Nova missão"><MissionForm bosses={bosses} ready={planning.ready} modules={planning.modules}/></FormDialog><Link href="/workouts" className="rounded-xl border border-violet-700 px-3 py-2 text-sm text-violet-300">🏋️ Treinos</Link></div></div><p className="mt-1 text-sm text-slate-400">Crie, organize e acompanhe cada etapa.</p>
 {planning.ready?<RoutineSync/>:<p className="mt-3 text-sm text-amber-300">Novos recursos aguardando atualização do banco. Suas tarefas continuam disponíveis.</p>}
 <SheetSync/>
 <MissionFilters categoryOptions={categoryOptions} missions={tasks.map(task=>({id:task.id,category:task.category,status:task.status,card:<MissionCard task={task} planning={planning} bosses={bosses}/>}))}/>
 {planning.ready&&<RoutineList routines={planning.routines} editors={Object.fromEntries(planning.routines.map(r=>[r.id,<MissionForm key={r.id} routineId={r.id} modules={planning.modules} task={{...r,id:r.id}} bosses={bosses} routine={r} plan={{task_id:r.id,kind:r.kind,steps:[],routine_id:r.id,occurrence_date:null}}/>]))}/>}
 </div></main>;
}
export default function Page(){return <Suspense fallback={<main className="p-6">Carregando missões...</main>}><Content/></Suspense>;}
