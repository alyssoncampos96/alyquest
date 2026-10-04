export const instant = false;
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { claimDailyMissionForm } from "@/app/system-actions";
import { saoDate } from "@/lib/life-dashboard";

type Daily = { id:string; title:string; description:string; category:string; target_count:number; progress_count:number; completed_at:string|null; reward_xp:number|string; reward_coins:number|string };
export default async function Page(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect('/auth/login'); const day=saoDate();
 const generated=await supabase.rpc('aq_generate_daily_missions',{p_day:day});
 const listed=await supabase.from('aq_daily_missions').select('*').eq('user_id',user.id).eq('mission_day',day).order('created_at');
 const missions=listed.data as Daily[]??[];
 const loadError=generated.error||listed.error;
 return <main className="min-h-screen px-4 pb-28 pt-6"><div className="mx-auto max-w-md"><h1 className="text-2xl font-black">Missões diárias</h1><p className="mt-1 text-sm text-slate-400">Três desafios por dia, alternando foco, saúde, finanças e planejamento. Cada um rende XP e uma moeda.</p><section className="mt-5 space-y-3">{missions.map(m=><article key={m.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-black">{m.title}</h2><p className="mt-1 text-sm text-slate-400">{m.description}</p></div><span className="rounded-full bg-violet-950 px-3 py-1 text-xs text-violet-200">+{m.reward_xp} XP · +{m.reward_coins} 🪙</span></div><div className="mt-3 h-3 rounded-full bg-slate-950"><div className="h-3 rounded-full bg-emerald-500" style={{width:`${Math.min(100,Number(m.progress_count??0)/Number(m.target_count||1)*100)}%`}}/></div><p className="mt-1 text-xs text-slate-400">{m.progress_count}/{m.target_count}</p>{m.completed_at?<p className="mt-3 rounded-xl bg-emerald-950 p-3 text-sm text-emerald-200">Resgatada</p>:m.progress_count>=m.target_count?<ActionForm action={claimDailyMissionForm} className="mt-3"><input type="hidden" name="id" value={m.id}/><button className="w-full rounded-xl bg-emerald-600 p-3 font-bold">Resgatar recompensa</button></ActionForm>:<p className="mt-3 text-xs text-slate-400">Complete o objetivo para resgatar.</p>}</article>)}{loadError&&<p className="rounded-2xl border border-amber-800 p-4 text-sm text-amber-100">Não foi possível carregar as missões diárias. Tente atualizar a página; se continuar, o banco precisa de uma correção.</p>}{!missions.length&&!loadError&&<p className="rounded-2xl border border-slate-800 p-4 text-sm text-slate-300">Nenhuma missão foi gerada para hoje.</p>}</section></div></main>;
}
