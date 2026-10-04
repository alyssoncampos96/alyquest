import Link from 'next/link';
import {Suspense} from 'react';
import {createClient} from '@/lib/supabase/server';
import {checked} from '@/lib/query';
import {loadPlanning} from '@/lib/planning-server';
import {today} from '@/lib/planning';
import {taskDayGroup} from '@/lib/task-dates';
import {PlayerCard} from '@/components/player-card';
import {BossCard} from '@/components/boss-card';
import {MissionCard} from '@/components/mission-card';
import {LoginSync} from '@/components/login-sync';
import {RoutineSync} from '@/components/routine-sync';
async function Dashboard(){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)return <main className="min-h-screen p-6"><div className="mx-auto max-w-md"><h1 className="text-2xl font-black">AlyQuest</h1><p className="mt-3 text-slate-400">Faça login para continuar sua jornada.</p><Link href="/auth/login" className="mt-5 block rounded-xl bg-violet-600 p-3 text-center font-bold">Entrar</Link></div></main>;
 const [tr,br,xr,cr,pr,planning]=await Promise.all([s.from('tasks').select('*').eq('user_id',user.id).eq('status','pending').order('due_date',{ascending:true,nullsFirst:false}),s.from('bosses').select('*').eq('user_id',user.id).is('defeated_at',null).order('created_at'),s.from('xp_transactions').select('amount').eq('user_id',user.id),s.from('coin_transactions').select('amount').eq('user_id',user.id),s.from('profiles').select('current_streak').eq('user_id',user.id).maybeSingle(),loadPlanning(s,user.id)]);[tr,br,xr,cr,pr].forEach(checked);
 const tasks=tr.data??[],bosses=br.data??[],date=today(),xp=(xr.data??[]).reduce((n,r)=>n+Number(r.amount),0),coins=(cr.data??[]).reduce((n,r)=>n+Number(r.amount),0);
 const card=(t:typeof tasks[number])=><MissionCard key={t.id} task={t} planning={planning} bosses={bosses}/>;
 const workouts=tasks.filter(t=>t.due_date===date&&planning.plans.some(p=>p.task_id===t.id&&p.kind==='workout'));
 const daily=tasks.filter(t=>taskDayGroup(t,date)==='today'&&!workouts.some(w=>w.id===t.id));
 return <main className="min-h-screen px-4 pb-28 pt-6"><LoginSync/><RoutineSync/><div className="mx-auto max-w-md"><header className="mb-4 flex items-center justify-between"><div><p className="text-xs text-violet-300">⚔️ AlyQuest</p><h1 className="mt-1 text-2xl font-black">Hoje</h1><p className="text-xs text-slate-400">{new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</p></div><div className="flex gap-2"><Link href="/notifications" className="rounded-xl border border-slate-700 px-3 py-3 text-sm font-bold">🔔</Link><Link href="/focus" className="rounded-xl bg-violet-600 px-3 py-3 text-sm font-bold">🍅 Iniciar foco</Link></div></header>
 <nav className="mb-4 grid grid-cols-3 gap-2 text-center text-xs font-bold"><Link href="/daily" className="rounded-xl border border-violet-700 bg-slate-900 p-2">✨ Diárias</Link><Link href="/weekly" className="rounded-xl border border-violet-700 bg-slate-900 p-2">📊 Semana</Link><Link href="/inbox" className="rounded-xl border border-violet-700 bg-slate-900 p-2">📥 Capturar</Link></nav>
 <PlayerCard xp={xp} coins={coins} streak={pr.data?.current_streak??0} pendingTasks={tasks.length}/>
 <div className="mb-3 mt-6 flex items-center justify-between"><h2 className="font-bold">Missões de hoje ({daily.length})</h2><Link href="/tasks" className="text-sm text-violet-300">Todas / + Nova</Link></div><div className="space-y-2">{daily.map(card)}{!daily.length&&<p className="text-sm text-slate-400">Nenhuma missão com prazo para hoje. Você pode escolher uma sem data abaixo.</p>}</div>
 <div className="mb-3 mt-6 flex items-center justify-between"><h2 className="font-bold">Treino de hoje</h2><Link href="/workouts" className="text-sm text-violet-300">Planejar semana</Link></div><div className="space-y-2">{workouts.map(card)}{!workouts.length&&<Link href="/workouts" className="block rounded-xl border border-slate-700 p-3 text-sm text-slate-300">Escolher módulos ou deixar para decidir depois →</Link>}</div>
 {([['overdue','Atrasadas'],['unscheduled','Sem data'],['future','Futuras']] as const).map(([group,label])=>{const items=tasks.filter(t=>taskDayGroup(t,date)===group);return <details key={group} className="mt-5 rounded-2xl border border-slate-800 p-3"><summary className="cursor-pointer font-semibold">{label} ({items.length})</summary><div className="mt-3 space-y-2">{items.map(card)}{!items.length&&<p className="text-sm text-slate-400">Nenhuma missão neste grupo.</p>}</div></details>;})}
 <div className="mb-3 mt-6 flex justify-between"><h2 className="font-bold">Chefe atual</h2><Link href="/bosses" className="text-sm text-violet-300">Ver metas</Link></div><BossCard boss={bosses[0]??null}/>
 </div></main>;
}
export default function Home(){return <Suspense fallback={<main className="p-6">Carregando seu dia…</main>}><Dashboard/></Suspense>;}
