import { FormDialog } from '@/components/form-dialog';
import {WorkoutDays} from '@/components/workout-days';
import {WorkoutBuilder} from '@/components/workout-builder';
import { today } from '@/lib/planning';
import { ActionForm } from '@/components/action-form';
import { repeatWorkout } from '@/app/planning-actions';
import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadPlanning } from '@/lib/planning-server';
import { checked } from '@/lib/query';
import { StepEditor } from '@/components/step-editor';
import { MissionForm } from '@/components/mission-form';
import { MissionCard } from '@/components/mission-card';
import { RoutineSync, RoutineList } from '@/components/routine-sync';
async function Content(){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/auth/login');
 const [planning,tr,br]=await Promise.all([loadPlanning(s,user.id),s.from('tasks').select('*').eq('user_id',user.id).order('created_at',{ascending:false}),s.from('bosses').select('id,name').eq('user_id',user.id).is('defeated_at',null)]);checked(tr);checked(br);
 const workouts=(tr.data??[]).filter(task=>planning.plans.some(p=>p.task_id===task.id&&p.kind==='workout'));
 return <main className="min-h-screen px-4 pb-28 pt-6"><div className="mx-auto max-w-md"><Link href="/tasks" className="text-sm text-violet-300">← Missões</Link><div className="mt-3 flex items-center justify-between gap-2"><h1 className="text-2xl font-black">🏋️ Treinos</h1>{planning.ready&&<FormDialog label="+ Treino"><WorkoutBuilder date={today()} bosses={br.data??[]} modules={planning.modules}/></FormDialog>}</div><p className="mt-2 text-sm text-slate-400">Decida no dia: escolha corrida, braços, abdominal ou combine módulos. Abra o treino apenas quando for executar.</p>
 {!planning.ready?<p className="mt-6 rounded-2xl border border-amber-800 p-4">Os treinos precisam da atualização do banco para salvar seu progresso.</p>:<><RoutineSync/>
 <section className="mt-5 rounded-3xl border border-violet-800 bg-gradient-to-br from-violet-950 to-slate-900 p-4"><h2 className="text-lg font-black">Escolher módulos de hoje</h2><p className="mt-1 text-sm text-slate-300">Monte só o que pretende fazer agora. Você pode ajustar os exercícios depois.</p><div className="mt-3 flex flex-wrap gap-2">{planning.modules.slice(0,6).map(m=><FormDialog key={m.id} compact label={`+ ${m.name}`}><WorkoutBuilder date={today()} bosses={br.data??[]} modules={planning.modules} initialModuleIds={[m.id]}/></FormDialog>)}</div><div className="mt-4"><FormDialog label="+ Montar treino de hoje"><WorkoutBuilder date={today()} bosses={br.data??[]} modules={planning.modules}/></FormDialog></div></section>
 <h2 className="mt-6 text-lg font-black">Treino do dia e próximos dias</h2>
 <WorkoutDays today={today()} modules={planning.modules} bosses={br.data??[]} sessions={workouts.filter(t=>!['cancelled','skipped'].includes(t.status)).map(task=>({id:task.id,title:task.title,due_date:task.due_date,status:task.status,card:<MissionCard openWorkout task={task} planning={planning} bosses={br.data??[]}/>}))}/>
 <h2 className="mt-7 text-lg font-black">Biblioteca de exercícios</h2><details className="mt-3 rounded-2xl border border-slate-700 p-4"><summary className="cursor-pointer font-bold">Minha biblioteca de módulos ({planning.modules.length})</summary><p className="mt-3 text-xs text-slate-400">Os módulos iniciais são exemplos editáveis, não uma prescrição de treino. Ajuste conforme sua rotina.</p><details className="mt-4"><summary className="cursor-pointer text-violet-300">+ Novo módulo</summary><StepEditor workout/></details>{planning.modules.map(m=><details key={`${m.id}-${JSON.stringify(m.steps)}`} className="mt-4 border-t border-slate-700 pt-3"><summary className="cursor-pointer">{m.name}</summary><StepEditor module={m} initial={m.steps}/></details>)}</details>
 <h2 className="mt-7 text-lg font-black">Planejamento recorrente</h2><RoutineList routines={planning.routines.filter(r=>r.kind==='workout')} editors={Object.fromEntries(planning.routines.filter(r=>r.kind==='workout').map(r=>[r.id,<MissionForm key={r.id} routineId={r.id} task={{...r,id:r.id}} bosses={br.data??[]} routine={r} modules={planning.modules} plan={{task_id:r.id,kind:r.kind,steps:r.steps??[],routine_id:r.id,occurrence_date:null}}/>]))}/>
 <h2 className="mb-3 mt-6 text-lg font-bold">Histórico</h2><p className="mb-3 text-xs text-slate-400">Confira cargas, distâncias e repetições registradas nos treinos anteriores.</p>
 {workouts.filter(t=>t.status==='completed').map(task=>{const plan=planning.plans.find(p=>p.task_id===task.id)!;return <details id={`workout-${task.id}`} key={task.id} className="mb-3 rounded-2xl border border-slate-700 p-4"><summary className="cursor-pointer">✓ {task.title} · {new Date(task.completed_at??task.created_at).toLocaleDateString('pt-BR')}</summary><div className="mt-3"><StepEditor taskId={task.id} initial={plan.steps} readOnly/><ActionForm action={repeatWorkout.bind(null,task.id)} className="mt-3"><button className="rounded-xl bg-violet-600 px-4 py-3 font-bold">Repetir treino hoje</button></ActionForm></div></details>;})}
 {!workouts.some(t=>t.status==='completed')&&<p className="text-sm text-slate-400">Seus treinos concluídos aparecerão aqui.</p>}
 </>}
 </div></main>;
}
export default function Page(){return <Suspense fallback={<main className="p-6">Carregando treinos...</main>}><Content/></Suspense>;}
