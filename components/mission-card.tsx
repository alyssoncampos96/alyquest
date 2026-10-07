import {TaskCard} from './task-card';
import {MissionForm,type BossOption} from './mission-form';
import {StepEditor} from './step-editor';
import type {Task} from '@/lib/types';
import type {loadPlanning} from '@/lib/planning-server';
import {formatNumber} from '@/lib/game';
export function MissionCard({task,planning,bosses,openWorkout=false}:{task:Task;planning:Awaited<ReturnType<typeof loadPlanning>>;bosses:BossOption[];openWorkout?:boolean}){
 const plan=planning.plans.find(p=>p.task_id===task.id),routine=planning.routines.find(r=>r.id===plan?.routine_id);
 const rewardNote=plan?.steps.length
  ? `${plan.steps.length} etapa${plan.steps.length===1?'':'s'} × 1 XP e moeda, mais 1 ao concluir. Etapas já marcadas já renderam recompensa.`
  : `Concluir: +${formatNumber(Math.max(Number(task.estimated_hours??1),0.5))} XP e moeda${Number(task.estimated_hours??1)===1?'':'s'}.`;
 return <TaskCard task={task} routine={!!routine} rewardNote={rewardNote} source={planning.links.find(l=>l.task_id===task.id)} editor={<MissionForm task={task} plan={plan} routine={routine} modules={planning.modules} bosses={bosses}/>}>
 {plan?.kind!=='single'&&(task.status==='pending'||!!plan?.steps.length)&&<details open={openWorkout||undefined} className="mt-2"><summary className="cursor-pointer text-xs text-violet-300">{plan?.steps.length?`${plan.kind==='workout'?'Treino':'Etapas'} · ${plan.steps.filter(s=>s.done).length}/${plan.steps.length}`:task.status==='pending'?'Adicionar etapas':'Sem etapas'}</summary><div className="mt-3"><StepEditor key={task.id} taskId={task.id} initial={plan?.steps??[]} revision={plan?.revision??0} modules={planning.modules} previous={planning.previous} workout={plan?.kind==='workout'} readOnly={task.status!=='pending'}/></div></details>}
 </TaskCard>;
}
