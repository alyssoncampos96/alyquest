export const instant = false;
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { areaEmoji, levelFromCount, lifeAreas, progressPct, soft } from "@/lib/life-dashboard";

type Task = { id:string; title:string; category:string|null; status:string; boss_id:string|null };
type Boss = { id:string; name:string; hp:number|string; current_hp:number|string; defeated_at:string|null; reward_coins:number|string|null };
export default async function Page(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect('/auth/login');
 const [tasks,bosses]=await Promise.all([
  soft<Task[]>(supabase.from('tasks').select('id,title,category,status,boss_id').eq('user_id',user.id),[]),
  soft<Boss[]>(supabase.from('bosses').select('id,name,hp,current_hp,defeated_at,reward_coins').eq('user_id',user.id),[]),
 ]);
 return <main className="min-h-screen px-4 pb-28 pt-6"><div className="mx-auto max-w-md"><h1 className="text-2xl font-black">Mapa de jornadas</h1><p className="mt-1 text-sm text-slate-400">Cada área da vida ganha nível conforme você conclui tarefas.</p>
 <section className="mt-5 rounded-3xl border border-slate-800 bg-slate-900 p-5"><h2 className="font-black">Flor de progresso</h2><div className="mt-4 grid grid-cols-5 gap-2">{lifeAreas.map(area=>{const done=tasks.filter(t=>t.category===area&&t.status==='completed').length;return <div key={area} className="rounded-full border border-slate-700 p-3 text-center" title={area}><div className="text-2xl">{areaEmoji(area)}</div><div className="mt-1 text-[10px] text-slate-400">Nv {levelFromCount(done)}</div></div>})}</div></section>
 <section className="mt-5 space-y-3">{lifeAreas.map(area=>{const areaTasks=tasks.filter(t=>t.category===area);const done=areaTasks.filter(t=>t.status==='completed').length;const pending=areaTasks.filter(t=>t.status==='pending').length;const level=levelFromCount(done);const activeBosses=bosses.filter(b=>!b.defeated_at && areaTasks.some(t=>t.boss_id===b.id));return <article key={area} className="rounded-3xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-start justify-between"><div><h2 className="text-lg font-black">{areaEmoji(area)} {area}</h2><p className="text-sm text-slate-400">Nível {level} · {done} concluídas · {pending} pendentes</p></div><span className="rounded-full bg-slate-950 px-3 py-1 text-xs">{Math.round((level-1)*5)} XP área</span></div><div className="mt-3 h-3 rounded-full bg-slate-950"><div className="h-3 rounded-full bg-violet-500" style={{width:progressPct(done%5,5)}} /></div>{activeBosses.length>0&&<div className="mt-3 space-y-2">{activeBosses.map(b=><Link href="/bosses" key={b.id} className="block rounded-2xl border border-violet-800 bg-violet-950/30 p-3 text-sm"><b>👹 {b.name}</b><p className="text-xs text-violet-200">Meta grande ativa · recompensa {b.reward_coins??10} moedas</p></Link>)}</div>}<Link href={`/tasks?category=${encodeURIComponent(area)}`} className="mt-3 block text-sm text-violet-300">Ver missões da área →</Link></article>})}</section>
 </div></main>;
}
