import { FormDialog } from '@/components/form-dialog';
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
import { TaskCard } from '@/components/task-card';
import { RoutineSync, RoutineList } from '@/components/routine-sync';
async function Content(){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/auth/login');
 const [planning,tr,br]=await Promise.all([loadPlanning(s,user.id),s.from('tasks').select('*').eq('user_id',user.id).order('created_at',{ascending:false}),s.from('bosses').select('id,name').eq('user_id',user.id).is('defeated_at',null)]);checked(tr);checked(br);
 const workouts=(tr.data??[]).filter(task=>planning.plans.some(p=>p.task_id===task.id&&p.kind==='workout'));
 return <main className="min-h-screen px-4 pb-28 pt-6"><div className="mx-auto max-w-md"><Link href="/tasks" className="text-sm text-violet-300">← Missões</Link><div className="mt-3 flex items-center justify-between gap-2"><h1 className="text-2xl font-black">🏋️ Treinos</h1>{planning.ready&&<FormDialog label="+ Treino"><MissionForm bosses={br.data??[]} workout modules={planning.modules}/></FormDialog>}</div><p className="mt-2 text-sm text-slate-400">Escolha corrida, braços, abdominal ou seus próprios módulos no dia. Altere a sessão sem mudar o modelo.</p>
 {!planning.ready?<p className="mt-6 rounded-2xl border border-amber-800 p-4">Os treinos precisam da atualização do banco para salvar seu progresso.</p>:<><RoutineSync/>
 <section className="mt-6"><h2 className="font-bold">Próximos 7 dias</h2><div className="mt-3 space-y-2">{Array.from({length:7},(_,i)=>{const d=new Date(`${today()}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+i);const date=d.toISOString().slice(0,10),sessions=workouts.filter(t=>t.due_date===date);return <div key={date} className="rounded-2xl border border-slate-700 bg-slate-900 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{i===0?'Hoje':d.toLocaleDateString('pt-BR',{weekday:'short',timeZone:'UTC'})} · {d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'UTC'})}</p><FormDialog label="+ Planejar"><MissionForm bosses={br.data??[]} workout modules={planning.modules} initialDate={date}/></FormDialog></div>{sessions.length?<ul className="mt-2 space-y-2">{sessions.map(t=><li key={t.id} className="text-sm"><a href={`#workout-${t.id}`} className="text-violet-300">{t.status==='completed'?'✓':'○'} {t.title}</a><p className="mt-1 text-xs text-slate-400">{planning.plans.find(p=>p.task_id===t.id)?.steps.map(s=>s.title).join(' + ')||'Módulos a definir no dia'}</p></li>)}</ul>:<p className="mt-2 text-xs text-slate-400">A definir · escolha os módulos quando quiser.</p>}</div>;})}</div></section>

 <h2 className="mb-3 mt-6 text-lg font-bold">Sessões pendentes</h2>
 {workouts.filter(t=>t.status==='pending').map(task=>{const plan=planning.plans.find(p=>p.task_id===task.id)!;return <section id={`workout-${task.id}`} key={task.id} className="mb-4 scroll-mt-8"><TaskCard task={task}><div className="mt-4"><StepEditor key={`${task.id}-${JSON.stringify(plan.steps)}`} taskId={task.id} initial={plan.steps} modules={planning.modules} workout/></div><details className="mt-4"><summary className="cursor-pointer text-sm text-violet-300">Editar data / recorrência / chefe</summary><MissionForm task={task} bosses={br.data??[]} plan={plan} routine={planning.routines.find(r=>r.id===plan.routine_id)}/></details></TaskCard></section>;})}
 {!workouts.some(t=>t.status==='pending')&&<p className="text-sm text-slate-400">Crie uma sessão e monte o treino de hoje.</p>}
 <details className="mt-6 rounded-2xl border border-slate-700 p-4"><summary className="cursor-pointer font-bold">Minha biblioteca de módulos ({planning.modules.length})</summary><p className="mt-3 text-xs text-slate-400">Os módulos iniciais são exemplos editáveis, não uma prescrição de treino. Ajuste conforme sua rotina.</p><details className="mt-4"><summary className="cursor-pointer text-violet-300">+ Novo módulo</summary><StepEditor workout/></details>{planning.modules.map(m=><details key={`${m.id}-${JSON.stringify(m.steps)}`} className="mt-4 border-t border-slate-700 pt-3"><summary className="cursor-pointer">{m.name}</summary><StepEditor module={m} initial={m.steps}/></details>)}</details>
 <RoutineList routines={planning.routines.filter(r=>r.kind==='workout')} editors={Object.fromEntries(planning.routines.filter(r=>r.kind==='workout').map(r=>[r.id,<MissionForm key={r.id} routineId={r.id} task={{...r,id:r.id}} bosses={br.data??[]} routine={r} modules={planning.modules} plan={{task_id:r.id,kind:r.kind,steps:r.steps??[],routine_id:r.id,occurrence_date:null}}/>]))}/>
 <h2 className="mb-3 mt-6 text-lg font-bold">Histórico</h2><p className="mb-3 text-xs text-slate-400">Confira cargas, distâncias e repetições registradas nos treinos anteriores.</p>
 {workouts.filter(t=>t.status==='completed').map(task=>{const plan=planning.plans.find(p=>p.task_id===task.id)!;return <details id={`workout-${task.id}`} key={task.id} className="mb-3 rounded-2xl border border-slate-700 p-4"><summary className="cursor-pointer">✓ {task.title} · {new Date(task.completed_at??task.created_at).toLocaleDateString('pt-BR')}</summary><div className="mt-3"><StepEditor taskId={task.id} initial={plan.steps} readOnly/><ActionForm action={repeatWorkout.bind(null,task.id)} className="mt-3"><button className="rounded-xl bg-violet-600 px-4 py-3 font-bold">Repetir treino hoje</button></ActionForm></div></details>;})}
 {!workouts.some(t=>t.status==='completed')&&<p className="text-sm text-slate-400">Seus treinos concluídos aparecerão aqui.</p>}
 </>}
 </div></main>;
}
export default function Page(){return <Suspense fallback={<main className="p-6">Carregando treinos...</main>}><Content/></Suspense>;}
