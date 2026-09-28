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
import { TaskCard } from '@/components/task-card';
import { RoutineSync } from '@/components/routine-sync';
async function Content(){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/auth/login');
 const [planning,tr,br]=await Promise.all([loadPlanning(s,user.id),s.from('tasks').select('*').eq('user_id',user.id).order('created_at',{ascending:false}),s.from('bosses').select('id,name').eq('user_id',user.id).is('defeated_at',null)]);checked(tr);checked(br);
 const workouts=(tr.data??[]).filter(task=>planning.plans.some(p=>p.task_id===task.id&&p.kind==='workout'));
 return <main className="min-h-screen px-4 pb-28 pt-6"><div className="mx-auto max-w-md"><Link href="/tasks" className="text-sm text-violet-300">← Missões</Link><h1 className="mt-3 text-2xl font-black">🏋️ Treinos modulares</h1><p className="mt-2 text-sm text-slate-400">Escolha corrida, braços, abdominal ou seus próprios módulos no dia. Altere a sessão sem mudar o modelo.</p>
 {!planning.ready?<p className="mt-6 rounded-2xl border border-amber-800 p-4">Os treinos precisam da atualização do banco para salvar seu progresso.</p>:<><RoutineSync/>
 <details className="mt-5"><summary className="cursor-pointer rounded-xl bg-violet-600 p-3 text-center font-bold">+ Criar treino (único ou recorrente)</summary><div className="mt-3"><MissionForm bosses={br.data??[]} workout/></div></details>
 <h2 className="mb-3 mt-6 text-lg font-bold">Sessões pendentes</h2>
 {workouts.filter(t=>t.status==='pending').map(task=>{const plan=planning.plans.find(p=>p.task_id===task.id)!;return <section key={task.id} className="mb-4 space-y-3 rounded-3xl border border-slate-700 p-3"><TaskCard task={task}/><StepEditor key={`${task.id}-${JSON.stringify(plan.steps)}`} taskId={task.id} initial={plan.steps} modules={planning.modules} workout/></section>;})}
 {!workouts.some(t=>t.status==='pending')&&<p className="text-sm text-slate-400">Crie uma sessão e monte o treino de hoje.</p>}
 <details className="mt-6 rounded-2xl border border-slate-700 p-4"><summary className="cursor-pointer font-bold">Minha biblioteca de módulos ({planning.modules.length})</summary><p className="mt-3 text-xs text-slate-400">Os módulos iniciais são exemplos editáveis, não uma prescrição de treino. Ajuste conforme sua rotina.</p><details className="mt-4"><summary className="cursor-pointer text-violet-300">+ Novo módulo</summary><StepEditor workout/></details>{planning.modules.map(m=><details key={`${m.id}-${JSON.stringify(m.steps)}`} className="mt-4 border-t border-slate-700 pt-3"><summary className="cursor-pointer">{m.name}</summary><StepEditor module={m} initial={m.steps}/></details>)}</details>
 <h2 className="mb-3 mt-6 text-lg font-bold">Histórico</h2><p className="mb-3 text-xs text-slate-400">Confira cargas, distâncias e repetições registradas nos treinos anteriores.</p>
 {workouts.filter(t=>t.status==='completed').map(task=>{const plan=planning.plans.find(p=>p.task_id===task.id)!;return <details key={task.id} className="mb-3 rounded-2xl border border-slate-700 p-4"><summary className="cursor-pointer">✓ {task.title} · {new Date(task.completed_at??task.created_at).toLocaleDateString('pt-BR')}</summary><div className="mt-3"><StepEditor taskId={task.id} initial={plan.steps} readOnly/><ActionForm action={repeatWorkout.bind(null,task.id)} className="mt-3"><button className="rounded-xl bg-violet-600 px-4 py-3 font-bold">Repetir treino hoje</button></ActionForm></div></details>;})}
 {!workouts.some(t=>t.status==='completed')&&<p className="text-sm text-slate-400">Seus treinos concluídos aparecerão aqui.</p>}
 </>}
 </div></main>;
}
export default function Page(){return <Suspense fallback={<main className="p-6">Carregando treinos...</main>}><Content/></Suspense>;}
